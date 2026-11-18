// Disponibilité des ingrédients d'une recette par rapport au stock ACTUEL
// (module pur, testé). Le stock évolue après la génération : on recalcule
// à chaque affichage à partir des aliments encore présents.
import type { RecipeIngredient } from '@/lib/types';

export interface StockLookup {
  /** id d'aliment actif → quantité/unité actuelles */
  get(id: string): { quantity: number | null; unit: string; name: string } | undefined;
}

export interface Availability {
  available: RecipeIngredient[];
  missing: RecipeIngredient[];
  staples: RecipeIngredient[];
  optional: RecipeIngredient[];
  /** true si rien d'obligatoire ne manque (les basiques restent "à vérifier") */
  canCook: boolean;
  /** part des ingrédients obligatoires présents, 0..1 */
  coverage: number;
}

export function computeAvailability(ingredients: RecipeIngredient[], stock: StockLookup): Availability {
  const available: RecipeIngredient[] = [];
  const missing: RecipeIngredient[] = [];
  const staples: RecipeIngredient[] = [];
  const optional: RecipeIngredient[] = [];

  for (const ing of [...ingredients].sort((a, b) => a.position - b.position)) {
    const inStock = ing.food_item_id !== null && stock.get(ing.food_item_id) !== undefined;
    if (inStock) available.push(ing);
    else if (ing.is_staple) staples.push(ing);
    else if (ing.is_optional) optional.push(ing);
    else missing.push(ing);
  }
  const required = available.length + missing.length;
  return {
    available, missing, staples, optional,
    canCook: missing.length === 0,
    coverage: required === 0 ? 1 : available.length / required,
  };
}

/** Classement des suggestions : réalisables d'abord, puis anti-gaspi, puis couverture du stock. */
export function rankRecipes<T extends { tags: string[]; created_at: string }>(
  recipes: T[],
  availabilityOf: (r: T) => Availability,
): T[] {
  const score = (r: T) => {
    const a = availabilityOf(r);
    return (a.canCook ? 100 : 0) + (r.tags.includes('anti-gaspi') ? 20 : 0) + a.coverage * 10;
  };
  return [...recipes].sort((x, y) => score(y) - score(x) || y.created_at.localeCompare(x.created_at));
}
