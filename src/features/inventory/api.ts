import { supabase } from '@/lib/supabase';
import type {
  CategoryId, ConsumptionLog, ExpiryKind, FoodItem, FoodUnit, QuotaStatus, StorageLocation,
} from '@/lib/types';

const ITEM_COLUMNS =
  'id, household_id, storage_location_id, category_id, name, quantity, unit, quantity_is_estimate, expiry_date, expiry_kind, notes, source, finished_at, created_at, updated_at';

export async function fetchLocations(householdId: string): Promise<StorageLocation[]> {
  const { data, error } = await supabase
    .from('storage_locations').select('id, household_id, kind, name, position')
    .eq('household_id', householdId).order('position');
  if (error) throw error;
  return data as StorageLocation[];
}

export async function fetchActiveItems(householdId: string): Promise<FoodItem[]> {
  const { data, error } = await supabase
    .from('food_items').select(ITEM_COLUMNS)
    .eq('household_id', householdId).is('finished_at', null)
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('name');
  if (error) throw error;
  return data as FoodItem[];
}

export async function fetchItem(id: string): Promise<FoodItem | null> {
  const { data, error } = await supabase.from('food_items').select(ITEM_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as FoodItem | null;
}

export interface ItemInput {
  name: string;
  category_id: CategoryId;
  storage_location_id: string;
  quantity: number | null;
  unit: FoodUnit;
  expiry_date: string | null;
  expiry_kind: ExpiryKind | null;
  notes?: string | null;
  barcode?: string | null;
}

export async function createItem(householdId: string, userId: string, input: ItemInput): Promise<void> {
  const { error } = await supabase.from('food_items').insert({
    ...input,
    household_id: householdId,
    created_by: userId,
    source: input.barcode ? 'barcode' : 'manual',
    quantity_is_estimate: false,
  });
  if (error) throw error;
}

/** Mise à jour des champs descriptifs. Les quantités passent par setQuantity (historique). */
export async function updateItem(id: string, input: Omit<ItemInput, 'quantity' | 'barcode'>): Promise<void> {
  const { error } = await supabase.from('food_items').update(input).eq('id', id);
  if (error) throw error;
}

export async function setQuantity(
  id: string,
  quantity: number | null,
  reason: 'consumed' | 'adjusted' | 'discarded' = 'adjusted',
): Promise<void> {
  const { error } = await supabase.rpc('update_item_quantity', {
    p_item: id, p_new_quantity: quantity, p_reason: reason, p_finish: false,
  });
  if (error) throw error;
}

export async function finishItem(id: string, reason: 'finished' | 'discarded' = 'finished'): Promise<void> {
  const { error } = await supabase.rpc('update_item_quantity', {
    p_item: id, p_new_quantity: null, p_reason: reason, p_finish: true,
  });
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('food_items').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchItemHistory(itemId: string): Promise<ConsumptionLog[]> {
  const { data, error } = await supabase
    .from('consumption_logs').select('id, item_name, quantity_delta, unit, reason, created_at')
    .eq('food_item_id', itemId).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data as ConsumptionLog[];
}

export async function fetchQuota(householdId: string): Promise<QuotaStatus | null> {
  const { data, error } = await supabase.rpc('get_quota_status', { p_household: householdId });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) ?? null;
}
