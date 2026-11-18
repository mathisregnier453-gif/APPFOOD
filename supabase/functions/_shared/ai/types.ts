// Contrats indépendants du fournisseur IA.
// L'application et les edge functions ne dépendent QUE de ces interfaces :
// changer de fournisseur = ajouter un fichier dans providers/ + une variable d'env.

export const FOOD_CATEGORIES = [
  'fruits', 'vegetables', 'meat', 'fish', 'dairy', 'cheese',
  'drinks', 'starches', 'canned', 'frozen', 'fresh', 'other',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_UNITS = ['piece', 'g', 'kg', 'ml', 'l', 'pack'] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

export const STORAGE_KINDS = ['fridge', 'freezer', 'pantry'] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

export type ExpiryKind = 'dlc' | 'ddm';

export interface ScanImage {
  /** JPEG encodé en base64 (sans préfixe data:) */
  base64: string;
  mediaType: 'image/jpeg';
}

export interface DetectedFood {
  name: string;
  category: FoodCategory;
  /** null = quantité impossible à déterminer (jamais inventée) */
  quantity: number | null;
  unit: FoodUnit;
  quantityIsEstimate: boolean;
  /** YYYY-MM-DD, uniquement si la date est lisible sur la photo */
  expiryDate: string | null;
  expiryKind: ExpiryKind | null;
  /** 0..1 */
  confidence: number;
  photoIndex: number | null;
}

export interface AiUsage {
  provider: string;
  /** Modèle ayant réellement servi la réponse (peut différer en cas de repli) */
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface FoodDetectionResult {
  items: DetectedFood[];
  usage: AiUsage;
}

export interface FoodDetectionRequest {
  images: ScanImage[];
  storageKind: StorageKind;
  locale: string;
  /** Date du jour (YYYY-MM-DD) pour aider l'IA à lire les dates courtes (ex. "12/03") */
  today: string;
}

export interface FoodVisionProvider {
  readonly name: string;
  detectFoods(req: FoodDetectionRequest): Promise<FoodDetectionResult>;
}

export type AiErrorCode =
  | 'refused' | 'truncated' | 'invalid_output' | 'rate_limited' | 'unavailable' | 'config';

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly usage?: AiUsage;
  constructor(code: AiErrorCode, message: string, usage?: AiUsage) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.usage = usage;
  }
}

// -----------------------------------------------------------------------------
// Recettes (phase 2)
// -----------------------------------------------------------------------------
export const RECIPE_FOCUSES = ['stock', 'anti_waste', 'quick', 'cheap', 'balanced', 'protein', 'vegetarian'] as const;
export type RecipeFocus = (typeof RECIPE_FOCUSES)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Aliment du stock tel que présenté à l'IA : `ref` est un index local, jamais un id de base. */
export interface InventoryEntry {
  ref: number;
  name: string;
  category: FoodCategory;
  quantity: number | null;
  unit: FoodUnit;
  daysToExpiry: number | null;
}

export interface RecipeFilters {
  focus: RecipeFocus[];
  maxTotalMinutes: number | null;
  servings: number;
  budget: 1 | 2 | 3 | null;
  difficulty: 1 | 2 | 3 | null;
  mealType: MealType | null;
}

export interface DietaryProfile {
  diets: string[];
  allergies: string[];
  dislikes: string[];
}

export interface RecipeRequest {
  inventory: InventoryEntry[];
  filters: RecipeFilters;
  preferences: DietaryProfile;
  count: number;
  today: string;
  /** titres proposés récemment au foyer (le moteur varie ses idées) */
  excludeTitles?: string[];
}

export interface GeneratedIngredient {
  name: string;
  quantity: number | null;
  unit: FoodUnit | null;
  quantityText: string | null;
  category: FoodCategory;
  /** Lien VÉRIFIÉ vers le stock (null = manquant). */
  inventoryRef: number | null;
  isStaple: boolean;
  isOptional: boolean;
}

export interface GeneratedRecipe {
  title: string;
  summary: string;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: 1 | 2 | 3;
  budget: 1 | 2 | 3;
  mealType: MealType;
  tags: string[];
  steps: string[];
  ingredients: GeneratedIngredient[];
  usesExpiring: boolean;
}

export interface RecipeGenerationResult {
  recipes: GeneratedRecipe[];
  rejected: number;
  usage: AiUsage;
}

export interface RecipeProvider {
  readonly name: string;
  generateRecipes(req: RecipeRequest): Promise<RecipeGenerationResult>;
}
