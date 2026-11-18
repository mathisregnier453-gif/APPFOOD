-- Phase 3 : courses, achats, recette cuisinée, planning, cache produits.
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
select set_config('test.b_fridge', (select id::text from public.storage_locations where household_id = current_setting('test.b_household')::uuid and kind = 'fridge'), false);

-- Liste de courses ------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert(public.get_active_shopping_list(current_setting('test.b_household')::uuid) = public.get_active_shopping_list(current_setting('test.b_household')::uuid), 'une seule liste active par foyer');

select public.add_shopping_items(current_setting('test.b_household')::uuid,
  '[{"name":"Tomates","quantity":500,"unit":"g","category_id":"vegetables"},{"name":"tomates ","quantity":200,"unit":"g","category_id":"vegetables"},{"name":"Persil","category_id":"vegetables"},{"name":"persil"}]');
select pg_temp.assert((select count(*) = 2 from public.shopping_list_items), 'doublons fusionnés (casse, espaces, unité inconnue)');
select pg_temp.assert((select quantity = 700 from public.shopping_list_items where normalized_name = 'tomates'), 'mode somme : 500 g + 200 g');

update public.shopping_list_items set is_checked = true where normalized_name = 'tomates';
select public.add_shopping_items(current_setting('test.b_household')::uuid, '[{"name":"Tomates","quantity":300,"unit":"g"}]', 'max');
select pg_temp.assert((select quantity = 700 and is_checked from public.shopping_list_items where normalized_name = 'tomates'), 'mode max (planning régénéré) : pas de double comptage');

-- Achat => stock
select pg_temp.assert(public.purchase_shopping_items(jsonb_build_array(jsonb_build_object(
  'item_id', (select id from public.shopping_list_items where normalized_name = 'tomates'),
  'storage_location_id', current_setting('test.b_fridge')))) = 1, 'achat ajouté au stock');
select pg_temp.assert((select quantity = 700 and unit = 'g' and source = 'shopping' from public.food_items where name = 'Tomates'), 'quantité et unité reprises de la liste');
select pg_temp.assert((select count(*) = 1 from public.shopping_list_items), 'article acheté retiré de la liste');

-- Recette cuisinée => déduction
reset role;
insert into public.recipes (id, household_id, title, steps) values
  ('00000000-0000-0000-0000-0000000000b2', current_setting('test.b_household')::uuid, 'Salade', '["Couper"]');
insert into public.meal_plans (id, household_id, plan_date, slot, recipe_id) values
  ('00000000-0000-0000-0000-0000000000c1', current_setting('test.b_household')::uuid, current_date, 'dinner', '00000000-0000-0000-0000-0000000000b2');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert(public.cook_recipe('00000000-0000-0000-0000-0000000000b2', jsonb_build_array(
    jsonb_build_object('food_item_id', (select id from public.food_items where name = 'Tomates'), 'new_quantity', 400)),
  '00000000-0000-0000-0000-0000000000c1') = 1, 'recette cuisinée : 1 ingrédient déduit');
select pg_temp.assert((select quantity = 400 from public.food_items where name = 'Tomates'), 'stock : 700 g -> 400 g');
select pg_temp.assert((select reason = 'recipe' and quantity_delta = -300 and recipe_id = '00000000-0000-0000-0000-0000000000b2' from public.consumption_logs where item_name = 'Tomates'), 'consommation journalisée avec la recette');
select pg_temp.assert((select is_cooked from public.meal_plans where id = '00000000-0000-0000-0000-0000000000c1'), 'repas marqué cuisiné');

-- Planning : une recette d'un autre foyer est refusée
do $$ begin
  insert into public.meal_plans (household_id, plan_date, slot, recipe_id)
  values (current_setting('test.b_household')::uuid, current_date + 1, 'lunch', (select id from public.recipes limit 1 offset 0));
  raise notice 'OK: recette du foyer acceptée dans le planning';
end $$;
reset role;
select set_config('test.a_household', (select id::text from public.households where owner_id = '00000000-0000-0000-0000-00000000000a'), false);
insert into public.recipes (id, household_id, title) values ('00000000-0000-0000-0000-0000000000a9', current_setting('test.a_household')::uuid, 'Recette de A');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  insert into public.meal_plans (household_id, plan_date, slot, recipe_id)
  values (current_setting('test.b_household')::uuid, current_date + 2, 'lunch', '00000000-0000-0000-0000-0000000000a9');
  raise exception 'ÉCHEC: recette d''un autre foyer planifiée';
exception when invalid_parameter_value then raise notice 'OK: recette d''un autre foyer refusée dans le planning';
end $$;

-- Accès croisé : A ne peut ni lire la liste, ni acheter, ni cuisiner pour B
reset role;
select set_config('test.b_list_item', (select id::text from public.shopping_list_items limit 1), false);
select set_config('test.b_tomates', (select id::text from public.food_items where name = 'Tomates'), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) = 0 from public.shopping_list_items), 'A ne voit pas la liste de B');
do $$ begin
  perform public.add_shopping_items(current_setting('test.b_household')::uuid, '[{"name":"Intrus"}]');
  raise exception 'ÉCHEC: A a écrit dans la liste de B';
exception when insufficient_privilege then raise notice 'OK: liste de courses d''un autre foyer protégée';
end $$;
do $$ begin
  perform public.purchase_shopping_items(jsonb_build_array(jsonb_build_object('item_id', current_setting('test.b_list_item'), 'storage_location_id', current_setting('test.b_fridge'))));
  raise exception 'ÉCHEC: A a acheté un article de B';
exception when insufficient_privilege then raise notice 'OK: achat sur la liste d''un autre foyer refusé';
end $$;
do $$ begin
  perform public.cook_recipe('00000000-0000-0000-0000-0000000000b2', jsonb_build_array(jsonb_build_object('food_item_id', current_setting('test.b_tomates'), 'finish', true)));
  raise exception 'ÉCHEC: A a cuisiné une recette de B';
exception when insufficient_privilege then raise notice 'OK: déduction impossible sur le stock d''un autre foyer';
end $$;
-- A cuisine SA recette mais tente de déduire un aliment de B : ignoré
select pg_temp.assert(public.cook_recipe('00000000-0000-0000-0000-0000000000a9', jsonb_build_array(jsonb_build_object('food_item_id', current_setting('test.b_tomates'), 'finish', true))) = 0, 'aliment d''un autre foyer ignoré lors de la déduction');
reset role;
select pg_temp.assert((select finished_at is null and quantity = 400 from public.food_items where name = 'Tomates'), 'stock de B intact');

-- Cache produits : lecture seule pour les utilisateurs
insert into public.product_cache (barcode, found, name) values ('3017620422003', true, 'Pâte à tartiner');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) = 1 from public.product_cache), 'cache produits lisible');
do $$ begin
  insert into public.product_cache (barcode, found) values ('12345678', false);
  raise exception 'ÉCHEC: cache produits modifiable par le client';
exception when insufficient_privilege then raise notice 'OK: cache produits alimenté uniquement par le serveur';
end $$;
reset role;

select 'TESTS PHASE 3 PASSÉS' as resultat;
