import type { CategoryId, FoodUnit, StorageKind } from './types';

// Libellés UI. Les identifiants sont identiques à la table food_categories.
export const CATEGORIES: { id: CategoryId; label: string; icon: string; tint: string }[] = [
  { id: 'fruits', label: 'Fruits', icon: 'nutrition-outline', tint: '#F3E3D3' },
  { id: 'vegetables', label: 'Légumes', icon: 'leaf-outline', tint: '#DCE7DC' },
  { id: 'meat', label: 'Viandes', icon: 'restaurant-outline', tint: '#F2DCD9' },
  { id: 'fish', label: 'Poissons', icon: 'fish-outline', tint: '#DCE8F0' },
  { id: 'dairy', label: 'Produits laitiers', icon: 'water-outline', tint: '#E8EEF5' },
  { id: 'cheese', label: 'Fromages', icon: 'pizza-outline', tint: '#F6EBCB' },
  { id: 'drinks', label: 'Boissons', icon: 'wine-outline', tint: '#E9E1F0' },
  { id: 'starches', label: 'Féculents', icon: 'basket-outline', tint: '#EFE6D8' },
  { id: 'canned', label: 'Conserves', icon: 'cube-outline', tint: '#E6E3DC' },
  { id: 'frozen', label: 'Surgelés', icon: 'snow-outline', tint: '#DDEEF2' },
  { id: 'fresh', label: 'Produits frais', icon: 'egg-outline', tint: '#F4EEDC' },
  { id: 'other', label: 'Autres', icon: 'ellipsis-horizontal-outline', tint: '#ECEAE4' },
];

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const UNITS: { id: FoodUnit; label: string; short: string; step: number }[] = [
  { id: 'piece', label: 'Pièce', short: 'pc', step: 1 },
  { id: 'pack', label: 'Paquet', short: 'paq.', step: 1 },
  { id: 'g', label: 'Gramme', short: 'g', step: 50 },
  { id: 'kg', label: 'Kilogramme', short: 'kg', step: 0.5 },
  { id: 'ml', label: 'Millilitre', short: 'ml', step: 100 },
  { id: 'l', label: 'Litre', short: 'L', step: 0.5 },
];

export const unitById = (id: FoodUnit) => UNITS.find((u) => u.id === id) ?? UNITS[0];

export const STORAGE: { kind: StorageKind; label: string; icon: string; hint: string }[] = [
  { kind: 'fridge', label: 'Réfrigérateur', icon: 'thermometer-outline', hint: 'Photographiez chaque étage, porte comprise.' },
  { kind: 'freezer', label: 'Congélateur', icon: 'snow-outline', hint: 'Ouvrez les tiroirs pour que les étiquettes soient visibles.' },
  { kind: 'pantry', label: 'Placards', icon: 'file-tray-stacked-outline', hint: 'Une photo par étagère, bien éclairée.' },
];

export const storageByKind = (kind: StorageKind) => STORAGE.find((s) => s.kind === kind) ?? STORAGE[0];

export function formatQuantity(quantity: number | null, unit: FoodUnit, isEstimate = false): string {
  if (quantity === null) return 'Quantité à préciser';
  const n = Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const u = unitById(unit);
  const label = unit === 'piece' ? (quantity > 1 ? 'pièces' : 'pièce') : unit === 'pack' ? (quantity > 1 ? 'paquets' : 'paquet') : u.short;
  return `${isEstimate ? '≈ ' : ''}${n} ${label}`;
}
