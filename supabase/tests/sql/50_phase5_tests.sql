-- Phase 5 : foyer partagé, invitations, droits d'écriture, activité.
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

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d0', 'd@test.local', '{"display_name":"Dana"}'),
  ('00000000-0000-0000-0000-0000000000e0', 'e@test.local', '{"display_name":"Eli"}'),
  ('00000000-0000-0000-0000-0000000000f0', 'f@test.local', '{"display_name":"Flo"}');
select set_config('test.d_h', (select id::text from public.households where owner_id = '00000000-0000-0000-0000-0000000000d0'), false);
select set_config('test.e_h', (select id::text from public.households where owner_id = '00000000-0000-0000-0000-0000000000e0'), false);
select set_config('test.d_fridge', (select id::text from public.storage_locations where household_id = current_setting('test.d_h')::uuid and kind = 'fridge'), false);

-- Invitation : offre Famille requise ----------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
select pg_temp.expect_error($$select public.create_household_invitation(current_setting('test.d_h')::uuid)$$, 'feature_locked', 'invitation impossible sans offre Famille');
reset role;
insert into public.subscriptions (household_id, user_id, plan, period, status, current_period_end)
values (current_setting('test.d_h')::uuid, '00000000-0000-0000-0000-0000000000d0', 'family', 'monthly', 'active', now() + interval '20 days');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
select set_config('test.code', (select code from public.create_household_invitation(current_setting('test.d_h')::uuid)), false);
select pg_temp.assert(current_setting('test.code') ~ '^[A-HJ-NP-Z2-9]{8}$', 'code de 8 caractères sans caractères ambigus');

-- Rejoindre ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e0');
select pg_temp.expect_error($$select public.create_household_invitation(current_setting('test.d_h')::uuid)$$, '42501', 'un non-propriétaire ne peut pas inviter');
select pg_temp.assert(public.accept_household_invitation(lower(current_setting('test.code'))) = current_setting('test.d_h')::uuid, 'Eli rejoint le foyer de Dana (code insensible à la casse)');
select pg_temp.assert((select current_household_id = current_setting('test.d_h')::uuid from public.profiles where id = auth.uid()), 'foyer courant basculé');
select pg_temp.assert((select count(*) = 2 from public.get_household_members(current_setting('test.d_h')::uuid)), '2 membres visibles');
select pg_temp.assert((select bool_and(display_name in ('Dana', 'Eli')) from public.get_household_members(current_setting('test.d_h')::uuid)), 'noms affichés, jamais les e-mails');

insert into public.food_items (household_id, storage_location_id, name, quantity, unit)
values (current_setting('test.d_h')::uuid, current_setting('test.d_fridge')::uuid, 'Courgettes', 3, 'piece'),
       (current_setting('test.d_h')::uuid, current_setting('test.d_fridge')::uuid, 'Beurre', 1, 'pack');
select pg_temp.assert((select count(*) = 2 from public.food_items where household_id = current_setting('test.d_h')::uuid), 'stock partagé : Eli écrit dans le foyer');
select pg_temp.assert((select item_count = 2 and sample = array['Beurre', 'Courgettes'] from public.household_activity where kind = 'items_added'), 'activité groupée : 1 entrée pour 2 aliments');
select pg_temp.assert((select count(*) = 1 from public.household_activity where kind = 'member_joined'), 'arrivée journalisée');
select pg_temp.expect_error($$update public.profiles set current_household_id = current_setting('test.a_household')::uuid where id = auth.uid()$$, 'not_a_member', 'impossible de basculer vers un foyer dont on n''est pas membre');
select pg_temp.expect_error($$update public.profiles set current_household_id = null where id = auth.uid()$$, 'household_required', 'foyer courant obligatoire');

-- Code à usage unique et anti force brute
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select pg_temp.assert(public.accept_household_invitation(current_setting('test.code')) is null, 'code déjà utilisé refusé');
select pg_temp.assert((select count(*) = 9 from (select public.accept_household_invitation('ZZZZZZZZ') r from generate_series(1, 9)) x where r is null), 'codes inconnus refusés');
select pg_temp.expect_error($$select public.accept_household_invitation('ZZZZZZZZ')$$, 'too_many_attempts', 'trop d''essais : blocage temporaire');

-- Achats rangés : une seule entrée d'activité
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
select public.add_shopping_items(current_setting('test.d_h')::uuid, '[{"name":"Pommes","quantity":1,"unit":"kg"},{"name":"Riz","quantity":500,"unit":"g"}]');
select pg_temp.assert((select item_count = 2 from public.household_activity where kind = 'shopping_added'), 'liste de courses : 1 entrée d''activité');
select public.purchase_shopping_items((select jsonb_agg(jsonb_build_object('item_id', id, 'storage_location_id', current_setting('test.d_fridge'))) from public.shopping_list_items where household_id = current_setting('test.d_h')::uuid));
select pg_temp.assert((select count(*) = 1 and sum(item_count) = 2 from public.household_activity where kind = 'shopping_purchased'), 'achats rangés : 1 entrée');
select pg_temp.assert((select count(*) = 1 from public.household_activity where kind = 'items_added'), 'achats non comptés en double comme ajouts');

-- Allergies de tous les membres (serveur)
reset role;
insert into public.dietary_preferences (user_id, allergies) values ('00000000-0000-0000-0000-0000000000d0', '{Arachide}'), ('00000000-0000-0000-0000-0000000000e0', '{Gluten,Arachide}');
select pg_temp.assert(public.household_allergies(current_setting('test.d_h')::uuid) = array['Arachide', 'Gluten'], 'allergies de tout le foyer réunies');

-- Fin de l'offre Famille : le propriétaire garde la main, les membres passent en lecture seule
update public.subscriptions set status = 'expired', current_period_end = now() - interval '1 day' where user_id = '00000000-0000-0000-0000-0000000000d0';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e0');
select pg_temp.assert((select count(*) >= 2 from public.food_items where household_id = current_setting('test.d_h')::uuid), 'membre : lecture conservée');
select pg_temp.expect_error($$insert into public.food_items (household_id, storage_location_id, name) values (current_setting('test.d_h')::uuid, current_setting('test.d_fridge')::uuid, 'X')$$, '42501', 'membre : écriture bloquée sans offre Famille');
select pg_temp.expect_error($$select public.update_item_quantity((select id from public.food_items where name = 'Beurre'), 0)$$, '42501', 'membre : RPC d''écriture bloquée sans offre Famille');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
insert into public.food_items (household_id, storage_location_id, name) values (current_setting('test.d_h')::uuid, current_setting('test.d_fridge')::uuid, 'Oeufs');
select pg_temp.assert(true, 'propriétaire : écriture conservée');
reset role;
update public.subscriptions set status = 'active', current_period_end = now() + interval '20 days' where user_id = '00000000-0000-0000-0000-0000000000d0';

-- Capacité : 6 membres maximum en Famille
do $$ declare i int; v uuid; c text; begin
  for i in 1..5 loop
    v := ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid;
    insert into auth.users (id, email) values (v, 'x' || i || '@test.local');
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d0', false);
    begin
      select code into c from public.create_household_invitation(current_setting('test.d_h')::uuid);
      perform set_config('request.jwt.claim.sub', v::text, false);
      perform public.accept_household_invitation(c);
    exception when others then
      if sqlerrm <> 'household_full' then raise; end if;
    end;
  end loop;
end $$;
select pg_temp.assert(public.household_member_count(current_setting('test.d_h')::uuid) = 6, 'foyer plein à 6 membres');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
select pg_temp.expect_error($$select public.create_household_invitation(current_setting('test.d_h')::uuid)$$, 'household_full', 'invitation refusée quand le foyer est plein');

-- Retrait, départ, transfert de propriété
select public.remove_household_member(current_setting('test.d_h')::uuid, '00000000-0000-0000-0000-000000000104');
select pg_temp.assert(public.household_member_count(current_setting('test.d_h')::uuid) = 5, 'propriétaire : membre retiré');
reset role;
select pg_temp.assert((select current_household_id is not null and current_household_id <> current_setting('test.d_h')::uuid from public.profiles where id = '00000000-0000-0000-0000-000000000104'), 'membre retiré : foyer personnel recréé');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e0');
select pg_temp.expect_error($$select public.remove_household_member(current_setting('test.d_h')::uuid, '00000000-0000-0000-0000-000000000101')$$, '42501', 'un membre ne peut pas en retirer un autre');
select pg_temp.assert(public.leave_household(current_setting('test.d_h')::uuid) = current_setting('test.e_h')::uuid, 'Eli quitte le foyer et retrouve le sien');
select pg_temp.assert((select count(*) = 0 from public.food_items where household_id = current_setting('test.d_h')::uuid), 'après départ : plus d''accès au stock partagé');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
select public.leave_household(current_setting('test.d_h')::uuid);
reset role;
select pg_temp.assert((select owner_id = '00000000-0000-0000-0000-000000000101' from public.households where id = current_setting('test.d_h')::uuid), 'propriété transmise au membre le plus ancien');
select pg_temp.assert((select household_id <> current_setting('test.d_h')::uuid from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000d0'), 'l''abonnement de Dana la suit');

-- Jetons push : chacun les siens
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e0');
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[eli-token]', auth.uid(), 'ios');
select pg_temp.expect_error($$insert into public.push_tokens (token, user_id) values ('ExponentPushToken[fake]', '00000000-0000-0000-0000-0000000000d0')$$, '42501', 'impossible d''enregistrer un jeton pour un autre');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d0');
select pg_temp.assert((select count(*) = 0 from public.push_tokens), 'jetons des autres invisibles');
reset role;

select 'TESTS PHASE 5 PASSÉS' as resultat;
