// Planning de la semaine : validation de la requête et répartition des recettes
// sur les jours (module pur, testé).
import type { RecipeFilters } from './ai/types.ts';

export type Slot = 'breakfast' | 'lunch' | 'dinner';
export const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];
export const MAX_DAYS = 7;

export interface MealPlanRequest {
  dates: string[];
  slots: Slot[];
  overwrite: boolean;
  filters: Omit<RecipeFilters, 'mealType'>;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function parseMealPlanRequest(body: unknown, today: string, householdSize: number): MealPlanRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const start = typeof b.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.start_date) ? b.start_date : null;
  if (!start || Number.isNaN(Date.parse(start))) return null;
  const offset = Math.round((Date.parse(start) - Date.parse(today)) / 86_400_000);
  if (offset < -1 || offset > 28) return null; // pas de planification dans le passé ni trop loin
  const days = typeof b.days === 'number' && Number.isInteger(b.days) ? Math.min(MAX_DAYS, Math.max(1, b.days)) : MAX_DAYS;
  const slots = Array.isArray(b.slots)
    ? SLOTS.filter((s) => (b.slots as unknown[]).includes(s))
    : (['lunch', 'dinner'] as Slot[]);
  if (slots.length === 0) return null;
  const lvl = (v: unknown) => (v === 1 || v === 2 || v === 3 ? v : null);
  const maxTotal = typeof b.max_total_minutes === 'number' && Number.isFinite(b.max_total_minutes)
    ? Math.min(240, Math.max(10, Math.round(b.max_total_minutes))) : null;
  const servings = typeof b.servings === 'number' && Number.isFinite(b.servings)
    ? Math.min(12, Math.max(1, Math.round(b.servings))) : Math.min(12, Math.max(1, householdSize));

  return {
    dates: Array.from({ length: days }, (_, i) => addDays(start, i)),
    slots,
    overwrite: b.overwrite === true,
    filters: {
      focus: b.vegetarian === true ? ['anti_waste', 'balanced', 'vegetarian'] : ['anti_waste', 'balanced'],
      maxTotalMinutes: maxTotal,
      servings,
      budget: lvl(b.budget),
      difficulty: lvl(b.difficulty),
    },
  };
}

/**
 * Les recettes qui utilisent les produits les plus urgents sont placées en premier
 * dans la semaine (anti-gaspillage). Stable : à urgence égale, ordre de l'IA conservé.
 */
export function assignByUrgency<T extends { urgency: number | null }>(recipes: T[], dates: string[]): { date: string; recipe: T }[] {
  const ranked = recipes
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.urgency ?? 9999) - (b.r.urgency ?? 9999) || a.i - b.i)
    .map((x) => x.r);
  return dates.slice(0, ranked.length).map((date, i) => ({ date, recipe: ranked[i] }));
}
