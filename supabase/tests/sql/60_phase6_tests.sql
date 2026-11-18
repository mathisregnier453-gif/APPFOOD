-- Phase 6 : administration, indicateurs financiers, journalisation.
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ÉCHEC: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create or replace function pg_temp.expect_error(sql text, expected text, msg text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC (aucune erreur): %', msg;
exception when others then
  if sqlerrm like 'ÉCHEC%' then raise; end if;
  if position(expected in sqlerrm) = 0 and sqlstate <> expected then raise exception 'ÉCHEC: % (erreur inattendue: % %)', msg, sqlstate, sqlerrm; end if;
  raise notice 'OK: %', msg;
end $$;

-- Base propre et connue pour vérifier les calculs
reset role;
delete from public.ai_usage_logs;
delete from public.subscriptions;
update public.finance_settings set vat_rate = 0.20, store_commission_rate = 0.15, eur_per_usd = 1, hosting_cost_monthly_cents = 0;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ad', 'admin@test.local');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select set_config('test.a_h', (select current_household_id::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), false);
select set_config('test.b_h', (select current_household_id::text from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), false);

-- 2 abonnés Premium mensuels (dont 1 sandbox, exclu), 1 Famille annuel
insert into public.subscriptions (household_id, user_id, plan, period, status, current_period_end, price_paid_cents, is_sandbox) values
  (current_setting('test.a_h')::uuid, '00000000-0000-0000-0000-00000000000a', 'premium', 'monthly', 'active', now() + interval '10 days', 499, false),
  (current_setting('test.b_h')::uuid, '00000000-0000-0000-0000-00000000000b', 'family', 'yearly', 'cancelled', now() + interval '100 days', 6710, false),
  ((select current_household_id from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), '00000000-0000-0000-0000-00000000000c', 'premium', 'monthly', 'active', now() + interval '10 days', 499, true);

-- Coûts IA du jour : A (payant) 10 scans à 0,01 $ ; utilisateur gratuit (E) 1 scan à 0,01 $ + 1 échec ; A 1 recette à 0,05 $
insert into public.ai_usage_logs (user_id, household_id, feature, provider, model, cost_usd, success)
select '00000000-0000-0000-0000-00000000000a', current_setting('test.a_h')::uuid, 'scan', 'anthropic', 'm', 0.01, true from generate_series(1, 10);
insert into public.ai_usage_logs (user_id, household_id, feature, provider, model, cost_usd, success) values
  ('00000000-0000-0000-0000-0000000000e0', (select current_household_id from public.profiles where id = '00000000-0000-0000-0000-0000000000e0'), 'scan', 'anthropic', 'm', 0.01, true),
  ('00000000-0000-0000-0000-0000000000e0', (select current_household_id from public.profiles where id = '00000000-0000-0000-0000-0000000000e0'), 'scan', 'anthropic', 'm', 0, false),
  ('00000000-0000-0000-0000-00000000000a', current_setting('test.a_h')::uuid, 'recipe', 'anthropic', 'm', 0.05, true);

-- Accès refusé aux non-administrateurs
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($$select public.admin_dashboard(current_date, current_date)$$, '42501', 'tableau de bord refusé à un utilisateur');
select pg_temp.expect_error($$select * from public.admin_list_users()$$, '42501', 'liste des utilisateurs refusée à un utilisateur');
select pg_temp.expect_error($$select public.admin_set_suspension('00000000-0000-0000-0000-00000000000b', true)$$, '42501', 'suspension refusée à un utilisateur');
select pg_temp.assert((select count(*) = 0 from public.finance_settings), 'paramètres financiers invisibles');

-- Tableau de bord (administrateur)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select set_config('test.d', public.admin_dashboard(current_date, current_date)::text, false);
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{subscriptions,premium}')::int = 1, 'abonnés Premium : 1 (sandbox exclu)');
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{subscriptions,family}')::int = 1, 'abonnés Famille : 1 (résilié mais encore payé)');
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{subscriptions,not_renewing}')::int = 1, 'abonnés qui ne renouvelleront pas : 1');
-- MRR brut = 4,99 + 67,10/12 = 10,58 € ; net = 10,58 / 1,2 × 0,85 = 7,50 €
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{revenue,mrr_gross_eur}')::numeric = 10.58, 'MRR brut = 10,58 €');
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{revenue,mrr_net_eur}')::numeric = 7.50, 'MRR net (TVA et commission déduites) = 7,50 €');
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{ai,scans}')::int = 11, 'scans réussis : 11');
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{ai,cost_eur}')::numeric = 0.16, 'coût IA total : 0,16 €');
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{ai,cost_per_scan_eur}')::numeric = 0.01, 'coût moyen par scan : 0,01 €');
-- IA des foyers payants (0,15 €) / 2 abonnés × 30 jours / 1 jour = 2,25 €
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{ai,cost_per_paying_sub_month_eur}')::numeric = 2.25, 'coût IA par abonné (mensualisé) : 2,25 €');
-- Premium net = 4,99 / 1,2 × 0,85 = 3,53 € ; marge = 3,53 - 2,25 = 1,28 €
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{margin,premium_net_price_eur}')::numeric = 3.53, 'prix Premium net : 3,53 €');
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{margin,per_premium_sub_month_eur}')::numeric = 1.28, 'marge estimée par abonné : 1,28 € (sous l''objectif)');
select pg_temp.assert((current_setting('test.d')::jsonb #>> '{errors,ai_failures}')::int = 1, 'échecs IA comptés');
select pg_temp.assert((current_setting('test.d')::jsonb -> 'anomalies' -> 'top_users' -> 0 ->> 'email') = 'a@test.local', 'utilisateur le plus coûteux identifié');
select pg_temp.assert(jsonb_array_length(current_setting('test.d')::jsonb #> '{ai,by_feature}') = 2, 'coûts par fonctionnalité');

-- Utilisateurs, suspension, geste commercial, offres
select pg_temp.assert((select plan = 'premium' and ai_cost_month_eur = 0.15 from public.admin_list_users('a@') limit 1), 'fiche utilisateur : offre et coût IA du mois');
select public.admin_set_suspension('00000000-0000-0000-0000-0000000000e0', true, 'abus de scans');
select pg_temp.assert((select suspended from public.admin_list_users('e@')), 'compte suspendu');
select pg_temp.expect_error($$select public.admin_set_suspension(auth.uid(), true)$$, 'cannot_suspend_self', 'un admin ne peut pas se suspendre lui-même');
select public.admin_gift_scans(current_setting('test.a_h')::uuid, 2);
select public.admin_update_plan('premium', '{"monthly_scan_quota": 35, "features": {"favorites": true}}');
select pg_temp.assert((select monthly_scan_quota = 35 from public.plans where code = 'premium'), 'quota Premium modifié');
select pg_temp.expect_error($$select public.admin_update_plan('premium', '{"max_photos_per_scan": 50}')$$, 'invalid_plan_values', 'valeurs d''offre invalides refusées');
select pg_temp.expect_error($$select public.admin_update_finance('{"vat_rate": 2}')$$, 'invalid_finance_values', 'paramètres financiers invalides refusés');
select pg_temp.assert((select count(*) = 3 from public.admin_audit_log), 'actions administrateur réussies journalisées (3)');
select pg_temp.assert((select count(*) >= 1 from public.admin_recent_errors()), 'erreurs récentes consultables');
reset role;
update public.plans set monthly_scan_quota = 30 where code = 'premium';
update public.profiles set suspended_at = null;

-- Agrégation quotidienne et rétention
select public.rollup_ai_usage(current_date);
select pg_temp.assert((select calls = 12 and failures = 1 from public.ai_usage_daily where feature = 'scan'), 'agrégat quotidien des coûts IA');
insert into public.ai_usage_logs (feature, provider, model, success, created_at) values ('scan', 'anthropic', 'm', true, now() - interval '14 months');
select public.purge_old_logs();
select pg_temp.assert((select count(*) = 0 from public.ai_usage_logs where created_at < now() - interval '13 months'), 'journaux de plus de 13 mois purgés');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.touch_last_active();
reset role;
select pg_temp.assert((select last_active_at is not null from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'dernière activité enregistrée');

select 'TESTS PHASE 6 PASSÉS' as resultat;
