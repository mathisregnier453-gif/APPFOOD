export type StorageKind = 'fridge' | 'freezer' | 'pantry';
export type FoodUnit = 'piece' | 'g' | 'kg' | 'ml' | 'l' | 'pack';
export type ExpiryKind = 'dlc' | 'ddm';
export type PlanCode = 'free' | 'premium' | 'family';
export type CategoryId =
  | 'fruits' | 'vegetables' | 'meat' | 'fish' | 'dairy' | 'cheese'
  | 'drinks' | 'starches' | 'canned' | 'frozen' | 'fresh' | 'other';

export interface Profile {
  id: string;
  display_name: string | null;
  locale: string;
  current_household_id: string | null;
  household_size: number;
  expiry_alert_days: number;
  privacy_consent_at: string | null;
  suspended_at: string | null;
  notification_prefs: NotificationPrefs;
  is_admin: boolean;
  analytics_consent: boolean;
}

export interface StorageLocation {
  id: string;
  household_id: string;
  kind: StorageKind;
  name: string;
  position: number;
}

export interface FoodItem {
  id: string;
  household_id: string;
  storage_location_id: string;
  category_id: CategoryId;
  name: string;
  quantity: number | null;
  unit: FoodUnit;
  quantity_is_estimate: boolean;
  expiry_date: string | null;
  expiry_kind: ExpiryKind | null;
  notes: string | null;
  source: 'manual' | 'scan' | 'barcode' | 'shopping';
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScanDetection {
  id: string;
  name: string;
  category_id: CategoryId;
  quantity: number | null;
  unit: FoodUnit;
  quantity_is_estimate: boolean;
  expiry_date: string | null;
  expiry_kind: ExpiryKind | null;
  confidence: number;
  photo_index: number | null;
}

export interface QuotaStatus {
  plan: PlanCode;
  scans_used: number;
  scans_limit: number;
  recipes_used: number;
  recipes_limit: number;
  period_end: string;
}

export interface ConsumptionLog {
  id: string;
  item_name: string;
  quantity_delta: number | null;
  unit: FoodUnit | null;
  reason: 'consumed' | 'finished' | 'discarded' | 'recipe' | 'adjusted' | 'moved';
  created_at: string;
}

// -----------------------------------------------------------------------------
// Phase 2 : recettes, préférences, notifications
// -----------------------------------------------------------------------------
export type RecipeFocus = 'stock' | 'anti_waste' | 'quick' | 'cheap' | 'balanced' | 'protein' | 'vegetarian';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'snack';

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: FoodUnit | null;
  quantity_text: string | null;
  category_id: CategoryId | null;
  food_item_id: string | null;
  is_staple: boolean;
  is_optional: boolean;
  position: number;
}

export interface Recipe {
  id: string;
  title: string;
  summary: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number;
  difficulty: 1 | 2 | 3 | null;
  budget_level: 1 | 2 | 3 | null;
  meal_type: MealType | null;
  tags: string[];
  steps: string[];
  created_at: string;
  recipe_ingredients: RecipeIngredient[];
}

export interface RecipeFiltersInput {
  focus: RecipeFocus[];
  max_total_minutes: number | null;
  servings: number;
  budget: 1 | 2 | 3 | null;
  difficulty: 1 | 2 | 3 | null;
  meal_type: MealType | null;
}

export interface DietaryPreferences {
  diets: string[];
  allergies: string[];
  dislikes: string[];
}

export interface NotificationPrefs {
  expiry: boolean;
  quota: boolean;
  meal_reminder: boolean;
  missing_ingredient: boolean;
  shopping_update: boolean;
  household_activity: boolean;
}

// -----------------------------------------------------------------------------
// Phase 3 : planning, courses
// -----------------------------------------------------------------------------
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanEntry {
  id: string;
  plan_date: string;
  slot: MealSlot;
  recipe_id: string | null;
  custom_title: string | null;
  servings: number;
  is_cooked: boolean;
  recipes: Recipe | null;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: FoodUnit | null;
  category_id: CategoryId;
  recipe_id: string | null;
  is_checked: boolean;
  created_at: string;
}
