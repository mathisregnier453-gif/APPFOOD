// Calculs de la liste de courses et des déductions de stock (module pur, testé).
// Règle : on n'ajoute à la liste que ce qui manque réellement, en tenant compte
// du stock, du nombre de personnes et des repas qui se partagent un même aliment.
import type { CategoryId, FoodUnit, RecipeIngredient } from '@/lib/types';

const BASE: Partial<Record<FoodUnit, { base: FoodUnit; factor: number }>> = {
  g: { base: 'g', factor: 1 }, kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 }, l: { base: 'ml', factor: 1000 },
};

/** Conversion entre unités compatibles (g↔kg, ml↔l, identiques) ; null sinon. */
export function convert(quantity: number, from: FoodUnit, to: FoodUnit): number | null {
  if (from === to) return quantity;
  const a = BASE[from];
  const b = BASE[to];
  if (!a || !b || a.base !== b.base) return null;
  return (quantity * a.factor) / b.factor;
}

function roundUp(quantity: number, unit: FoodUnit): number {
  if (unit === 'piece' || unit === 'pack') return Math.ceil(quantity - 1e-9);
  if (unit === 'g' || unit === 'ml') return Math.ceil(quantity / 10 - 1e-9) * 10;
  return Math.ceil(quantity * 10 - 1e-9) / 10;
}

function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export interface StockEntry {
  quantity: number | null;
  unit: FoodUnit;
}

export interface PlannedMeal {
  recipeId: string;
  recipeServings: number;
  servings: number;
  ingredients: RecipeIngredient[];
}

export interface ShoppingNeed {
  name: string;
  quantity: number | null;
  unit: FoodUnit | null;
  category_id: CategoryId;
  recipe_id: string | null;
}

export function buildShoppingNeeds(meals: PlannedMeal[], stock: Map<string, StockEntry>): ShoppingNeed[] {
  // Stock restant après réservation par les repas précédents (même aliment utilisé deux fois).
  const remaining = new Map<string, number | null>([...stock].map(([id, s]) => [id, s.quantity]));
  const needs = new Map<string, ShoppingNeed>();

  const add = (ing: RecipeIngredient, quantity: number | null, unit: FoodUnit | null, recipeId: string) => {
    // Agrégation en unité de base (g, ml) pour additionner 500 g + 1 kg.
    const base = unit ? BASE[unit]?.base ?? unit : null;
    const q = quantity !== null && unit ? convert(quantity, unit, base!) : null;
    const key = `${normalizeName(ing.name)}|${base ?? ''}`;
    const prev = needs.get(key);
    if (prev) {
      prev.quantity = prev.quantity === null || q === null ? (prev.quantity ?? q) : prev.quantity + q;
      if (prev.recipe_id !== recipeId) prev.recipe_id = null;
    } else {
      needs.set(key, { name: ing.name, quantity: q, unit: base, category_id: ing.category_id ?? 'other', recipe_id: recipeId });
    }
  };

  for (const meal of meals) {
    const factor = meal.recipeServings > 0 ? meal.servings / meal.recipeServings : 1;
    for (const ing of meal.ingredients) {
      if (ing.is_staple || ing.is_optional) continue;
      const needed = ing.quantity !== null && ing.unit ? ing.quantity * factor : null;
      const stockEntry = ing.food_item_id ? stock.get(ing.food_item_id) : undefined;

      if (!stockEntry) {
        add(ing, needed, ing.unit, meal.recipeId);
        continue;
      }
      const left = remaining.get(ing.food_item_id!) ?? null;
      // Quantité en stock inconnue ou unités incomparables : on considère l'aliment disponible.
      if (left === null || needed === null || !ing.unit) continue;
      const neededInStockUnit = convert(needed, ing.unit, stockEntry.unit);
      if (neededInStockUnit === null) continue;
      if (left >= neededInStockUnit) {
        remaining.set(ing.food_item_id!, left - neededInStockUnit);
      } else {
        remaining.set(ing.food_item_id!, 0);
        add(ing, convert(neededInStockUnit - left, stockEntry.unit, ing.unit), ing.unit, meal.recipeId);
      }
    }
  }

  return [...needs.values()].map((n) => {
    if (n.quantity === null || !n.unit) return n;
    // Affichage lisible : 1 500 g => 1,5 kg
    if (n.unit === 'g' && n.quantity >= 1000) return { ...n, quantity: roundUp(n.quantity / 1000, 'kg'), unit: 'kg' as FoodUnit };
    if (n.unit === 'ml' && n.quantity >= 1000) return { ...n, quantity: roundUp(n.quantity / 1000, 'l'), unit: 'l' as FoodUnit };
    return { ...n, quantity: roundUp(n.quantity, n.unit) };
  });
}

export interface StockItemForCook {
  id: string;
  name: string;
  quantity: number | null;
  unit: FoodUnit;
}

export interface DeductionSuggestion {
  food_item_id: string;
  name: string;
  unit: FoodUnit;
  current: number | null;
  /** quantité restante proposée ; null = à préciser par l'utilisateur */
  suggested: number | null;
  finish: boolean;
}

/** Propose la nouvelle quantité de chaque aliment utilisé ; l'utilisateur valide ou corrige. */
export function suggestDeductions(ingredients: RecipeIngredient[], recipeServings: number, servings: number, stock: Map<string, StockItemForCook>): DeductionSuggestion[] {
  const factor = recipeServings > 0 ? servings / recipeServings : 1;
  const out = new Map<string, DeductionSuggestion>();
  for (const ing of ingredients) {
    const item = ing.food_item_id ? stock.get(ing.food_item_id) : undefined;
    if (!item) continue;
    const prev = out.get(item.id);
    const base = prev ? prev.suggested : item.quantity;
    let suggested: number | null = base;
    if (base !== null && ing.quantity !== null && ing.unit) {
      const used = convert(ing.quantity * factor, ing.unit, item.unit);
      if (used !== null) suggested = Math.max(0, Math.round((base - used) * 100) / 100);
    } else if (base === null) {
      suggested = null;
    }
    out.set(item.id, {
      food_item_id: item.id, name: item.name, unit: item.unit, current: item.quantity,
      suggested, finish: suggested === 0,
    });
  }
  return [...out.values()];
}

// Catégorie devinée pour un ajout manuel à la liste (modifiable ensuite).
const CATEGORY_WORDS: [CategoryId, string[]][] = [
  ['fruits', ['pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'raisin', 'kiwi', 'peche', 'abricot', 'ananas', 'mangue', 'melon', 'clementine']],
  ['vegetables', ['tomate', 'carotte', 'salade', 'courgette', 'poivron', 'oignon', 'ail', 'pomme de terre', 'patate', 'brocoli', 'epinard', 'concombre', 'champignon', 'poireau', 'chou', 'aubergine', 'haricot vert', 'persil', 'basilic', 'echalote']],
  ['meat', ['poulet', 'boeuf', 'porc', 'jambon', 'lardon', 'saucisse', 'dinde', 'steak', 'viande', 'veau', 'agneau']],
  ['fish', ['saumon', 'thon', 'cabillaud', 'poisson', 'crevette', 'colin', 'sardine']],
  ['cheese', ['fromage', 'emmental', 'comte', 'mozzarella', 'parmesan', 'chevre', 'camembert', 'feta', 'raclette']],
  ['dairy', ['lait', 'yaourt', 'creme', 'beurre', 'fromage blanc', 'skyr']],
  ['drinks', ['eau', 'jus', 'soda', 'vin', 'biere', 'cafe', 'the ']],
  ['starches', ['pates', 'riz', 'pain', 'farine', 'semoule', 'quinoa', 'lentille', 'pois chiche', 'cereale', 'couscous']],
  ['canned', ['conserve', 'boite', 'sauce tomate', 'mais']],
  ['frozen', ['surgele', 'glace']],
  ['fresh', ['oeuf', 'tofu', 'houmous']],
];

export function guessCategory(name: string): CategoryId {
  const n = ` ${normalizeName(name)} `;
  for (const [cat, words] of CATEGORY_WORDS) {
    if (words.some((w) => n.includes(` ${w}`))) return cat;
  }
  return 'other';
}

/** Emplacement proposé pour ranger un achat. */
export function defaultStorageFor(category: CategoryId): 'fridge' | 'freezer' | 'pantry' {
  if (category === 'frozen') return 'freezer';
  if (['canned', 'starches', 'drinks', 'other'].includes(category)) return 'pantry';
  return 'fridge';
}
