// Brouillons d'ajout au stock, communs aux trois méthodes gratuites
// (codes-barres, ticket de caisse, saisie). Module pur, testé.
import type { CategoryId, ExpiryKind, FoodUnit, StorageKind } from '@/lib/types';

export type CaptureMethod = 'barcode' | 'receipt' | 'manual';

export interface CaptureDraft {
  key: string;
  name: string;
  category: CategoryId;
  quantity: number | null;
  unit: FoodUnit;
  expiryInput: string;
  expiryKind: ExpiryKind | null;
  storage: StorageKind;
  barcode: string | null;
  /** valeurs proposées automatiquement, pour mesurer les corrections */
  original: { name: string; quantity: number | null; unit: FoodUnit; category: CategoryId };
  needsReview: boolean;
}

export function defaultStorage(category: CategoryId): StorageKind {
  if (category === 'frozen') return 'freezer';
  if (['canned', 'starches', 'drinks', 'other'].includes(category)) return 'pantry';
  return 'fridge';
}

export function makeDraft(p: {
  name: string; category: CategoryId; quantity: number | null; unit: FoodUnit; barcode?: string | null; needsReview?: boolean;
}): CaptureDraft {
  return {
    key: p.barcode ? `bc-${p.barcode}` : `d-${Math.random().toString(36).slice(2, 10)}`,
    name: p.name, category: p.category, quantity: p.quantity, unit: p.unit,
    expiryInput: '', expiryKind: null, storage: defaultStorage(p.category), barcode: p.barcode ?? null,
    original: { name: p.name, quantity: p.quantity, unit: p.unit, category: p.category },
    needsReview: p.needsReview ?? false,
  };
}

/** Code-barres scanné : nouveau produit, ou +1 unité si déjà dans la liste. */
export function addScannedBarcode(drafts: CaptureDraft[], product: {
  barcode: string; name: string | null; category: CategoryId | null; quantity: number | null; unit: FoodUnit | null; found: boolean;
}): CaptureDraft[] {
  const existing = drafts.find((d) => d.barcode === product.barcode);
  if (existing) {
    return drafts.map((d) => (d === existing
      ? { ...d, quantity: d.unit === 'piece' ? (d.quantity ?? 1) + 1 : d.quantity, original: { ...d.original, quantity: d.unit === 'piece' ? (d.original.quantity ?? 1) + 1 : d.original.quantity } }
      : d));
  }
  // Produit inconnu d'Open Food Facts : ligne à compléter, jamais de nom inventé.
  const name = product.found && product.name ? product.name : '';
  return [
    makeDraft({
      name,
      category: product.category ?? 'other',
      // Un paquet scanné = 1 unité ; le poids/volume imprimé reste en information.
      quantity: 1,
      unit: 'piece',
      barcode: product.barcode,
      needsReview: !product.found,
    }),
    ...drafts,
  ];
}

export interface CaptureStats {
  detected: number;
  confirmed: number;
  corrected: number;
  removed: number;
}

/** Mesure de la qualité : combien de propositions l'utilisateur a dû corriger ou supprimer. */
export function captureStats(initial: CaptureDraft[], final: CaptureDraft[]): CaptureStats {
  const finalByKey = new Map(final.map((d) => [d.key, d]));
  let corrected = 0;
  let removed = 0;
  for (const d of initial) {
    const f = finalByKey.get(d.key);
    if (!f) { removed++; continue; }
    const o = f.original;
    if (f.name.trim().toLowerCase() !== o.name.trim().toLowerCase() || f.category !== o.category || f.unit !== o.unit || f.quantity !== o.quantity) corrected++;
  }
  return { detected: initial.length, confirmed: final.length, corrected, removed };
}
