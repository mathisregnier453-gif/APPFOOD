import { invokeFunction, supabase } from '@/lib/supabase';
import type { DietaryPreferences, Recipe, RecipeFiltersInput } from '@/lib/types';

export const RECIPE_COLUMNS = `id, title, summary, prep_minutes, cook_minutes, servings, difficulty, budget_level, meal_type, tags, steps, created_at,
  recipe_ingredients (id, name, quantity, unit, quantity_text, category_id, food_item_id, is_staple, is_optional, position)`;

export async function fetchRecipes(householdId: string, limit = 60): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes').select(RECIPE_COLUMNS)
    .eq('household_id', householdId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data as unknown as Recipe[];
}

export async function fetchRecipesByIds(ids: string[]): Promise<Recipe[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('recipes').select(RECIPE_COLUMNS).in('id', ids);
  if (error) throw error;
  const byId = new Map((data as unknown as Recipe[]).map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is Recipe => !!r);
}

export async function fetchRecipe(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase.from('recipes').select(RECIPE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as Recipe | null;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

export interface GenerateResponse {
  generation_id: string;
  recipe_ids: string[];
  from_cache: boolean;
  recipes_consumed: number;
  rejected?: number;
  quota?: { recipes_used: number; recipes_limit: number; plan: string };
}

export function generateRecipes(filters: RecipeFiltersInput, count = 3): Promise<GenerateResponse> {
  return invokeFunction<GenerateResponse>('recipes-generate', { filters, count });
}

// Favoris ------------------------------------------------------------------------
export async function fetchFavoriteIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('favorites').select('recipe_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((f) => f.recipe_id as string));
}

export async function setFavorite(userId: string, householdId: string, recipeId: string, favorite: boolean): Promise<void> {
  const { error } = favorite
    ? await supabase.from('favorites').insert({ user_id: userId, household_id: householdId, recipe_id: recipeId })
    : await supabase.from('favorites').delete().eq('user_id', userId).eq('recipe_id', recipeId);
  if (error && error.code !== '23505') throw error;
}

// Préférences alimentaires ----------------------------------------------------------
export async function fetchPreferences(userId: string): Promise<DietaryPreferences> {
  const { data } = await supabase.from('dietary_preferences').select('diets, allergies, dislikes').eq('user_id', userId).maybeSingle();
  return { diets: data?.diets ?? [], allergies: data?.allergies ?? [], dislikes: data?.dislikes ?? [] };
}

export async function savePreferences(userId: string, prefs: DietaryPreferences): Promise<void> {
  const { error } = await supabase
    .from('dietary_preferences')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() });
  if (error) throw error;
}
