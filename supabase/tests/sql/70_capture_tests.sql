-- Scanner gratuit : journal des ajouts, statistiques admin.
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); execute 'set role authenticated'; end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'ÉCHEC: %', msg; end if; raise notice 'OK: %', msg; end $$;

reset role;
delete from public.ai_usage_logs;
select set_config('test.a_h', (select current_household_id::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.capture_events (household_id, user_id, method, detected, confirmed, corrected, removed) values
  (current_setting('test.a_h')::uuid, auth.uid(), 'barcode', 10, 10, 0, 0),
  (current_setting('test.a_h')::uuid, auth.uid(), 'receipt', 10, 8, 2, 2),
  (current_setting('test.a_h')::uuid, auth.uid(), 'manual', 0, 3, 0, 0);
select pg_temp.assert((select count(*) = 0 from public.capture_events), 'journal invisible pour un utilisateur');
do $$ begin
  insert into public.capture_events (household_id, user_id, method) values (current_setting('test.a_h')::uuid, '00000000-0000-0000-0000-00000000000b', 'barcode');
  raise exception 'ÉCHEC: ajout au nom d''un autre utilisateur';
exception when insufficient_privilege then raise notice 'OK: on ne journalise que pour soi';
end $$;
insert into public.food_items (household_id, storage_location_id, name, source)
select current_setting('test.a_h')::uuid, id, 'Lait', 'receipt' from public.storage_locations where household_id = current_setting('test.a_h')::uuid limit 1;
select pg_temp.assert(true, 'source « ticket de caisse » acceptée');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select set_config('test.s', public.admin_capture_stats(current_date, current_date)::text, false);
select pg_temp.assert((current_setting('test.s')::jsonb ->> 'captures_total')::int = 3, '3 ajouts comptés');
select pg_temp.assert((current_setting('test.s')::jsonb ->> 'free_share')::numeric = 1, '100 % gratuits');
select pg_temp.assert((current_setting('test.s')::jsonb ->> 'paid_ai_cost_eur')::numeric = 0, 'coût IA payante : 0');
-- 20 propositions, 2 corrigées + 2 supprimées => 80 % reconnues correctement
select pg_temp.assert((current_setting('test.s')::jsonb ->> 'recognition_rate')::numeric = 0.8, 'taux de reconnaissance : 80 %');
select pg_temp.assert((current_setting('test.s')::jsonb #>> '{recognition_by_method,barcode}')::numeric = 1, 'codes-barres : 100 %');
select pg_temp.assert((current_setting('test.s')::jsonb #>> '{recognition_by_method,receipt}')::numeric = 0.6, 'tickets : 60 %');
reset role;
select 'TESTS SCANNER GRATUIT PASSÉS' as resultat;
