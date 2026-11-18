// Validation de la requête de génération de recettes (module pur, testé).
import { MEAL_TYPES, type MealType, RECIPE_FOCUSES, type RecipeFilters, type RecipeFocus } from './ai/types.ts';

export const MAX_RECIPES_PER_REQUEST = 4;
export const DEFAULT_RECIPES_PER_REQUEST = 3;

export function parseRecipeRequest(body: unknown, defaultServings: number): { filters: RecipeFilters; count: number } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const f = (typeof b.filters === 'object' && b.filters !== null ? b.filters : {}) as Record<string, unknown>;

  const focus = Array.isArray(f.focus)
    ? [...new Set(f.focus.filter((x): x is RecipeFocus => typeof x === 'string' && (RECIPE_FOCUSES as readonly string[]).includes(x)))]
    : [];
  const maxTotal = typeof f.max_total_minutes === 'number' && Number.isFinite(f.max_total_minutes)
    ? Math.min(240, Math.max(10, Math.round(f.max_total_minutes))) : null;
  const servings = typeof f.servings === 'number' && Number.isFinite(f.servings)
    ? Math.min(12, Math.max(1, Math.round(f.servings))) : Math.min(12, Math.max(1, defaultServings));
  const lvl = (v: unknown) => (v === 1 || v === 2 || v === 3 ? v : null);
  const mealType = typeof f.meal_type === 'string' && (MEAL_TYPES as readonly string[]).includes(f.meal_type) ? (f.meal_type as MealType) : null;
  const count = typeof b.count === 'number' && Number.isInteger(b.count)
    ? Math.min(MAX_RECIPES_PER_REQUEST, Math.max(1, b.count)) : DEFAULT_RECIPES_PER_REQUEST;

  return {
    filters: {
      focus: focus.length ? focus.sort() : ['stock'],
      maxTotalMinutes: focus.includes('quick') ? Math.min(maxTotal ?? 30, 30) : maxTotal,
      servings,
      budget: lvl(f.budget),
      difficulty: lvl(f.difficulty),
      mealType,
    },
    count,
  };
}

/** Texte libre de préférences : nettoyé et borné avant d'être injecté dans le prompt. */
export function cleanPreferenceList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.replace(/[\n\r\t#|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40))
    .filter((x) => x.length >= 2))].slice(0, max);
}
