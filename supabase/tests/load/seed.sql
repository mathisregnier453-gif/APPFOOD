-- Jeu de données de CHARGE (base de test jetable uniquement, jamais en production).
-- 10 000 utilisateurs/foyers, 30 aliments chacun, listes de courses, journaux IA.
\set ON_ERROR_STOP on
insert into auth.users (id, email)
select gen_random_uuid(), 'load' || n || '@test.local' from generate_series(1, 10000) n;

create table public.load_users as
select row_number() over (order by p.created_at, p.id) as n, p.id, p.current_household_id as household
  from public.profiles p join auth.users u on u.id = p.id where u.email like 'load%';
create unique index on public.load_users (n);

insert into public.food_items (household_id, storage_location_id, category_id, name, quantity, unit, expiry_date)
select l.household, sl.id, (array['fruits','vegetables','dairy','meat','starches','canned'])[1 + (i % 6)],
       'Produit ' || i, 1 + (i % 5), 'piece',
       case when i % 3 = 0 then current_date + (i % 20) end
  from public.load_users l
  join public.storage_locations sl on sl.household_id = l.household and sl.kind = 'fridge'
  cross join generate_series(1, 30) i;

insert into public.shopping_lists (household_id) select household from public.load_users;
insert into public.shopping_list_items (list_id, household_id, name)
select s.id, s.household_id, 'Article ' || i from public.shopping_lists s cross join generate_series(1, 8) i
 where s.household_id in (select household from public.load_users);

insert into public.ai_usage_logs (user_id, household_id, feature, provider, model, cost_usd, success, created_at)
select l.id, l.household, 'scan', 'anthropic', 'm', 0.002, true, now() - (i || ' hours')::interval
  from public.load_users l cross join generate_series(1, 10) i;
analyze;
