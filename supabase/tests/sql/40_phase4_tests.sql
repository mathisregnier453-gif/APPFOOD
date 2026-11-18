-- Phase 4 : droits d'accès selon l'offre, cycle de vie des abonnements.
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

reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'c@test.local');
select set_config('test.c_household', (select id::text from public.households where owner_id = '00000000-0000-0000-0000-00000000000c'), false);
insert into public.recipes (id, household_id, title) values ('00000000-0000-0000-0000-0000000000c9', current_setting('test.c_household')::uuid, 'Recette de C');
insert into public.food_items (household_id, storage_location_id, name, quantity, unit)
select current_setting('test.c_household')::uuid, id, 'Riz', 1, 'kg' from public.storage_locations
 where household_id = current_setting('test.c_household')::uuid and kind = 'pantry';

-- Offre gratuite -----------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select plan = 'free' and (features ->> 'meal_plan')::boolean = false from public.get_entitlements(current_setting('test.c_household')::uuid)), 'nouvel utilisateur : offre gratuite');
do $$ begin
  insert into public.favorites (user_id, recipe_id, household_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000c9', current_setting('test.c_household')::uuid);
  raise exception 'ÉCHEC: favori en offre gratuite';
exception when insufficient_privilege then raise notice 'OK: favoris réservés aux offres payantes';
end $$;
do $$ begin
  insert into public.meal_plans (household_id, plan_date, slot, recipe_id) values (current_setting('test.c_household')::uuid, current_date, 'dinner', '00000000-0000-0000-0000-0000000000c9');
  raise exception 'ÉCHEC: planning en offre gratuite';
exception when insufficient_privilege then raise notice 'OK: planning réservé aux offres payantes';
end $$;
select public.update_item_quantity((select id from public.food_items where name = 'Riz'), 0.5, 'consumed');
select pg_temp.assert((select count(*) = 0 from public.consumption_logs), 'historique masqué en offre gratuite');
select pg_temp.assert((select scans_limit = 3 and recipes_limit = 10 from public.get_quota_status(current_setting('test.c_household')::uuid)), 'quotas gratuits : 3 scans, 10 recettes');
reset role;
select pg_temp.assert((select count(*) = 1 from public.consumption_logs where item_name = 'Riz'), 'historique tout de même enregistré');

-- Abonnement Famille (écrit par le serveur après RevenueCat) ------------------------------
insert into public.subscriptions (household_id, user_id, plan, period, status, current_period_end, will_renew)
values (current_setting('test.c_household')::uuid, '00000000-0000-0000-0000-00000000000c', 'family', 'yearly', 'active', now() + interval '300 days', true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select plan = 'family' and max_members = 6 from public.get_entitlements(current_setting('test.c_household')::uuid)), 'Famille actif : 6 membres');
select pg_temp.assert((select scans_limit = 60 from public.get_quota_status(current_setting('test.c_household')::uuid)), 'Famille : 60 scans');
insert into public.meal_plans (household_id, plan_date, slot, recipe_id) values (current_setting('test.c_household')::uuid, current_date, 'dinner', '00000000-0000-0000-0000-0000000000c9');
insert into public.favorites (user_id, recipe_id, household_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000c9', current_setting('test.c_household')::uuid);
select pg_temp.assert((select count(*) = 1 from public.consumption_logs), 'historique visible après abonnement');
do $$ begin
  insert into public.subscriptions (household_id, user_id, plan, period, status) values (current_setting('test.c_household')::uuid, auth.uid(), 'family', 'monthly', 'active');
  raise exception 'ÉCHEC: abonnement forgé par le client';
exception when insufficient_privilege then raise notice 'OK: abonnement non modifiable par l''app';
end $$;
update public.subscriptions set current_period_end = now() + interval '10 years';
reset role;
select pg_temp.assert((select current_period_end < now() + interval '1 year' from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000c'), 'prolongation forgée sans effet');

-- Résilié : droits conservés jusqu'à la fin de la période payée
update public.subscriptions set status = 'cancelled', will_renew = false where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select plan = 'family' from public.get_entitlements(current_setting('test.c_household')::uuid)), 'résilié : Famille jusqu''à la fin de la période');
reset role;

-- Expiré : retour à l'offre gratuite, les données restent lisibles
update public.subscriptions set status = 'expired', current_period_end = now() - interval '1 day' where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select plan = 'free' from public.get_entitlements(current_setting('test.c_household')::uuid)), 'expiré : retour à l''offre gratuite');
select pg_temp.assert((select count(*) = 1 from public.meal_plans), 'planning existant toujours lisible');
select pg_temp.assert((select count(*) = 1 from public.favorites), 'favoris existants conservés');
do $$ begin
  update public.meal_plans set servings = 4;
  if (select servings from public.meal_plans limit 1) = 4 then raise exception 'ÉCHEC: planning modifiable après expiration'; end if;
  raise notice 'OK: planning en lecture seule après expiration';
exception when insufficient_privilege then raise notice 'OK: planning en lecture seule après expiration';
end $$;
select pg_temp.assert((select count(*) = 0 from public.revenuecat_events), 'journal RevenueCat invisible pour un utilisateur');
do $$ begin
  perform public.get_entitlements((select id from public.households where owner_id = '00000000-0000-0000-0000-00000000000a'));
  raise exception 'ÉCHEC: droits d''un autre foyer lisibles';
exception when insufficient_privilege then raise notice 'OK: droits d''un autre foyer inaccessibles';
end $$;
reset role;

select 'TESTS PHASE 4 PASSÉS' as resultat;
