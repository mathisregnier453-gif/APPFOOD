-- =============================================================================
-- Phase 3 : planning, liste de courses, déduction des ingrédients, code-barres
-- =============================================================================

-- Liste de courses ------------------------------------------------------------
-- Anti-doublons y compris quand l'unité est inconnue (NULL).
alter table public.shopping_list_items drop constraint shopping_list_items_list_id_normalized_name_unit_key;
alter table public.shopping_list_items
  add constraint shopping_list_items_dedupe unique nulls not distinct (list_id, normalized_name, unit);
alter table public.shopping_list_items add column checked_at timestamptz;

-- Une seule liste active par foyer.
create unique index shopping_lists_one_active on public.shopping_lists (household_id) where not is_archived;

create or replace function public.get_active_shopping_list(p_household uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_household_member(p_household) or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_id from public.shopping_lists where household_id = p_household and not is_archived;
  if v_id is null then
    insert into public.shopping_lists (household_id) values (p_household)
    on conflict (household_id) where not is_archived do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.shopping_lists where household_id = p_household and not is_archived;
    end if;
  end if;
  return v_id;
end $$;

-- Ajout groupé avec fusion des doublons.
--   p_mode = 'sum' : ajout manuel ou depuis une recette => quantités additionnées
--   p_mode = 'max' : régénération depuis le planning => pas de double comptage
-- p_items : [{name, quantity, unit, category_id, recipe_id}]
create or replace function public.add_shopping_items(p_household uuid, p_items jsonb, p_mode text default 'sum')
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_list  uuid := public.get_active_shopping_list(p_household);
  v_item  jsonb;
  v_count integer := 0;
  v_name  text;
begin
  if p_mode not in ('sum', 'max') or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := left(trim(v_item ->> 'name'), 80);
    if v_name is null or char_length(v_name) < 2 then continue; end if;

    insert into public.shopping_list_items as s (list_id, household_id, name, quantity, unit, category_id, recipe_id, added_by)
    values (
      v_list, p_household, v_name,
      nullif(v_item ->> 'quantity', '')::numeric,
      nullif(v_item ->> 'unit', '')::public.food_unit,
      coalesce(nullif(v_item ->> 'category_id', ''), 'other'),
      (select r.id from public.recipes r where r.id = nullif(v_item ->> 'recipe_id', '')::uuid and r.household_id = p_household),
      auth.uid())
    on conflict on constraint shopping_list_items_dedupe do update
      set quantity = case
            when s.quantity is null and excluded.quantity is null then null
            when p_mode = 'max' then greatest(coalesce(s.quantity, 0), coalesce(excluded.quantity, 0))
            else coalesce(s.quantity, 0) + coalesce(excluded.quantity, 0) end,
          is_checked = case when p_mode = 'sum' then false else s.is_checked end,
          checked_at = case when p_mode = 'sum' then null else s.checked_at end;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Produits achetés => ajoutés au stock et retirés de la liste.
-- p_items : [{item_id, storage_location_id, quantity, unit, expiry_date, expiry_kind}]
create or replace function public.purchase_shopping_items(p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_entry jsonb;
  v_item  public.shopping_list_items;
  v_count integer := 0;
begin
  if not public.is_active_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_entry in select * from jsonb_array_elements(p_items) loop
    select * into v_item from public.shopping_list_items where id = (v_entry ->> 'item_id')::uuid for update;
    if v_item.id is null or not public.is_household_member(v_item.household_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if not exists (select 1 from public.storage_locations l
                    where l.id = (v_entry ->> 'storage_location_id')::uuid and l.household_id = v_item.household_id) then
      raise exception 'invalid_storage_location' using errcode = '22023';
    end if;

    insert into public.food_items (household_id, storage_location_id, category_id, name, quantity, unit,
                                   quantity_is_estimate, expiry_date, expiry_kind, source, created_by)
    values (v_item.household_id, (v_entry ->> 'storage_location_id')::uuid, v_item.category_id, v_item.name,
            coalesce(nullif(v_entry ->> 'quantity', '')::numeric, v_item.quantity),
            coalesce(nullif(v_entry ->> 'unit', '')::public.food_unit, v_item.unit, 'piece'),
            false,
            nullif(v_entry ->> 'expiry_date', '')::date,
            case when nullif(v_entry ->> 'expiry_date', '') is null then null
                 else nullif(v_entry ->> 'expiry_kind', '')::public.expiry_kind end,
            'shopping', auth.uid());

    delete from public.shopping_list_items where id = v_item.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Recette cuisinée => déduction des ingrédients VALIDÉS par l'utilisateur.
-- p_deductions : [{food_item_id, new_quantity, finish}] (sans quantité ni finish : ignoré)
create or replace function public.cook_recipe(p_recipe uuid, p_deductions jsonb, p_meal_plan uuid default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_recipe public.recipes;
  v_entry  jsonb;
  v_item   public.food_items;
  v_new    numeric;
  v_finish boolean;
  v_count  integer := 0;
begin
  select * into v_recipe from public.recipes where id = p_recipe;
  if v_recipe.id is null or not public.is_household_member(v_recipe.household_id) or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_deductions) <> 'array' or jsonb_array_length(p_deductions) > 60 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_entry in select * from jsonb_array_elements(p_deductions) loop
    select * into v_item from public.food_items
     where id = (v_entry ->> 'food_item_id')::uuid and household_id = v_recipe.household_id and finished_at is null
     for update;
    if v_item.id is null then continue; end if;  -- déjà terminé entre-temps : ignoré

    v_finish := coalesce((v_entry ->> 'finish')::boolean, false);
    v_new := nullif(v_entry ->> 'new_quantity', '')::numeric;
    if v_new is not null and v_new < 0 then v_new := 0; end if;
    if v_new = 0 then v_finish := true; end if;
    if v_new is null and not v_finish then continue; end if;  -- rien à déduire

    insert into public.consumption_logs (household_id, food_item_id, user_id, item_name, category_id, quantity_delta, unit, reason, recipe_id)
    values (v_item.household_id, v_item.id, auth.uid(), v_item.name, v_item.category_id,
            case when v_finish then -v_item.quantity
                 when v_item.quantity is null or v_new is null then null
                 else v_new - v_item.quantity end,
            v_item.unit, 'recipe', p_recipe);

    update public.food_items
       set quantity = case when v_finish then 0 else v_new end,
           quantity_is_estimate = case when v_finish or v_new is not null then false else quantity_is_estimate end,
           finished_at = case when v_finish then now() else null end
     where id = v_item.id;
    v_count := v_count + 1;
  end loop;

  if p_meal_plan is not null then
    update public.meal_plans set is_cooked = true
     where id = p_meal_plan and household_id = v_recipe.household_id;
  end if;
  return v_count;
end $$;

-- Planning : servings borné, une recette du planning doit appartenir au foyer.
alter table public.meal_plans add constraint meal_plans_servings check (servings between 1 and 20);
create or replace function public.check_meal_plan_recipe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.recipe_id is not null and not exists (
    select 1 from public.recipes r where r.id = new.recipe_id and r.household_id = new.household_id) then
    raise exception 'invalid_recipe' using errcode = '22023';
  end if;
  if new.recipe_id is null and coalesce(trim(new.custom_title), '') = '' then
    raise exception 'empty_meal' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger meal_plans_recipe_check before insert or update on public.meal_plans
  for each row execute function public.check_meal_plan_recipe();
create index meal_plans_week_idx on public.meal_plans (household_id, plan_date);

-- Code-barres : cache partagé des fiches produits publiques (Open Food Facts).
-- Ne contient aucune donnée personnelle : lisible par tous les utilisateurs connectés,
-- alimenté uniquement par le serveur.
create table public.product_cache (
  barcode        text primary key check (barcode ~ '^[0-9]{8,14}$'),
  found          boolean not null,
  name           text,
  brand          text,
  quantity_text  text,
  quantity       numeric(10,2),
  unit           public.food_unit,
  category_id    text references public.food_categories (id),
  image_url      text,
  fetched_at     timestamptz not null default now()
);
alter table public.product_cache enable row level security;
create policy "product cache readable" on public.product_cache for select to authenticated using (true);
