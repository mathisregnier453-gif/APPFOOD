-- =============================================================================
-- Phase 6 : administration, suivi financier, erreurs, statistiques, performance
-- Toutes les fonctions admin_* vérifient is_admin() et journalisent les actions.
-- Aucune donnée personnelle n'est exposée hors de ces fonctions.
-- =============================================================================

-- Activité et consentement statistiques -------------------------------------------
alter table public.profiles
  add column last_active_at timestamptz,
  add column analytics_consent boolean not null default false;
grant update (analytics_consent) on public.profiles to authenticated;
create index profiles_created_idx on public.profiles (created_at);
create index profiles_active_idx on public.profiles (last_active_at);

-- Appelée à l'ouverture de l'app (au plus une écriture toutes les 12 h).
create or replace function public.touch_last_active() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_active_at = now()
   where id = auth.uid() and (last_active_at is null or last_active_at < now() - interval '12 hours');
$$;

-- Paramètres financiers (une seule ligne), modifiables par l'admin -------------------
create table public.finance_settings (
  id                              boolean primary key default true check (id),
  vat_rate                        numeric(5,4) not null default 0.20,
  store_commission_rate           numeric(5,4) not null default 0.15,
  eur_per_usd                     numeric(8,4) not null default 0.92,
  hosting_cost_monthly_cents      integer not null default 2500,  -- à renseigner avec la facture réelle
  target_margin_per_premium_cents integer not null default 300,
  updated_at                      timestamptz not null default now()
);
insert into public.finance_settings default values;
alter table public.finance_settings enable row level security;
create policy "finance admin read" on public.finance_settings for select to authenticated using (public.is_admin());

-- Journal des actions administrateur --------------------------------------------------
create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target      text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create policy "audit admin read" on public.admin_audit_log for select to authenticated using (public.is_admin());

-- Erreurs serveur (edge functions) ------------------------------------------------------
create table public.error_logs (
  id          bigint generated always as identity primary key,
  source      text not null,
  code        text not null,
  message     text,
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index error_logs_created_idx on public.error_logs (created_at desc);
alter table public.error_logs enable row level security;
create policy "errors admin read" on public.error_logs for select to authenticated using (public.is_admin());

-- Index pour le tableau de bord ----------------------------------------------------------
create index ai_usage_logs_feature_idx on public.ai_usage_logs (feature, created_at);
create index ai_usage_logs_household_idx on public.ai_usage_logs (household_id, created_at);
create index subscriptions_status_idx on public.subscriptions (status, current_period_end);
create index scan_sessions_created_idx on public.scan_sessions (created_at);

-- Garde ----------------------------------------------------------------------------------
create or replace function public.assert_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create or replace function public.audit(p_action text, p_target text, p_details jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_audit_log (admin_id, action, target, details) values (auth.uid(), p_action, p_target, p_details);
$$;
revoke execute on function public.audit(text, text, jsonb) from public, anon, authenticated;

-- Abonnements payants actifs (hors sandbox) --------------------------------------------------
create or replace function public.paying_subscriptions()
returns table (user_id uuid, household_id uuid, plan public.plan_code, period public.billing_period, monthly_cents numeric, status text, will_renew boolean)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.household_id, s.plan, s.period,
         case s.period when 'monthly' then coalesce(s.price_paid_cents, pl.price_monthly_cents)::numeric
                       else coalesce(s.price_paid_cents, pl.price_yearly_cents, pl.price_monthly_cents * 12)::numeric / 12 end,
         s.status, s.will_renew
    from public.subscriptions s join public.plans pl on pl.code = s.plan
   where not s.is_sandbox
     and s.status in ('active', 'in_grace_period', 'cancelled')
     and (s.current_period_end is null or s.current_period_end > now());
$$;
revoke execute on function public.paying_subscriptions() from public, anon, authenticated;

-- =============================================================================
-- Tableau de bord
-- =============================================================================
create or replace function public.admin_dashboard(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  f        public.finance_settings;
  v_from   timestamptz := p_from::timestamptz;
  v_to     timestamptz := (p_to + 1)::timestamptz;
  v_days   numeric := greatest(1, p_to - p_from + 1);
  v_users  integer;
  v_paying integer;
  v_result jsonb;
begin
  perform public.assert_admin();
  select * into f from public.finance_settings;
  select count(*) into v_users from public.profiles;
  select count(*) into v_paying from public.paying_subscriptions();

  with subs as (select * from public.paying_subscriptions()),
  ai as (
    select l.*, (l.household_id in (select household_id from subs)) as paying
      from public.ai_usage_logs l where l.created_at >= v_from and l.created_at < v_to
  ),
  per_feature as (
    select feature::text, count(*) calls, count(*) filter (where not success) failures,
           round(sum(cost_usd) * f.eur_per_usd, 4) cost_eur
      from ai group by feature
  ),
  top_users as (
    select a.user_id, u.email, count(*) calls, round(sum(a.cost_usd) * f.eur_per_usd, 4) cost_eur
      from ai a left join auth.users u on u.id = a.user_id
     where a.user_id is not null group by a.user_id, u.email order by sum(a.cost_usd) desc limit 10
  ),
  avg_user as (
    select coalesce(avg(c), 0) avg_cost from (select sum(cost_usd) * f.eur_per_usd c from ai where user_id is not null group by user_id) x
  ),
  mrr as (
    select coalesce(sum(monthly_cents), 0) / 100.0 gross,
           coalesce(sum(monthly_cents) filter (where plan = 'premium'), 0) / 100.0 premium_gross,
           count(*) filter (where plan = 'premium') premium, count(*) filter (where plan = 'family') family,
           count(*) filter (where period = 'monthly') monthly, count(*) filter (where period = 'yearly') yearly,
           count(*) filter (where status = 'cancelled' or will_renew = false) not_renewing
      from subs
  ),
  churned as (
    select count(*) n from public.subscriptions s
     where not s.is_sandbox and s.status = 'expired' and s.updated_at >= v_from and s.updated_at < v_to
  ),
  ai_tot as (
    select coalesce(sum(cost_usd), 0) * f.eur_per_usd cost_eur,
           coalesce(sum(cost_usd) filter (where paying), 0) * f.eur_per_usd paying_cost_eur,
           coalesce(sum(cost_usd) filter (where not paying), 0) * f.eur_per_usd free_cost_eur,
           count(*) filter (where feature = 'scan' and success) scans,
           coalesce(sum(cost_usd) filter (where feature = 'scan'), 0) * f.eur_per_usd scan_cost_eur
      from ai
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days),
    'users', jsonb_build_object(
      'total', v_users,
      'new', (select count(*) from public.profiles where created_at >= v_from and created_at < v_to),
      'active_30d', (select count(*) from public.profiles where last_active_at > now() - interval '30 days'),
      'suspended', (select count(*) from public.profiles where suspended_at is not null),
      'free', v_users - v_paying),
    'subscriptions', jsonb_build_object(
      'premium', m.premium, 'family', m.family, 'monthly', m.monthly, 'yearly', m.yearly, 'not_renewing', m.not_renewing),
    'revenue', jsonb_build_object(
      'mrr_gross_eur', round(m.gross, 2),
      'mrr_net_eur', round(m.gross / (1 + f.vat_rate) * (1 - f.store_commission_rate), 2)),
    'ai', jsonb_build_object(
      'cost_eur', round(t.cost_eur, 2),
      'scans', t.scans,
      'cost_per_scan_eur', case when t.scans > 0 then round(t.scan_cost_eur / t.scans, 4) end,
      'cost_per_paying_sub_month_eur', case when v_paying > 0 then round(t.paying_cost_eur / v_paying * 30 / v_days, 4) end,
      'cost_per_free_user_month_eur', case when v_users - v_paying > 0 then round(t.free_cost_eur / (v_users - v_paying) * 30 / v_days, 4) end,
      'by_feature', coalesce((select jsonb_agg(to_jsonb(p) order by p.cost_eur desc) from per_feature p), '[]'::jsonb)),
    'costs', jsonb_build_object(
      'hosting_month_eur', round(f.hosting_cost_monthly_cents / 100.0, 2),
      'hosting_per_user_month_eur', case when v_users > 0 then round(f.hosting_cost_monthly_cents / 100.0 / v_users, 4) end),
    'margin', jsonb_build_object(
      -- contribution estimée d'un abonné Premium mensuel : prix net - IA - part d'hébergement
      'premium_net_price_eur', round((select price_monthly_cents from public.plans where code = 'premium') / 100.0 / (1 + f.vat_rate) * (1 - f.store_commission_rate), 2),
      'per_premium_sub_month_eur', round(
          (select price_monthly_cents from public.plans where code = 'premium') / 100.0 / (1 + f.vat_rate) * (1 - f.store_commission_rate)
          - coalesce(case when v_paying > 0 then t.paying_cost_eur / v_paying * 30 / v_days end, 0)
          - coalesce(case when v_users > 0 then f.hosting_cost_monthly_cents / 100.0 / v_users end, 0), 2),
      'target_eur', round(f.target_margin_per_premium_cents / 100.0, 2)),
    'conversion', jsonb_build_object(
      'paying_rate', case when v_users > 0 then round(v_paying::numeric / v_users, 4) end,
      'cohort_rate', (select case when count(*) > 0 then round(count(*) filter (where exists (
                         select 1 from public.subscriptions s where s.user_id = p.id and not s.is_sandbox))::numeric / count(*), 4) end
                        from public.profiles p where p.created_at >= v_from and p.created_at < v_to)),
    'churn', jsonb_build_object(
      'expired_in_period', c.n,
      'rate', case when v_paying + c.n > 0 then round(c.n::numeric / (v_paying + c.n), 4) end),
    'anomalies', jsonb_build_object(
      'avg_cost_per_active_user_eur', round(a.avg_cost, 4),
      'top_users', coalesce((select jsonb_agg(jsonb_build_object(
          'user_id', tu.user_id, 'email', tu.email, 'calls', tu.calls, 'cost_eur', tu.cost_eur,
          'ratio_to_avg', case when a.avg_cost > 0 then round(tu.cost_eur / a.avg_cost, 1) end,
          'abnormal', a.avg_cost > 0 and tu.cost_eur > 5 * a.avg_cost and tu.cost_eur > 0.5)) from top_users tu), '[]'::jsonb),
      'failing_features', coalesce((select jsonb_agg(p.feature) from per_feature p where p.calls >= 10 and p.failures::numeric / p.calls > 0.1), '[]'::jsonb)),
    'errors', jsonb_build_object(
      'server_errors', (select count(*) from public.error_logs where created_at >= v_from and created_at < v_to),
      'ai_failures', (select count(*) from ai where not success),
      'billing_events_failed', (select count(*) from public.revenuecat_events where error is not null and processed_at is null))
  ) into v_result
  from mrr m, ai_tot t, churned c, avg_user a;
  return v_result;
end $$;

-- Utilisateurs (support) -----------------------------------------------------------------
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, display_name text, created_at timestamptz, last_active_at timestamptz,
               household_id uuid, plan public.plan_code, scans_used integer, ai_cost_month_eur numeric, suspended boolean, is_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select p.id, u.email::text, p.display_name, p.created_at, p.last_active_at, p.current_household_id,
           public.effective_plan(p.current_household_id),
           coalesce((select q.scans_used from public.usage_quotas q where q.household_id = p.current_household_id and q.period_start = public.current_period_start()), 0),
           round(coalesce((select sum(l.cost_usd) from public.ai_usage_logs l where l.user_id = p.id and l.created_at >= public.current_period_start()), 0)
                 * (select eur_per_usd from public.finance_settings), 4),
           p.suspended_at is not null, p.is_admin
      from public.profiles p join auth.users u on u.id = p.id
     where p_search is null or p_search = '' or u.email ilike p_search || '%' or p.display_name ilike '%' || p_search || '%'
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

create or replace function public.admin_set_suspension(p_user uuid, p_suspended boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if p_user = auth.uid() then raise exception 'cannot_suspend_self' using errcode = 'P0001'; end if;
  update public.profiles
     set suspended_at = case when p_suspended then now() else null end,
         suspended_reason = case when p_suspended then left(p_reason, 280) else null end
   where id = p_user;
  perform public.audit(case when p_suspended then 'suspend_user' else 'unsuspend_user' end, p_user::text, jsonb_build_object('reason', p_reason));
end $$;

-- Geste commercial / correction : rend des scans au foyer pour le mois en cours.
create or replace function public.admin_gift_scans(p_household uuid, p_count integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if p_count not between 1 and 100 then raise exception 'invalid_count' using errcode = '22023'; end if;
  insert into public.usage_quotas (household_id, period_start) values (p_household, public.current_period_start()) on conflict do nothing;
  update public.usage_quotas set scans_used = greatest(0, scans_used - p_count), updated_at = now()
   where household_id = p_household and period_start = public.current_period_start();
  perform public.audit('gift_scans', p_household::text, jsonb_build_object('count', p_count));
end $$;

-- Offres : quotas, fonctions, prix de référence (les prix facturés se changent dans les stores).
create or replace function public.admin_update_plan(p_code public.plan_code, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  perform public.assert_admin();
  select to_jsonb(pl) into v_before from public.plans pl where pl.code = p_code;
  update public.plans pl set
    monthly_scan_quota   = coalesce((p_patch ->> 'monthly_scan_quota')::integer, pl.monthly_scan_quota),
    monthly_recipe_quota = case when p_patch ? 'monthly_recipe_quota' then (p_patch ->> 'monthly_recipe_quota')::integer else pl.monthly_recipe_quota end,
    fair_use_recipe_cap  = coalesce((p_patch ->> 'fair_use_recipe_cap')::integer, pl.fair_use_recipe_cap),
    max_members          = coalesce((p_patch ->> 'max_members')::smallint, pl.max_members),
    max_photos_per_scan  = coalesce((p_patch ->> 'max_photos_per_scan')::smallint, pl.max_photos_per_scan),
    price_monthly_cents  = coalesce((p_patch ->> 'price_monthly_cents')::integer, pl.price_monthly_cents),
    price_yearly_cents   = case when p_patch ? 'price_yearly_cents' then (p_patch ->> 'price_yearly_cents')::integer else pl.price_yearly_cents end,
    features             = case when p_patch ? 'features' then pl.features || (p_patch -> 'features') else pl.features end,
    updated_at = now()
  where pl.code = p_code;
  if (select monthly_scan_quota < 0 or max_members < 1 or max_photos_per_scan not between 1 and 10 from public.plans where code = p_code) then
    raise exception 'invalid_plan_values' using errcode = '22023';
  end if;
  perform public.audit('update_plan', p_code::text, jsonb_build_object('before', v_before, 'patch', p_patch));
end $$;

create or replace function public.admin_update_finance(p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.finance_settings set
    vat_rate = coalesce((p_patch ->> 'vat_rate')::numeric, vat_rate),
    store_commission_rate = coalesce((p_patch ->> 'store_commission_rate')::numeric, store_commission_rate),
    eur_per_usd = coalesce((p_patch ->> 'eur_per_usd')::numeric, eur_per_usd),
    hosting_cost_monthly_cents = coalesce((p_patch ->> 'hosting_cost_monthly_cents')::integer, hosting_cost_monthly_cents),
    target_margin_per_premium_cents = coalesce((p_patch ->> 'target_margin_per_premium_cents')::integer, target_margin_per_premium_cents),
    updated_at = now();
  if (select vat_rate not between 0 and 0.5 or store_commission_rate not between 0 and 0.5 or eur_per_usd <= 0 from public.finance_settings) then
    raise exception 'invalid_finance_values' using errcode = '22023';
  end if;
  perform public.audit('update_finance', null, p_patch);
end $$;

create or replace function public.admin_recent_errors(p_limit integer default 50)
returns table (at timestamptz, source text, code text, message text, user_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select * from (
      select e.created_at, e.source, e.code, e.message, e.user_id from public.error_logs e
      union all
      select l.created_at, 'ai:' || l.feature::text, coalesce(l.error_code, 'error'), l.model, l.user_id
        from public.ai_usage_logs l where not l.success
      union all
      select r.received_at, 'revenuecat', r.type, r.error, null from public.revenuecat_events r where r.error is not null
    ) x order by 1 desc limit least(greatest(p_limit, 1), 200);
end $$;

-- =============================================================================
-- Croissance : agrégation quotidienne des coûts IA et rétention des journaux bruts
-- =============================================================================
create table public.ai_usage_daily (
  day            date not null,
  feature        public.ai_feature not null,
  model          text not null,
  calls          integer not null,
  failures       integer not null,
  input_tokens   bigint not null,
  output_tokens  bigint not null,
  cost_usd       numeric(12,6) not null,
  primary key (day, feature, model)
);
alter table public.ai_usage_daily enable row level security;
create policy "ai daily admin read" on public.ai_usage_daily for select to authenticated using (public.is_admin());

create or replace function public.rollup_ai_usage(p_day date) returns void
language sql security definer set search_path = '' as $$
  insert into public.ai_usage_daily (day, feature, model, calls, failures, input_tokens, output_tokens, cost_usd)
  select p_day, feature, model, count(*), count(*) filter (where not success), sum(input_tokens), sum(output_tokens), sum(cost_usd)
    from public.ai_usage_logs
   where created_at >= p_day::timestamptz and created_at < (p_day + 1)::timestamptz
   group by feature, model
  on conflict (day, feature, model) do update
    set calls = excluded.calls, failures = excluded.failures, input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens, cost_usd = excluded.cost_usd;
$$;

-- Journaux bruts conservés 13 mois (les agrégats quotidiens restent).
create or replace function public.purge_old_logs() returns void
language sql security definer set search_path = '' as $$
  delete from public.ai_usage_logs where created_at < now() - interval '13 months';
  delete from public.error_logs where created_at < now() - interval '6 months';
  delete from public.household_activity where created_at < now() - interval '3 months';
  delete from public.invitation_attempts where created_at < now() - interval '1 day';
  delete from public.revenuecat_events where processed_at is not null and received_at < now() - interval '13 months';
$$;

revoke execute on function public.rollup_ai_usage(date) from public, anon, authenticated;
revoke execute on function public.purge_old_logs() from public, anon, authenticated;
grant execute on function public.rollup_ai_usage(date) to service_role;
grant execute on function public.purge_old_logs() to service_role;

-- Index manquants révélés par le test de charge (tests/load) :
-- sans eux, chaque lecture de la liste de courses parcourait toute la table.
create index shopping_list_items_household_idx on public.shopping_list_items (household_id);
create index household_invitations_household_idx on public.household_invitations (household_id);
create index recipe_ingredients_household_idx on public.recipe_ingredients (household_id);
