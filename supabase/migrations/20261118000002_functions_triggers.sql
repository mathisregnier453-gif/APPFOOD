-- =============================================================================
-- Fonctions utilitaires, triggers et RPC métier
-- =============================================================================

-- updated_at automatique ------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at   before update on public.profiles   for each row execute function public.set_updated_at();
create trigger food_items_updated_at before update on public.food_items for each row execute function public.set_updated_at();

-- Helpers d'autorisation (security definer pour éviter la récursion RLS) -----
create or replace function public.is_household_member(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.shares_household_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- Garde-fou : un compte suspendu ne peut plus écrire ------------------------
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.suspended_at is null from public.profiles p where p.id = auth.uid()), false);
$$;

-- Création automatique du profil + foyer personnel à l'inscription ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
begin
  insert into public.households (name, owner_id) values ('Mon foyer', new.id)
  returning id into v_household;

  insert into public.household_members (household_id, user_id, role)
  values (v_household, new.id, 'owner');

  insert into public.storage_locations (household_id, kind, name, position) values
    (v_household, 'fridge',  'Réfrigérateur', 0),
    (v_household, 'freezer', 'Congélateur',   1),
    (v_household, 'pantry',  'Placards',      2);

  insert into public.profiles (id, display_name, current_household_id)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''), v_household);

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Offre effective d'un foyer (abonnement actif, sinon gratuit) ---------------
create or replace function public.effective_plan(p_household uuid) returns public.plan_code
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.plan
       from public.subscriptions s
      where s.household_id = p_household
        and s.status in ('active', 'in_grace_period', 'cancelled')   -- 'cancelled' = résilié mais période payée en cours
        and (s.current_period_end is null or s.current_period_end > now())
      order by case s.plan when 'family' then 3 when 'premium' then 2 else 1 end desc
      limit 1),
    'free'::public.plan_code);
$$;

create or replace function public.current_period_start() returns date
language sql stable as $$
  select date_trunc('month', now() at time zone 'utc')::date;
$$;

-- Statut de quota visible par l'utilisateur (scans restants) ----------------
create or replace function public.get_quota_status(p_household uuid)
returns table (plan public.plan_code, scans_used integer, scans_limit integer, recipes_used integer, recipes_limit integer, period_end date)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan public.plan_code;
begin
  if not public.is_household_member(p_household) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_plan := public.effective_plan(p_household);
  return query
    select v_plan,
           coalesce(q.scans_used, 0),
           pl.monthly_scan_quota,
           coalesce(q.recipes_used, 0),
           coalesce(pl.monthly_recipe_quota, pl.fair_use_recipe_cap),
           (public.current_period_start() + interval '1 month')::date
      from public.plans pl
      left join public.usage_quotas q
        on q.household_id = p_household and q.period_start = public.current_period_start()
     where pl.code = v_plan;
end $$;

-- Consommation atomique d'un scan (appelée UNIQUEMENT par le serveur) --------
-- Retourne allowed=false si le quota est atteint : jamais de dépassement facturé.
create or replace function public.consume_scan_quota(p_household uuid, p_count integer default 1)
returns table (allowed boolean, scans_used integer, scans_limit integer, plan public.plan_code)
language plpgsql security definer set search_path = '' as $$
declare
  v_plan  public.plan_code := public.effective_plan(p_household);
  v_limit integer;
  v_used  integer;
begin
  select pl.monthly_scan_quota into v_limit from public.plans pl where pl.code = v_plan;

  insert into public.usage_quotas (household_id, period_start)
  values (p_household, public.current_period_start())
  on conflict do nothing;

  update public.usage_quotas q
     set scans_used = q.scans_used + p_count, updated_at = now()
   where q.household_id = p_household
     and q.period_start = public.current_period_start()
     and q.scans_used + p_count <= v_limit
  returning q.scans_used into v_used;

  if v_used is null then
    select q.scans_used into v_used from public.usage_quotas q
     where q.household_id = p_household and q.period_start = public.current_period_start();
    return query select false, v_used, v_limit, v_plan;
  else
    return query select true, v_used, v_limit, v_plan;
  end if;
end $$;

create or replace function public.refund_scan_quota(p_household uuid, p_count integer default 1)
returns void
language sql security definer set search_path = '' as $$
  update public.usage_quotas q
     set scans_used = greatest(0, q.scans_used - p_count), updated_at = now()
   where q.household_id = p_household and q.period_start = public.current_period_start();
$$;

revoke execute on function public.consume_scan_quota(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_scan_quota(uuid, integer)  from public, anon, authenticated;
grant  execute on function public.consume_scan_quota(uuid, integer) to service_role;
grant  execute on function public.refund_scan_quota(uuid, integer)  to service_role;

-- Validation d'un scan : crée les aliments dans l'inventaire en une transaction
-- p_items : [{detection_id?, name, category_id, quantity, unit, quantity_is_estimate,
--             expiry_date, expiry_kind, storage_location_id}]
create or replace function public.confirm_scan(p_session uuid, p_items jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.scan_sessions;
  v_item    jsonb;
  v_count   integer := 0;
  v_loc     uuid;
  v_new_id  uuid;
begin
  select * into v_session from public.scan_sessions where id = p_session for update;
  if v_session.id is null or v_session.user_id <> auth.uid()
     or not public.is_household_member(v_session.household_id) or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_session.status <> 'analyzed' then
    raise exception 'scan_not_confirmable' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_loc := (v_item ->> 'storage_location_id')::uuid;
    if not exists (select 1 from public.storage_locations l
                    where l.id = v_loc and l.household_id = v_session.household_id) then
      raise exception 'invalid_storage_location' using errcode = '22023';
    end if;

    insert into public.food_items (
      household_id, storage_location_id, category_id, name, quantity, unit,
      quantity_is_estimate, expiry_date, expiry_kind, source, scan_detection_id, created_by)
    values (
      v_session.household_id, v_loc,
      coalesce(v_item ->> 'category_id', 'other'),
      left(trim(v_item ->> 'name'), 80),
      nullif(v_item ->> 'quantity', '')::numeric,
      coalesce(v_item ->> 'unit', 'piece')::public.food_unit,
      coalesce((v_item ->> 'quantity_is_estimate')::boolean, true),
      nullif(v_item ->> 'expiry_date', '')::date,
      nullif(v_item ->> 'expiry_kind', '')::public.expiry_kind,
      'scan',
      (select d.id from public.scan_detections d
        where d.id = nullif(v_item ->> 'detection_id', '')::uuid and d.session_id = p_session),
      auth.uid())
    returning id into v_new_id;

    update public.scan_detections d
       set accepted = true, food_item_id = v_new_id
     where d.id = nullif(v_item ->> 'detection_id', '')::uuid and d.session_id = p_session;

    v_count := v_count + 1;
  end loop;

  update public.scan_detections set accepted = false
   where session_id = p_session and accepted is null;

  update public.scan_sessions
     set status = 'confirmed', confirmed_at = now()
   where id = p_session;

  return v_count;
end $$;

create or replace function public.cancel_scan(p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.scan_sessions s set status = 'cancelled'
   where s.id = p_session and s.user_id = auth.uid() and s.status in ('draft', 'analyzed', 'failed');
end $$;

-- Mise à jour de quantité + historique de consommation ------------------------
-- p_new_quantity null + p_finish = true => aliment terminé
create or replace function public.update_item_quantity(
  p_item uuid, p_new_quantity numeric, p_reason public.consumption_reason default 'adjusted', p_finish boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.food_items;
begin
  select * into v_item from public.food_items where id = p_item for update;
  if v_item.id is null or not public.is_household_member(v_item.household_id) or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_new_quantity is not null and p_new_quantity < 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  insert into public.consumption_logs (household_id, food_item_id, user_id, item_name, category_id, quantity_delta, unit, reason)
  values (v_item.household_id, v_item.id, auth.uid(), v_item.name, v_item.category_id,
          case when p_finish then -v_item.quantity
               when v_item.quantity is null or p_new_quantity is null then null
               else p_new_quantity - v_item.quantity end,
          v_item.unit,
          case when p_finish and p_reason = 'adjusted' then 'finished' else p_reason end);

  update public.food_items
     set quantity = case when p_finish then coalesce(p_new_quantity, 0) else p_new_quantity end,
         quantity_is_estimate = false,
         finished_at = case when p_finish or p_new_quantity = 0 then now() else null end
   where id = p_item;
end $$;

