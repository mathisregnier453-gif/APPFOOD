-- Phase 2 : recettes, quota de recettes, favoris. S'exécute après 10_rls_tests.sql.
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
update public.profiles set suspended_at = null;
select set_config('test.b_household', (select id::text from public.households where owner_id = '00000000-0000-0000-0000-00000000000b'), false);

-- Quota gratuit : 10 recettes, accordé partiellement, jamais dépassé
set role service_role;
select pg_temp.assert((select granted = 4 from public.consume_recipe_quota(current_setting('test.b_household')::uuid, 4)), 'recettes 1-4 accordées');
select pg_temp.assert((select granted = 4 from public.consume_recipe_quota(current_setting('test.b_household')::uuid, 4)), 'recettes 5-8 accordées');
select pg_temp.assert((select granted = 2 and recipes_used = 10 from public.consume_recipe_quota(current_setting('test.b_household')::uuid, 4)), 'seulement 2 accordées (reste du quota gratuit)');
select pg_temp.assert((select granted = 0 and recipes_used = 10 from public.consume_recipe_quota(current_setting('test.b_household')::uuid, 3)), 'quota atteint : 0 accordée, aucun dépassement');
select public.refund_recipe_quota(current_setting('test.b_household')::uuid, 1);
select pg_temp.assert((select recipes_used = 9 from public.usage_quotas where household_id = current_setting('test.b_household')::uuid), 'recette non livrée remboursée');
reset role;

-- Le client ne peut pas consommer le quota ni forger une recette
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  perform public.consume_recipe_quota(current_setting('test.b_household')::uuid, 1);
  raise exception 'ÉCHEC: quota recettes consommable côté client';
exception when insufficient_privilege then raise notice 'OK: consume_recipe_quota réservé au serveur';
end $$;
do $$ begin
  insert into public.recipes (household_id, title) values (current_setting('test.b_household')::uuid, 'fausse recette');
  raise exception 'ÉCHEC: recette insérée par le client';
exception when insufficient_privilege then raise notice 'OK: seules les recettes générées par le serveur existent';
end $$;
reset role;

-- Favoris = fonction Premium (phase 4) : B s'abonne.
insert into public.subscriptions (household_id, user_id, plan, period, status, current_period_end)
values (current_setting('test.b_household')::uuid, '00000000-0000-0000-0000-00000000000b', 'premium', 'monthly', 'active', now() + interval '20 days');

-- Recette générée (serveur) pour B, puis favoris
insert into public.recipes (id, household_id, title, steps) values
  ('00000000-0000-0000-0000-0000000000b1', current_setting('test.b_household')::uuid, 'Soupe', '["Cuire"]');
insert into public.recipe_ingredients (recipe_id, household_id, name, is_staple)
values ('00000000-0000-0000-0000-0000000000b1', current_setting('test.b_household')::uuid, 'sel', true);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.favorites (user_id, recipe_id, household_id)
values (auth.uid(), '00000000-0000-0000-0000-0000000000b1', current_setting('test.b_household')::uuid);
select pg_temp.assert((select count(*) = 1 from public.favorites), 'B ajoute un favori');
select pg_temp.assert((select count(*) = 1 from public.recipe_ingredients where is_staple), 'B lit les ingrédients de sa recette');
do $$ begin
  update public.recipe_ingredients set name = 'x';
  raise notice 'OK: (aucune policy update) modification ignorée';
end $$;
reset role;
select pg_temp.assert((select name = 'sel' from public.recipe_ingredients), 'ingrédients non modifiables par le client');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) = 0 from public.recipes where household_id = current_setting('test.b_household')::uuid), 'A ne voit pas les recettes de B');
do $$ begin
  insert into public.favorites (user_id, recipe_id, household_id)
  values (auth.uid(), '00000000-0000-0000-0000-0000000000b1', current_setting('test.b_household')::uuid);
  raise exception 'ÉCHEC: A a mis en favori une recette de B';
exception when insufficient_privilege then raise notice 'OK: favori impossible sur la recette d''un autre foyer';
end $$;
reset role;

select 'TESTS PHASE 2 PASSÉS' as resultat;
