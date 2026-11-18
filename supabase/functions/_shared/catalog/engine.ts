// Moteur de recettes 100 % gratuit (aucune IA) : choisit dans la base Sauge les
// recettes les plus adaptées au stock réel. Module pur, testé.
//
// Garanties identiques à l'ancien moteur IA :
// - un ingrédient n'est « dans le stock » que s'il correspond à un aliment réel ;
// - allergies de tout le foyer, régimes et aliments non aimés respectés ;
// - filtres (type de repas, temps, difficulté, budget) stricts ;
// - priorité aux produits qui périment bientôt.
import { namesMatch, normalizeText, violatesPreferences } from '../ai/recipes.ts';
import type {
  AiUsage, FoodUnit, GeneratedIngredient, GeneratedRecipe, InventoryEntry, RecipeGenerationResult, RecipeProvider, RecipeRequest,
} from '../ai/types.ts';
import { type CatalogIngredient, type CatalogRecipe, RECIPES_FR } from './recipes-fr.ts';
import { RECIPES_FR_2 } from './recipes-fr-2.ts';

export const ALL_RECIPES: CatalogRecipe[] = [...RECIPES_FR, ...RECIPES_FR_2];

export const CATALOG_VERSION = 'sauge-recettes-fr-v1';
const BASE_SERVINGS = 2;
const EXPIRING_DAYS = 3;

export interface CatalogRequest extends RecipeRequest {
  /** titres proposés récemment au foyer : on varie les idées */
  excludeTitles?: string[];
  /** source d'aléa (tests : déterministe) */
  random?: () => number;
}

function scale(q: number, unit: FoodUnit, factor: number): number {
  const v = q * factor;
  if (unit === 'piece' || unit === 'pack') return Math.max(1, Math.round(v));
  if (unit === 'g' || unit === 'ml') return Math.max(10, Math.round(v / 10) * 10);
  return Math.max(0.1, Math.round(v * 10) / 10);
}

function findInStock(ing: CatalogIngredient, inventory: InventoryEntry[]): InventoryEntry | undefined {
  const names = [ing.name, ...(ing.match ?? [])];
  return inventory
    .filter((e) => names.some((n) => namesMatch(n, e.name)))
    // le produit qui périme le plus tôt d'abord (anti-gaspi)
    .sort((a, b) => (a.daysToExpiry ?? 9999) - (b.daysToExpiry ?? 9999))[0];
}

function build(r: CatalogRecipe, req: CatalogRequest): { recipe: GeneratedRecipe; required: number; available: number; expiring: number } {
  const factor = req.filters.servings / BASE_SERVINGS;
  let required = 0;
  let available = 0;
  const expiringRefs = new Set<number>();

  const ingredients: GeneratedIngredient[] = r.ingredients.map((ing) => {
    const stock = findInStock(ing, req.inventory);
    const isRequired = !ing.staple && !ing.optional;
    if (isRequired) {
      required++;
      if (stock) available++;
    }
    if (stock && stock.daysToExpiry !== null && stock.daysToExpiry <= EXPIRING_DAYS && stock.daysToExpiry >= -2) expiringRefs.add(stock.ref);
    return {
      name: ing.name,
      quantity: ing.quantity !== undefined && ing.unit ? scale(ing.quantity, ing.unit, factor) : null,
      unit: ing.quantity !== undefined && ing.unit ? ing.unit : null,
      quantityText: ing.text ?? null,
      category: ing.category,
      inventoryRef: stock ? stock.ref : null,
      isStaple: !stock && !!ing.staple,
      isOptional: !!ing.optional,
    };
  });

  return {
    required, available, expiring: expiringRefs.size,
    recipe: {
      title: r.title, summary: r.summary, prepMinutes: r.prep, cookMinutes: r.cook, servings: req.filters.servings,
      difficulty: r.difficulty, budget: r.budget, mealType: req.filters.mealType ?? r.meals[0], tags: r.tags,
      steps: r.steps, ingredients, usesExpiring: expiringRefs.size > 0,
    },
  };
}

function dislikes(recipe: GeneratedRecipe, list: string[]): boolean {
  const texts = [recipe.title, ...recipe.ingredients.map((i) => i.name)].map(normalizeText);
  return list.map(normalizeText).filter((d) => d.length >= 3).some((d) => texts.some((t) => t.includes(d)));
}

export function suggestFromCatalog(req: CatalogRequest, catalog: CatalogRecipe[] = ALL_RECIPES): { recipes: GeneratedRecipe[]; rejected: number } {
  const f = req.filters;
  const random = req.random ?? Math.random;
  const exclude = new Set((req.excludeTitles ?? []).map(normalizeText));
  let rejected = 0;

  const scored: { recipe: GeneratedRecipe; score: number; main: string; excluded: boolean }[] = [];
  for (const r of catalog) {
    // Filtres stricts
    if (f.mealType && !r.meals.includes(f.mealType)) continue;
    if (f.maxTotalMinutes !== null && r.prep + r.cook > f.maxTotalMinutes) continue;
    if (f.difficulty !== null && r.difficulty > f.difficulty) continue;
    if (f.budget !== null && r.budget > f.budget) continue;

    const { recipe, required, available, expiring } = build(r, req);
    if (violatesPreferences(recipe, req.preferences, f.focus) || dislikes(recipe, req.preferences.dislikes)) { rejected++; continue; }
    if (available === 0) continue; // sans aucun ingrédient du stock : ce n'est pas une idée « avec ce que vous avez »

    const missing = required - available;
    let score = (available / Math.max(required, 1)) * 100 - missing * 8 + expiring * (f.focus.includes('anti_waste') ? 25 : 12);
    if (f.focus.includes('stock')) score += missing <= 1 ? 15 : -60;
    if (f.focus.includes('quick') && r.prep + r.cook <= 30) score += 15;
    if (f.focus.includes('cheap') && r.budget === 1) score += 12;
    if (f.focus.includes('balanced') && r.tags.includes('équilibré')) score += 12;
    if (f.focus.includes('protein') && r.tags.includes('riche en protéines')) score += 12;
    score += random() * 4; // un peu de variété entre recettes proches

    const main = normalizeText(r.ingredients.find((i) => !i.staple && !i.optional)?.name ?? r.title);
    scored.push({ recipe, score, main, excluded: exclude.has(normalizeText(r.title)) });
  }

  scored.sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.score - a.score);
  const chosen: typeof scored = [];
  // Variété : pas deux recettes avec le même ingrédient principal, sauf s'il n'y a pas assez d'idées.
  for (const pass of [true, false]) {
    for (const s of scored) {
      if (chosen.length >= req.count) break;
      if (chosen.includes(s)) continue;
      if (pass && chosen.some((c) => c.main === s.main)) continue;
      chosen.push(s);
    }
  }
  return { recipes: chosen.map((c) => c.recipe), rejected };
}

/** Fournisseur « catalogue » : même interface que les fournisseurs IA, coût nul. */
export class CatalogRecipeProvider implements RecipeProvider {
  readonly name = 'catalog';
  async generateRecipes(req: CatalogRequest): Promise<RecipeGenerationResult> {
    const started = Date.now();
    const { recipes, rejected } = suggestFromCatalog(req);
    const usage: AiUsage = { provider: 'catalog', model: CATALOG_VERSION, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: Date.now() - started };
    return { recipes, rejected, usage };
  }
}
