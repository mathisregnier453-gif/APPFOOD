-- Tests de sécurité (RLS) et de logique métier, exécutés sur une base jetable.
-- Lancement : supabase/tests/sql/run.sh
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

select pg_temp.assert((select count(*) from public.households) = 2, 'un foyer personnel créé à chaque inscription');
select pg_temp.assert((select count(*) from public.storage_locations) = 6, '3 espaces de stockage par foyer');

-- A ajoute un aliment ------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.food_items (household_id, storage_location_id, category_id, name, quantity, unit)
select p.current_household_id, l.id, 'dairy', 'Yaourt nature', 4, 'piece'
  from public.profiles p
  join public.storage_locations l on l.household_id = p.current_household_id and l.kind = 'fridge'
 where p.id = auth.uid();
select pg_temp.assert((select count(*) from public.food_items) = 1, 'A voit son aliment');

do $$ begin
  update public.profiles set is_admin = true where id = auth.uid();
  raise exception 'ÉCHEC: A a pu modifier is_admin';
exception when insufficient_privilege then raise notice 'OK: is_admin non modifiable par l''utilisateur';
end $$;

do $$ begin
  perform public.consume_scan_quota((select current_household_id from public.profiles where id = auth.uid()));
  raise exception 'ÉCHEC: quota consommable côté client';
exception when insufficient_privilege then raise notice 'OK: consume_scan_quota réservé au serveur';
end $$;

-- Isolation entre foyers -----------------------------------------------------------
reset role;
select set_config('test.a_household', (select id::text from public.households where owner_id = '00000000-0000-0000-0000-00000000000a'), false);
select set_config('test.a_location',  (select l.id::text from public.storage_locations l join public.households h on h.id = l.household_id
                                         where h.owner_id = '00000000-0000-0000-0000-00000000000a' limit 1), false);
select set_config('test.a_item', (select id::text from public.food_items limit 1), false);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.food_items) = 0, 'B ne voit pas le stock de A');
select pg_temp.assert((select count(*) from public.households) = 1, 'B ne voit que son foyer');
do $$ begin
  insert into public.food_items (household_id, storage_location_id, name)
  values (current_setting('test.a_household')::uuid, current_setting('test.a_location')::uuid, 'intrus');
  raise exception 'ÉCHEC: B a écrit dans le foyer de A';
exception when insufficient_privilege then raise notice 'OK: RLS bloque l''écriture dans un autre foyer';
end $$;
update public.food_items set name = 'piraté' where id = current_setting('test.a_item')::uuid;
do $$ begin
  perform public.update_item_quantity(current_setting('test.a_item')::uuid, 0);
  raise exception 'ÉCHEC: B a modifié un aliment de A via RPC';
exception when insufficient_privilege then raise notice 'OK: RPC protégée contre l''accès croisé';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('scan-photos', current_setting('test.a_household') || '/s/0.jpg');
  raise exception 'ÉCHEC: upload dans le dossier photo de A';
exception when insufficient_privilege then raise notice 'OK: stockage des photos isolé par foyer';
end $$;
reset role;
select pg_temp.assert((select name = 'Yaourt nature' from public.food_items where id = current_setting('test.a_item')::uuid), 'update croisé sans effet');

-- Quotas (exécutés comme le serveur) -------------------------------------------------
set role service_role;
select pg_temp.assert((select allowed from public.consume_scan_quota(current_setting('test.a_household')::uuid)), 'scan 1/3 autorisé');
select pg_temp.assert((select allowed from public.consume_scan_quota(current_setting('test.a_household')::uuid)), 'scan 2/3 autorisé');
select pg_temp.assert((select allowed from public.consume_scan_quota(current_setting('test.a_household')::uuid)), 'scan 3/3 autorisé');
select pg_temp.assert(not (select allowed from public.consume_scan_quota(current_setting('test.a_household')::uuid)), 'scan 4 refusé : quota gratuit atteint, aucun dépassement');
select public.refund_scan_quota(current_setting('test.a_household')::uuid);
select pg_temp.assert((select scans_used = 2 from public.usage_quotas), 'scan remboursé après échec IA');
reset role;

insert into public.subscriptions (household_id, user_id, plan, period, status, current_period_end)
values (current_setting('test.a_household')::uuid, '00000000-0000-0000-0000-00000000000a', 'premium', 'monthly', 'active', now() + interval '20 days');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select scans_limit = 30 and plan = 'premium' from public.get_quota_status(current_setting('test.a_household')::uuid)), 'quota Premium (30) visible par l''utilisateur');
do $$ begin
  perform public.get_quota_status((select id from public.households where owner_id = '00000000-0000-0000-0000-00000000000b'));
  raise exception 'ÉCHEC: A a lu le quota d''un autre foyer';
exception when insufficient_privilege then raise notice 'OK: quota d''un autre foyer inaccessible';
end $$;

-- Parcours de scan -----------------------------------------------------------------------
insert into public.scan_sessions (household_id, user_id, storage_kind)
values (current_setting('test.a_household')::uuid, auth.uid(), 'fridge');
do $$ begin
  insert into public.scan_sessions (household_id, user_id, storage_kind, status)
  values (current_setting('test.a_household')::uuid, auth.uid(), 'fridge', 'analyzed');
  raise exception 'ÉCHEC: session créée directement à l''état analysé';
exception when insufficient_privilege then raise notice 'OK: impossible de forger un scan analysé';
end $$;
update public.scan_sessions set status = 'analyzed';
select pg_temp.assert((select status = 'draft' from public.scan_sessions), 'le client ne peut pas changer le statut d''un scan');

reset role;
update public.scan_sessions set status = 'analyzed';
insert into public.scan_detections (session_id, household_id, name, category_id, quantity, unit, confidence)
select id, household_id, 'Lait demi-écrémé', 'dairy', null, 'l', 0.92 from public.scan_sessions;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert(public.confirm_scan(s.id, jsonb_build_array(jsonb_build_object(
    'detection_id', d.id, 'name', d.name, 'category_id', 'dairy', 'quantity', null, 'unit', 'l',
    'storage_location_id', (select l.id from public.storage_locations l where l.household_id = s.household_id and l.kind = 'fridge')))) = 1,
  'validation du scan : 1 aliment ajouté')
  from public.scan_sessions s join public.scan_detections d on d.session_id = s.id;
select pg_temp.assert((select quantity is null and quantity_is_estimate from public.food_items where name = 'Lait demi-écrémé'), 'quantité inconnue conservée à null (jamais inventée)');
select pg_temp.assert((select status = 'confirmed' from public.scan_sessions), 'session confirmée');
do $$ begin
  perform public.confirm_scan((select id from public.scan_sessions), '[]'::jsonb);
  raise exception 'ÉCHEC: double validation';
exception when invalid_parameter_value then raise notice 'OK: un scan ne peut être validé qu''une fois';
end $$;

-- Quantités & historique ------------------------------------------------------------------
select public.update_item_quantity((select id from public.food_items where name = 'Yaourt nature'), 3, 'consumed');
select pg_temp.assert((select quantity_delta = -1 from public.consumption_logs), 'consommation journalisée');
select public.update_item_quantity((select id from public.food_items where name = 'Yaourt nature'), null, 'adjusted', true);
select pg_temp.assert((select finished_at is not null from public.food_items where name = 'Yaourt nature'), 'aliment marqué terminé');

-- Compte suspendu ------------------------------------------------------------------------------
reset role;
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  insert into public.food_items (household_id, storage_location_id, name)
  select p.current_household_id, l.id, 'x' from public.profiles p
    join public.storage_locations l on l.household_id = p.current_household_id
   where p.id = auth.uid() limit 1;
  raise exception 'ÉCHEC: un compte suspendu a pu écrire';
exception when insufficient_privilege then raise notice 'OK: compte suspendu en lecture seule';
end $$;
reset role;

select 'TOUS LES TESTS SQL SONT PASSÉS' as resultat;
