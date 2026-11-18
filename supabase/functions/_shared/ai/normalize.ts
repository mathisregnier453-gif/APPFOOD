// Validation stricte de la sortie IA. Tout ce qui est douteux est rejeté ou
// ramené à "inconnu" plutôt qu'inventé. Module pur (aucune dépendance runtime)
// => testé avec `node --test` (voir supabase/tests).
import {
  type DetectedFood,
  type ExpiryKind,
  FOOD_CATEGORIES,
  FOOD_UNITS,
  type FoodCategory,
  type FoodUnit,
} from './types.ts';

export const MAX_ITEMS_PER_SCAN = 150;

const CATEGORY_SET = new Set<string>(FOOD_CATEGORIES);
const UNIT_SET = new Set<string>(FOOD_UNITS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (name.length < 2) return null;
  return name.charAt(0).toLocaleUpperCase('fr-FR') + name.slice(1);
}

function cleanQuantity(v: unknown, unit: FoodUnit): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  const max = unit === 'g' || unit === 'ml' ? 50_000 : 500;
  if (v > max) return null;
  return Math.round(v * 100) / 100;
}

/** Date ISO valide, plausible (pas plus de 2 ans dans le passé ni 10 ans dans le futur). */
export function cleanExpiryDate(v: unknown, today: string): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  const ref = new Date(`${today}T00:00:00Z`).getTime();
  const day = 86_400_000;
  if (d.getTime() < ref - 730 * day || d.getTime() > ref + 3650 * day) return null;
  return v;
}

function cleanConfidence(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(v * 100) / 100));
}

export function normalizeDetections(raw: unknown, opts: { today: string; photoCount: number }): DetectedFood[] {
  const list = isRecord(raw) && Array.isArray(raw.items) ? raw.items : [];
  const out: DetectedFood[] = [];
  const byKey = new Map<string, DetectedFood>();

  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const name = cleanName(entry.name);
    if (!name) continue;

    const unit: FoodUnit = typeof entry.unit === 'string' && UNIT_SET.has(entry.unit) ? (entry.unit as FoodUnit) : 'piece';
    const category: FoodCategory =
      typeof entry.category === 'string' && CATEGORY_SET.has(entry.category) ? (entry.category as FoodCategory) : 'other';
    const quantity = cleanQuantity(entry.quantity, unit);

    // Une date n'est conservée que si l'IA déclare l'avoir LUE sur l'emballage.
    const expiryDate = entry.expiry_visible === true ? cleanExpiryDate(entry.expiry_date, opts.today) : null;
    const expiryKind: ExpiryKind | null =
      expiryDate && (entry.expiry_kind === 'dlc' || entry.expiry_kind === 'ddm') ? entry.expiry_kind : null;

    const photoIndex =
      typeof entry.photo_index === 'number' && Number.isInteger(entry.photo_index) &&
        entry.photo_index >= 0 && entry.photo_index < opts.photoCount
        ? entry.photo_index
        : null;

    const item: DetectedFood = {
      name,
      category,
      quantity,
      unit,
      // Toute quantité issue d'une photo reste une estimation, sauf poids/volume lu sur l'étiquette.
      quantityIsEstimate: quantity === null ? true : entry.quantity_from_label !== true,
      expiryDate,
      expiryKind,
      confidence: cleanConfidence(entry.confidence),
      photoIndex,
    };

    // Fusion des doublons (même produit vu sur deux photos qui se chevauchent) :
    // on garde la meilleure confiance, on n'additionne PAS les quantités
    // (risque de double comptage) — l'utilisateur corrige à la validation.
    const key = `${name.toLocaleLowerCase('fr-FR')}|${unit}|${expiryDate ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      if (item.confidence > existing.confidence) Object.assign(existing, item);
      continue;
    }
    byKey.set(key, item);
    out.push(item);
    if (out.length >= MAX_ITEMS_PER_SCAN) break;
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}
