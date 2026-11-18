import { RECIPE_COLUMNS } from '@/features/recipes/api';
import { invokeFunction, supabase } from '@/lib/supabase';
import type { FoodUnit, MealPlanEntry, MealSlot, ShoppingItem } from '@/lib/types';
import type { DeductionSuggestion, ShoppingNeed } from './shopping';

// Planning ------------------------------------------------------------------------
export async function fetchMeals(householdId: string, from: string, to: string): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select(`id, plan_date, slot, recipe_id, custom_title, servings, is_cooked, recipes (${RECIPE_COLUMNS})`)
    .eq('household_id', householdId).gte('plan_date', from).lte('plan_date', to)
    .order('plan_date');
  if (error) throw error;
  return data as unknown as MealPlanEntry[];
}

export async function setMeal(
  householdId: string, userId: string, date: string, slot: MealSlot,
  value: { recipe_id: string | null; custom_title: string | null; servings: number },
): Promise<void> {
  const { error } = await supabase.from('meal_plans').upsert(
    { household_id: householdId, plan_date: date, slot, ...value, is_cooked: false, created_by: userId },
    { onConflict: 'household_id,plan_date,slot' },
  );
  if (error) throw error;
}

export async function removeMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plans').delete().eq('id', id);
  if (error) throw error;
}

export interface WeekPlanOptions {
  start_date: string;
  days: number;
  slots: MealSlot[];
  servings: number;
  budget: 1 | 2 | 3 | null;
  max_total_minutes: number | null;
  vegetarian: boolean;
  overwrite: boolean;
}

export function generateWeek(options: WeekPlanOptions): Promise<{ planned: number; recipes_consumed: number; partial?: boolean; message?: string }> {
  return invokeFunction('meal-plan-generate', { ...options });
}

// Courses ---------------------------------------------------------------------------
export async function activeListId(householdId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_active_shopping_list', { p_household: householdId });
  if (error) throw error;
  return data as string;
}

export async function fetchShoppingItems(listId: string): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('id, list_id, name, quantity, unit, category_id, recipe_id, is_checked, created_at')
    .eq('list_id', listId).order('created_at');
  if (error) throw error;
  return data as ShoppingItem[];
}

export async function addShoppingItems(householdId: string, items: ShoppingNeed[] | { name: string; quantity: number | null; unit: FoodUnit | null; category_id: string }[], mode: 'sum' | 'max' = 'sum'): Promise<number> {
  const { data, error } = await supabase.rpc('add_shopping_items', { p_household: householdId, p_items: items, p_mode: mode });
  if (error) throw error;
  return data as number;
}

export async function setChecked(id: string, checked: boolean): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_items').update({ is_checked: checked, checked_at: checked ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
}

export async function deleteShoppingItems(ids: string[]): Promise<void> {
  const { error } = await supabase.from('shopping_list_items').delete().in('id', ids);
  if (error) throw error;
}

export interface PurchaseEntry {
  item_id: string;
  storage_location_id: string;
  quantity: number | null;
  unit: FoodUnit | null;
  expiry_date: string | null;
  expiry_kind: 'dlc' | 'ddm' | null;
}

export async function purchaseItems(entries: PurchaseEntry[]): Promise<number> {
  const { data, error } = await supabase.rpc('purchase_shopping_items', { p_items: entries });
  if (error) throw error;
  return data as number;
}

// Cuisine -----------------------------------------------------------------------------
export async function cookRecipe(recipeId: string, deductions: DeductionSuggestion[], mealPlanId: string | null): Promise<number> {
  const payload = deductions
    .filter((d) => d.finish || (d.suggested !== null && d.suggested !== d.current))
    .map((d) => ({ food_item_id: d.food_item_id, new_quantity: d.finish ? 0 : d.suggested, finish: d.finish }));
  const { data, error } = await supabase.rpc('cook_recipe', { p_recipe: recipeId, p_deductions: payload, p_meal_plan: mealPlanId });
  if (error) throw error;
  return data as number;
}

// Code-barres ---------------------------------------------------------------------------
export interface BarcodeProduct {
  barcode: string;
  found: boolean;
  name: string | null;
  brand: string | null;
  quantity_text: string | null;
  quantity: number | null;
  unit: FoodUnit | null;
  category_id: string | null;
}

export function lookupBarcode(barcode: string): Promise<BarcodeProduct> {
  return invokeFunction<BarcodeProduct>('barcode-lookup', { barcode });
}
