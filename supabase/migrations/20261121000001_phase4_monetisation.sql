-- =============================================================================
-- Phase 4 : abonnements (RevenueCat), droits d'accès vérifiés côté serveur
-- =============================================================================

-- Correspondance offre <-> produits des stores et droit RevenueCat.
-- Modifiable depuis l'admin : aucun identifiant produit n'est codé en dur.
alter table public.plans
  add column revenuecat_entitlement text,
  add column store_product_monthly  text,
  add column store_product_yearly   text,
  add column position smallint not null default 0;

update public.plans set position = 0 where code = 'free';
update public.plans set position = 1, revenuecat_entitlement = 'premium',
  store_product_monthly = 'sauge_premium_monthly', store_product_yearly = 'sauge_premium_yearly' where code = 'premium';
update public.plans set position = 2, revenuecat_entitlement = 'family',
  store_product_monthly = 'sauge_family_monthly', store_product_yearly = 'sauge_family_yearly' where code = 'family';

-- Un abonnement (le plus récent état connu) par utilisateur payeur.
alter table public.subscriptions
  add column is_sandbox boolean not null default false,
  add column entitlement text,
  add column last_event_type text,
  add constraint subscriptions_user_unique unique (user_id);

-- Journal des événements RevenueCat : idempotence (un événement rejoué n'est
-- traité qu'une fois) et traçabilité pour le support / la comptabilité.
create table public.revenuecat_events (
  id            text primary key,
  type          text not null,
  app_user_id   text,
  environment   text,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);
alter table public.revenuecat_events enable row level security;
create policy "rc events admin read" on public.revenuecat_events for select to authenticated using (public.is_admin());

-- Droits d'accès ---------------------------------------------------------------
create or replace function public.plan_has_feature(p_household uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((pl.features ->> p_feature)::boolean, false)
    from public.plans pl where pl.code = public.effective_plan(p_household);
$$;

-- Fonctions accessibles à l'app : offre effective + liste des droits du foyer.
create or replace function public.get_entitlements(p_household uuid)
returns table (plan public.plan_code, features jsonb, max_members smallint, max_photos_per_scan smallint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_household_member(p_household) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select pl.code, pl.features, pl.max_members, pl.max_photos_per_scan
      from public.plans pl where pl.code = public.effective_plan(p_household);
end $$;

-- Favoris : réservés aux offres payantes.
drop policy "favorites self write" on public.favorites;
create policy "favorites self write" on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id)
              and public.plan_has_feature(household_id, 'favorites')
              and exists (select 1 from public.recipes r where r.id = recipe_id and r.household_id = favorites.household_id));

-- Planning : réservé aux offres payantes (lecture conservée après une résiliation).
drop policy "meal_plans member insert" on public.meal_plans;
drop policy "meal_plans member update" on public.meal_plans;
create policy "meal_plans member insert" on public.meal_plans for insert to authenticated
  with check (public.is_household_member(household_id) and public.is_active_user()
              and public.plan_has_feature(household_id, 'meal_plan'));
create policy "meal_plans member update" on public.meal_plans for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and public.is_active_user()
              and public.plan_has_feature(household_id, 'meal_plan'));

-- Historique de consommation : lecture réservée aux offres payantes
-- (il continue d'être enregistré : il redevient visible après un abonnement).
drop policy "consumption_logs member read" on public.consumption_logs;
create policy "consumption_logs member read" on public.consumption_logs for select to authenticated
  using (public.is_household_member(household_id) and public.plan_has_feature(household_id, 'consumption_history'));

-- La RPC cook_recipe marque le repas cuisiné : sans planning (offre gratuite), aucun repas n'existe, rien ne change.
