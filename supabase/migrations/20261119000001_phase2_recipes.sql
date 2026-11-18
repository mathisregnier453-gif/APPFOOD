-- =============================================================================
-- Phase 2 : génération de recettes, quotas de recettes, cache, favoris
-- =============================================================================

-- Ingrédients "de base" (sel, poivre, huile…) : jamais déclarés disponibles,
-- simplement signalés "à vérifier".
alter table public.recipe_ingredients add column is_staple boolean not null default false;

-- Une génération = un appel IA = plusieurs recettes. Sert au cache, au
-- décompte et au suivi des coûts.
create table public.recipe_generations (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  user_id             uuid references auth.users (id) on delete set null,
  request_hash        text not null,           -- empreinte (stock + filtres + préférences)
  filters             jsonb not null default '{}'::jsonb,
  recipe_count        smallint not null default 0,
  recipes_consumed    smallint not null default 0,
  ai_provider         text,
  ai_model            text,
  estimated_cost_usd  numeric(10,6),
  from_cache          boolean not null default false,
  created_at          timestamptz not null default now()
);
create index recipe_generations_hash_idx on public.recipe_generations (household_id, request_hash, created_at desc);

alter table public.recipes add column generation_id uuid references public.recipe_generations (id) on delete set null;
create index recipes_generation_idx on public.recipes (generation_id);
create index favorites_user_idx on public.favorites (user_id, created_at desc);

alter table public.recipe_generations enable row level security;
create policy "generations read" on public.recipe_generations for select to authenticated
  using (public.is_household_member(household_id));

-- Les recettes sont créées par le serveur (IA) : l'app ne peut que les lire,
-- les supprimer de son historique et les mettre en favori.
drop policy "recipes member insert" on public.recipes;
drop policy "recipes member update" on public.recipes;
drop policy "recipe_ingredients member insert" on public.recipe_ingredients;
drop policy "recipe_ingredients member update" on public.recipe_ingredients;
drop policy "recipe_ingredients member delete" on public.recipe_ingredients;

-- Un favori ne peut viser qu'une recette du même foyer.
drop policy "favorites self" on public.favorites;
create policy "favorites self read" on public.favorites for select to authenticated
  using (user_id = auth.uid());
create policy "favorites self write" on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id)
              and exists (select 1 from public.recipes r where r.id = recipe_id and r.household_id = favorites.household_id));
create policy "favorites self delete" on public.favorites for delete to authenticated
  using (user_id = auth.uid());

-- Quota de recettes (serveur uniquement) ------------------------------------
-- Gratuit : monthly_recipe_quota (10). Payant : null => plafond "usage raisonnable".
-- Accorde au plus ce qui reste (granted peut être < p_count, ou 0) : jamais de dépassement.
create or replace function public.consume_recipe_quota(p_household uuid, p_count integer)
returns table (granted integer, recipes_used integer, recipes_limit integer, plan public.plan_code)
language plpgsql security definer set search_path = '' as $$
declare
  v_plan    public.plan_code := public.effective_plan(p_household);
  v_limit   integer;
  v_used    integer;
  v_granted integer;
begin
  select coalesce(pl.monthly_recipe_quota, pl.fair_use_recipe_cap) into v_limit
    from public.plans pl where pl.code = v_plan;

  insert into public.usage_quotas (household_id, period_start)
  values (p_household, public.current_period_start())
  on conflict do nothing;

  select q.recipes_used into v_used from public.usage_quotas q
   where q.household_id = p_household and q.period_start = public.current_period_start()
   for update;

  v_granted := least(greatest(p_count, 0), greatest(v_limit - v_used, 0));
  if v_granted > 0 then
    update public.usage_quotas q
       set recipes_used = q.recipes_used + v_granted, updated_at = now()
     where q.household_id = p_household and q.period_start = public.current_period_start();
  end if;

  return query select v_granted, v_used + v_granted, v_limit, v_plan;
end $$;

create or replace function public.refund_recipe_quota(p_household uuid, p_count integer)
returns void
language sql security definer set search_path = '' as $$
  update public.usage_quotas q
     set recipes_used = greatest(0, q.recipes_used - p_count), updated_at = now()
   where q.household_id = p_household and q.period_start = public.current_period_start();
$$;

revoke execute on function public.consume_recipe_quota(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_recipe_quota(uuid, integer)  from public, anon, authenticated;
grant  execute on function public.consume_recipe_quota(uuid, integer) to service_role;
grant  execute on function public.refund_recipe_quota(uuid, integer)  to service_role;

-- Préférences alimentaires : valeurs bornées (elles sont injectées dans le prompt IA).
alter table public.dietary_preferences
  add constraint dietary_preferences_sizes check (
    cardinality(diets) <= 10 and cardinality(allergies) <= 20 and cardinality(dislikes) <= 30);

-- Quantités non métriques ("2 c. à soupe", "1 pincée") affichées telles quelles.
alter table public.recipe_ingredients
  add column quantity_text text check (quantity_text is null or char_length(quantity_text) <= 40);
