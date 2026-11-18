-- =============================================================================
-- Sécurité : RLS sur TOUTES les tables + stockage privé des photos
-- Principe : un utilisateur ne voit que les données des foyers dont il est
-- membre. Les tables sensibles (quotas, abonnements, coûts IA) ne sont
-- modifiables que par le serveur (service_role, qui contourne RLS).
-- =============================================================================

alter table public.food_categories       enable row level security;
alter table public.plans                 enable row level security;
alter table public.profiles              enable row level security;
alter table public.households            enable row level security;
alter table public.household_members     enable row level security;
alter table public.household_invitations enable row level security;
alter table public.storage_locations     enable row level security;
alter table public.food_items            enable row level security;
alter table public.consumption_logs      enable row level security;
alter table public.scan_sessions         enable row level security;
alter table public.scan_photos           enable row level security;
alter table public.scan_detections       enable row level security;
alter table public.dietary_preferences   enable row level security;
alter table public.recipes               enable row level security;
alter table public.recipe_ingredients    enable row level security;
alter table public.favorites             enable row level security;
alter table public.meal_plans            enable row level security;
alter table public.shopping_lists        enable row level security;
alter table public.shopping_list_items   enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.usage_quotas          enable row level security;
alter table public.ai_usage_logs         enable row level security;

-- Référentiels ----------------------------------------------------------------
create policy "categories readable" on public.food_categories for select to authenticated using (true);
create policy "plans readable"      on public.plans           for select to authenticated using (true);

-- Profils ---------------------------------------------------------------------
create policy "profile self read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household_with(id) or public.is_admin());
create policy "profile self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Les colonnes sensibles (is_admin, suspended_*) ne sont pas modifiables par l'utilisateur.
revoke update on public.profiles from authenticated;
grant update (display_name, locale, current_household_id, household_size, notification_prefs,
              expiry_alert_days, privacy_consent_at) on public.profiles to authenticated;

-- Foyers ----------------------------------------------------------------------
create policy "household member read" on public.households for select to authenticated
  using (public.is_household_member(id) or public.is_admin());
create policy "household owner update" on public.households for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));

create policy "members read" on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
create policy "owner removes member or self leaves" on public.household_members for delete to authenticated
  using ((public.is_household_owner(household_id) and role <> 'owner') or (user_id = auth.uid() and role <> 'owner'));
-- L'ajout de membres passe par une RPC d'invitation (phase 5), jamais en insert direct.

create policy "invitations owner" on public.household_invitations for all to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id) and created_by = auth.uid());

-- Données du foyer : CRUD complet pour les membres actifs ----------------------
do $$
declare t text;
begin
  foreach t in array array['storage_locations', 'food_items', 'consumption_logs', 'recipes',
                           'recipe_ingredients', 'meal_plans', 'shopping_lists', 'shopping_list_items']
  loop
    execute format('create policy "%1$s member read" on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('create policy "%1$s member insert" on public.%1$I for insert to authenticated with check (public.is_household_member(household_id) and public.is_active_user())', t);
    execute format('create policy "%1$s member update" on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and public.is_active_user())', t);
    execute format('create policy "%1$s member delete" on public.%1$I for delete to authenticated using (public.is_household_member(household_id) and public.is_active_user())', t);
  end loop;
end $$;

-- Un aliment ne peut être rangé que dans un emplacement du même foyer.
create or replace function public.check_food_item_location() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.storage_locations l
                  where l.id = new.storage_location_id and l.household_id = new.household_id) then
    raise exception 'invalid_storage_location' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger food_items_location_check before insert or update of storage_location_id, household_id
  on public.food_items for each row execute function public.check_food_item_location();

-- Préférences & favoris (personnels) -------------------------------------------
create policy "diet household read" on public.dietary_preferences for select to authenticated
  using (user_id = auth.uid() or public.shares_household_with(user_id));
create policy "diet self write" on public.dietary_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "favorites self" on public.favorites for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));

-- Scanner -----------------------------------------------------------------------
create policy "scan sessions read" on public.scan_sessions for select to authenticated
  using (public.is_household_member(household_id));
create policy "scan sessions create draft" on public.scan_sessions for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft' and scans_consumed = 0
              and public.is_household_member(household_id) and public.is_active_user());
-- Pas d'update/delete client : transitions via edge function / RPC uniquement.

create policy "scan photos read" on public.scan_photos for select to authenticated
  using (public.is_household_member(household_id));
create policy "scan photos add to own draft" on public.scan_photos for insert to authenticated
  with check (exists (select 1 from public.scan_sessions s
                       where s.id = session_id and s.user_id = auth.uid()
                         and s.household_id = scan_photos.household_id and s.status = 'draft'));

create policy "scan detections read" on public.scan_detections for select to authenticated
  using (public.is_household_member(household_id));

-- Monétisation : lecture seule -----------------------------------------------------
create policy "subscriptions read" on public.subscriptions for select to authenticated
  using (public.is_household_member(household_id) or public.is_admin());
create policy "quotas read" on public.usage_quotas for select to authenticated
  using (public.is_household_member(household_id) or public.is_admin());
create policy "ai usage admin read" on public.ai_usage_logs for select to authenticated
  using (public.is_admin());

-- =============================================================================
-- Stockage des photos : bucket PRIVÉ, chemin = {household_id}/{session_id}/{n}.jpg
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scan-photos', 'scan-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "scan photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'scan-photos'
              and public.is_household_member(((storage.foldername(name))[1])::uuid)
              and public.is_active_user());
create policy "scan photos read own household" on storage.objects for select to authenticated
  using (bucket_id = 'scan-photos' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "scan photos delete own household" on storage.objects for delete to authenticated
  using (bucket_id = 'scan-photos' and public.is_household_member(((storage.foldername(name))[1])::uuid));

-- =============================================================================
-- Données de référence (pas des données de démo)
-- =============================================================================
insert into public.food_categories (id, label_fr, icon, position) values
  ('fruits',     'Fruits',            'nutrition-outline',  1),
  ('vegetables', 'Légumes',           'leaf-outline',       2),
  ('meat',       'Viandes',           'restaurant-outline', 3),
  ('fish',       'Poissons',          'fish-outline',       4),
  ('dairy',      'Produits laitiers', 'water-outline',      5),
  ('cheese',     'Fromages',          'pizza-outline',      6),
  ('drinks',     'Boissons',          'wine-outline',       7),
  ('starches',   'Féculents',         'basket-outline',     8),
  ('canned',     'Conserves',         'cube-outline',       9),
  ('frozen',     'Surgelés',          'snow-outline',      10),
  ('fresh',      'Produits frais',    'egg-outline',       11),
  ('other',      'Autres',            'ellipsis-horizontal-outline', 12);

insert into public.plans (code, label, monthly_scan_quota, monthly_recipe_quota, fair_use_recipe_cap, max_members, max_photos_per_scan, price_monthly_cents, price_yearly_cents, features) values
  ('free',    'Gratuit', 3,  10,   10,  1, 4, 0,   null, '{"meal_plan": false, "smart_notifications": false, "favorites": false, "consumption_history": false, "shared_household": false}'),
  ('premium', 'Premium', 30, null, 300, 1, 6, 499, 4790, '{"meal_plan": true,  "smart_notifications": true,  "favorites": true,  "consumption_history": true,  "shared_household": false}'),
  ('family',  'Famille', 60, null, 600, 6, 6, 699, 6710, '{"meal_plan": true,  "smart_notifications": true,  "favorites": true,  "consumption_history": true,  "shared_household": true}');
-- Annuel : -20 % (47,90 € / 67,10 €). Modifiable depuis l'admin ; les prix
-- affichés en boutique viennent de RevenueCat / des stores (source de vérité).

-- Temps réel (synchronisation du foyer)
alter publication supabase_realtime add table public.food_items, public.shopping_list_items, public.meal_plans;
