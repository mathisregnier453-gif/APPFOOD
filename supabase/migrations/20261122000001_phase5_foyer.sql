-- =============================================================================
-- Phase 5 : foyer partagé (offre Famille)
-- - invitations par code à usage unique, protégées contre les essais en série ;
-- - écriture partagée réservée aux foyers dont l'offre inclut le partage
--   (le propriétaire garde toujours la main sur ses données ; les autres membres
--   passent en lecture seule si l'offre Famille s'arrête — aucune perte) ;
-- - journal d'activité alimenté par la base, notifications groupées.
-- =============================================================================

-- Droit d'écriture --------------------------------------------------------------
create or replace function public.household_write_allowed(p_household uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
     where m.household_id = p_household and m.user_id = p_user
       and (m.role = 'owner' or public.plan_has_feature(p_household, 'shared_household'))
  ) and coalesce((select p.suspended_at is null from public.profiles p where p.id = p_user), false);
$$;

create or replace function public.can_write_household(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.household_write_allowed(p_household, auth.uid());
$$;

-- Politiques d'écriture des données du foyer
do $$
declare t text;
begin
  foreach t in array array['storage_locations', 'food_items', 'consumption_logs', 'shopping_lists', 'shopping_list_items']
  loop
    execute format('drop policy if exists "%1$s member insert" on public.%1$I', t);
    execute format('drop policy if exists "%1$s member update" on public.%1$I', t);
    execute format('drop policy if exists "%1$s member delete" on public.%1$I', t);
    execute format('create policy "%1$s member insert" on public.%1$I for insert to authenticated with check (public.can_write_household(household_id))', t);
    execute format('create policy "%1$s member update" on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.can_write_household(household_id))', t);
    execute format('create policy "%1$s member delete" on public.%1$I for delete to authenticated using (public.can_write_household(household_id))', t);
  end loop;
end $$;

drop policy "recipes member delete" on public.recipes;
create policy "recipes member delete" on public.recipes for delete to authenticated using (public.can_write_household(household_id));

drop policy "meal_plans member insert" on public.meal_plans;
drop policy "meal_plans member update" on public.meal_plans;
drop policy "meal_plans member delete" on public.meal_plans;
create policy "meal_plans member insert" on public.meal_plans for insert to authenticated
  with check (public.can_write_household(household_id) and public.plan_has_feature(household_id, 'meal_plan'));
create policy "meal_plans member update" on public.meal_plans for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.can_write_household(household_id) and public.plan_has_feature(household_id, 'meal_plan'));
create policy "meal_plans member delete" on public.meal_plans for delete to authenticated
  using (public.can_write_household(household_id));

drop policy "scan sessions create draft" on public.scan_sessions;
create policy "scan sessions create draft" on public.scan_sessions for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft' and scans_consumed = 0 and public.can_write_household(household_id));

drop policy "scan photos upload" on storage.objects;
create policy "scan photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'scan-photos' and public.can_write_household(((storage.foldername(name))[1])::uuid));

-- confirm_scan : écriture réservée aux membres autorisés (1 contrôle(s) remplacé(s))
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
     or not public.can_write_household(v_session.household_id) or not public.is_active_user() then
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

-- update_item_quantity : écriture réservée aux membres autorisés (1 contrôle(s) remplacé(s))
create or replace function public.update_item_quantity(
  p_item uuid, p_new_quantity numeric, p_reason public.consumption_reason default 'adjusted', p_finish boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.food_items;
begin
  select * into v_item from public.food_items where id = p_item for update;
  if v_item.id is null or not public.can_write_household(v_item.household_id) or not public.is_active_user() then
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

-- get_active_shopping_list : écriture réservée aux membres autorisés (1 contrôle(s) remplacé(s))
create or replace function public.get_active_shopping_list(p_household uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.can_write_household(p_household) or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_id from public.shopping_lists where household_id = p_household and not is_archived;
  if v_id is null then
    insert into public.shopping_lists (household_id) values (p_household)
    on conflict (household_id) where not is_archived do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.shopping_lists where household_id = p_household and not is_archived;
    end if;
  end if;
  return v_id;
end $$;

-- purchase_shopping_items : écriture réservée aux membres autorisés (1 contrôle(s) remplacé(s))
create or replace function public.purchase_shopping_items(p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_entry jsonb;
  v_item  public.shopping_list_items;
  v_count integer := 0;
begin
  if not public.is_active_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_entry in select * from jsonb_array_elements(p_items) loop
    select * into v_item from public.shopping_list_items where id = (v_entry ->> 'item_id')::uuid for update;
    if v_item.id is null or not public.can_write_household(v_item.household_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if not exists (select 1 from public.storage_locations l
                    where l.id = (v_entry ->> 'storage_location_id')::uuid and l.household_id = v_item.household_id) then
      raise exception 'invalid_storage_location' using errcode = '22023';
    end if;

    insert into public.food_items (household_id, storage_location_id, category_id, name, quantity, unit,
                                   quantity_is_estimate, expiry_date, expiry_kind, source, created_by)
    values (v_item.household_id, (v_entry ->> 'storage_location_id')::uuid, v_item.category_id, v_item.name,
            coalesce(nullif(v_entry ->> 'quantity', '')::numeric, v_item.quantity),
            coalesce(nullif(v_entry ->> 'unit', '')::public.food_unit, v_item.unit, 'piece'),
            false,
            nullif(v_entry ->> 'expiry_date', '')::date,
            case when nullif(v_entry ->> 'expiry_date', '') is null then null
                 else nullif(v_entry ->> 'expiry_kind', '')::public.expiry_kind end,
            'shopping', auth.uid());

    delete from public.shopping_list_items where id = v_item.id;
    v_count := v_count + 1;
  end loop;
  -- Une seule entrée d'activité pour l'ensemble des achats rangés.
  if v_count > 0 then
    perform public.record_household_activity(v_item.household_id, 'shopping_purchased', v_count, '{}');
  end if;
  return v_count;
end $$;

-- cook_recipe : écriture réservée aux membres autorisés (1 contrôle(s) remplacé(s))
create or replace function public.cook_recipe(p_recipe uuid, p_deductions jsonb, p_meal_plan uuid default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_recipe public.recipes;
  v_entry  jsonb;
  v_item   public.food_items;
  v_new    numeric;
  v_finish boolean;
  v_count  integer := 0;
begin
  select * into v_recipe from public.recipes where id = p_recipe;
  if v_recipe.id is null or not public.can_write_household(v_recipe.household_id) or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_deductions) <> 'array' or jsonb_array_length(p_deductions) > 60 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_entry in select * from jsonb_array_elements(p_deductions) loop
    select * into v_item from public.food_items
     where id = (v_entry ->> 'food_item_id')::uuid and household_id = v_recipe.household_id and finished_at is null
     for update;
    if v_item.id is null then continue; end if;  -- déjà terminé entre-temps : ignoré

    v_finish := coalesce((v_entry ->> 'finish')::boolean, false);
    v_new := nullif(v_entry ->> 'new_quantity', '')::numeric;
    if v_new is not null and v_new < 0 then v_new := 0; end if;
    if v_new = 0 then v_finish := true; end if;
    if v_new is null and not v_finish then continue; end if;  -- rien à déduire

    insert into public.consumption_logs (household_id, food_item_id, user_id, item_name, category_id, quantity_delta, unit, reason, recipe_id)
    values (v_item.household_id, v_item.id, auth.uid(), v_item.name, v_item.category_id,
            case when v_finish then -v_item.quantity
                 when v_item.quantity is null or v_new is null then null
                 else v_new - v_item.quantity end,
            v_item.unit, 'recipe', p_recipe);

    update public.food_items
       set quantity = case when v_finish then 0 else v_new end,
           quantity_is_estimate = case when v_finish or v_new is not null then false else quantity_is_estimate end,
           finished_at = case when v_finish then now() else null end
     where id = v_item.id;
    v_count := v_count + 1;
  end loop;

  if p_meal_plan is not null then
    update public.meal_plans set is_cooked = true
     where id = p_meal_plan and household_id = v_recipe.household_id;
  end if;
  return v_count;
end $$;

-- =============================================================================
-- Gestion des membres
-- =============================================================================

-- Le foyer courant doit toujours être un foyer dont l'utilisateur est membre.
create or replace function public.check_current_household() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.current_household_id is null then
    raise exception 'household_required' using errcode = '23502';
  end if;
  if not exists (
    select 1 from public.household_members m where m.household_id = new.current_household_id and m.user_id = new.id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_current_household_check before update of current_household_id on public.profiles
  for each row execute function public.check_current_household();

create or replace function public.create_personal_household(p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_household uuid;
begin
  insert into public.households (name, owner_id) values ('Mon foyer', p_user) returning id into v_household;
  insert into public.household_members (household_id, user_id, role) values (v_household, p_user, 'owner');
  insert into public.storage_locations (household_id, kind, name, position) values
    (v_household, 'fridge', 'Réfrigérateur', 0), (v_household, 'freezer', 'Congélateur', 1), (v_household, 'pantry', 'Placards', 2);
  return v_household;
end $$;
revoke execute on function public.create_personal_household(uuid) from public, anon, authenticated;

-- Essais de codes (anti force brute) : 10 échecs par heure maximum.
create table public.invitation_attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index invitation_attempts_user_idx on public.invitation_attempts (user_id, created_at desc);
alter table public.invitation_attempts enable row level security;  -- aucune policy : serveur uniquement

create or replace function public.household_member_count(p_household uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.household_members where household_id = p_household;
$$;

-- Invitation : propriétaire uniquement, offre avec partage, place disponible.
create or replace function public.create_household_invitation(p_household uuid)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sans 0/O ni 1/I
  v_code text;
  v_max  integer;
begin
  if not public.is_household_owner(p_household) or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.plan_has_feature(p_household, 'shared_household') then
    raise exception 'feature_locked' using errcode = 'P0001';
  end if;
  select pl.max_members into v_max from public.plans pl where pl.code = public.effective_plan(p_household);
  if public.household_member_count(p_household) >= v_max then
    raise exception 'household_full' using errcode = 'P0001';
  end if;

  -- Un seul code actif à la fois : l'ancien est révoqué.
  delete from public.household_invitations i
   where i.household_id = p_household and i.accepted_at is null;

  loop
    v_code := '';
    for i in 1..8 loop
      -- octet aléatoire issu de gen_random_uuid() (CSPRNG, intégré à PostgreSQL)
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.household_invitations x where x.code = v_code);
  end loop;

  insert into public.household_invitations (household_id, code, created_by, expires_at)
  values (p_household, v_code, auth.uid(), now() + interval '7 days');
  return query select v_code, now() + interval '7 days';
end $$;

create or replace function public.revoke_household_invitation(p_household uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_household_owner(p_household) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.household_invitations where household_id = p_household and accepted_at is null;
end $$;

-- Rejoindre un foyer avec un code. Renvoie l'id du foyer, ou NULL si le code est invalide.
create or replace function public.accept_household_invitation(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.household_invitations;
  v_max integer;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from public.invitation_attempts a
       where a.user_id = auth.uid() and a.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  select * into v_inv from public.household_invitations i
   where i.code = v_code and i.accepted_at is null and i.expires_at > now()
   for update;
  if v_inv.id is null then
    -- Pas d'exception ici : elle annulerait l'enregistrement de l'essai (anti force brute).
    insert into public.invitation_attempts (user_id) values (auth.uid());
    return null;  -- code invalide, expiré ou déjà utilisé
  end if;
  if exists (select 1 from public.household_members m where m.household_id = v_inv.household_id and m.user_id = auth.uid()) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  if not public.plan_has_feature(v_inv.household_id, 'shared_household') then
    raise exception 'feature_locked' using errcode = 'P0001';
  end if;
  select pl.max_members into v_max from public.plans pl where pl.code = public.effective_plan(v_inv.household_id);
  if public.household_member_count(v_inv.household_id) >= v_max then
    raise exception 'household_full' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role) values (v_inv.household_id, auth.uid(), 'member');
  update public.household_invitations set accepted_by = auth.uid(), accepted_at = now() where id = v_inv.id;
  update public.profiles set current_household_id = v_inv.household_id where id = auth.uid();
  insert into public.household_activity (household_id, actor_id, kind, item_count)
  values (v_inv.household_id, auth.uid(), 'member_joined', 1);
  return v_inv.household_id;
end $$;

-- Quitter un foyer : le propriétaire transmet la propriété au membre le plus ancien.
-- Un utilisateur a toujours au moins un foyer (un foyer personnel est recréé si besoin).
create or replace function public.leave_household(p_household uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me    uuid := auth.uid();
  v_role  public.household_role;
  v_heir  uuid;
  v_next  uuid;
begin
  select role into v_role from public.household_members where household_id = p_household and user_id = v_me;
  if v_role is null then raise exception 'forbidden' using errcode = '42501'; end if;

  select user_id into v_heir from public.household_members
   where household_id = p_household and user_id <> v_me order by joined_at limit 1;
  if v_heir is null then raise exception 'last_member' using errcode = 'P0001'; end if;  -- seul membre : rien à quitter

  if v_role = 'owner' then
    update public.household_members set role = 'owner' where household_id = p_household and user_id = v_heir;
    update public.households set owner_id = v_heir where id = p_household;
  end if;
  delete from public.household_members where household_id = p_household and user_id = v_me;
  insert into public.household_activity (household_id, actor_id, kind, item_count) values (p_household, v_me, 'member_left', 1);

  select household_id into v_next from public.household_members where user_id = v_me order by joined_at limit 1;
  if v_next is null then v_next := public.create_personal_household(v_me); end if;
  update public.profiles set current_household_id = v_next
   where id = v_me and (current_household_id is null or current_household_id = p_household);
  -- Un abonnement payé par ce membre suit son foyer courant.
  update public.subscriptions set household_id = v_next where user_id = v_me and household_id = p_household;
  return v_next;
end $$;

create or replace function public.remove_household_member(p_household uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_next uuid;
begin
  if not public.is_household_owner(p_household) or p_user = auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.household_members where household_id = p_household and user_id = p_user and role = 'member';
  if not found then raise exception 'not_a_member' using errcode = 'P0001'; end if;

  select household_id into v_next from public.household_members where user_id = p_user order by joined_at limit 1;
  if v_next is null then v_next := public.create_personal_household(p_user); end if;
  update public.profiles set current_household_id = v_next where id = p_user and current_household_id = p_household;
  update public.subscriptions set household_id = v_next where user_id = p_user and household_id = p_household;
  insert into public.household_activity (household_id, actor_id, kind, item_count) values (p_household, p_user, 'member_left', 1);
end $$;

-- Liste des membres (nom affiché uniquement : jamais l'e-mail des autres membres).
create or replace function public.get_household_members(p_household uuid)
returns table (user_id uuid, display_name text, role public.household_role, joined_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_household_member(p_household) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select m.user_id, coalesce(nullif(p.display_name, ''), 'Membre'), m.role, m.joined_at, m.user_id = auth.uid()
      from public.household_members m join public.profiles p on p.id = m.user_id
     where m.household_id = p_household order by m.joined_at;
end $$;

-- Foyers de l'utilisateur (pour changer de foyer courant).
create or replace function public.get_my_households()
returns table (household_id uuid, name text, role public.household_role, member_count integer, plan public.plan_code)
language sql stable security definer set search_path = '' as $$
  select h.id, h.name, m.role, public.household_member_count(h.id), public.effective_plan(h.id)
    from public.household_members m join public.households h on h.id = m.household_id
   where m.user_id = auth.uid() order by m.joined_at;
$$;

-- Allergies de TOUS les membres (sécurité des recettes dans un foyer partagé). Serveur uniquement.
create or replace function public.household_allergies(p_household uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct a), '{}')
    from public.household_members m
    join public.dietary_preferences d on d.user_id = m.user_id,
         unnest(d.allergies) a
   where m.household_id = p_household;
$$;
revoke execute on function public.household_allergies(uuid) from public, anon, authenticated;

-- =============================================================================
-- Activité du foyer (fil + notifications groupées)
-- =============================================================================
create table public.household_activity (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  actor_id      uuid references auth.users (id) on delete set null,
  kind          text not null check (kind in ('items_added', 'shopping_added', 'shopping_purchased', 'member_joined', 'member_left')),
  item_count    integer not null default 1,
  sample        text[] not null default '{}',
  created_at    timestamptz not null default now(),
  notified_at   timestamptz
);
create index household_activity_feed_idx on public.household_activity (household_id, created_at desc);
create index household_activity_pending_idx on public.household_activity (created_at) where notified_at is null;
alter table public.household_activity enable row level security;
create policy "activity member read" on public.household_activity for select to authenticated
  using (public.is_household_member(household_id));

-- Triggers de niveau instruction : une ligne d'activité par action (un scan de
-- 20 produits = 1 entrée), uniquement dans les foyers de plusieurs membres.
-- Fusion : les ajouts successifs d'une même personne (boucles d'une RPC, ajouts
-- rapprochés) sont regroupés dans une entrée non encore notifiée de moins de 2 minutes.
create or replace function public.record_household_activity(p_household uuid, p_kind text, p_count integer, p_sample text[])
returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_count <= 0 or public.household_member_count(p_household) <= 1 then return; end if;
  select id into v_id from public.household_activity
   where household_id = p_household and actor_id is not distinct from auth.uid() and kind = p_kind
     and notified_at is null and created_at > now() - interval '2 minutes'
   order by created_at desc limit 1 for update;
  if v_id is null then
    insert into public.household_activity (household_id, actor_id, kind, item_count, sample)
    values (p_household, auth.uid(), p_kind, p_count, coalesce(p_sample[1:3], '{}'));
  else
    update public.household_activity
       set item_count = item_count + p_count, sample = (sample || coalesce(p_sample, '{}'))[1:3]
     where id = v_id;
  end if;
end $$;
revoke execute on function public.record_household_activity(uuid, text, integer, text[]) from public, anon, authenticated;

create or replace function public.log_household_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select t.household_id, count(*)::integer as n, (array_agg(t.name order by t.name))[1:3] as sample
      from changed t
     where (to_jsonb(t) ->> 'source') is distinct from 'shopping'  -- achats : journalisés à part
     group by t.household_id
  loop
    perform public.record_household_activity(r.household_id, tg_argv[0], r.n, r.sample);
  end loop;
  return null;
end $$;

create trigger food_items_activity after insert on public.food_items
  referencing new table as changed for each statement execute function public.log_household_activity('items_added');
create trigger shopping_items_activity after insert on public.shopping_list_items
  referencing new table as changed for each statement execute function public.log_household_activity('shopping_added');

-- Jetons de notification push (Expo). Chaque utilisateur gère les siens.
create table public.push_tokens (
  token       text primary key check (char_length(token) between 10 and 200),
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text check (platform in ('ios', 'android')),
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "push tokens own" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.household_activity;
