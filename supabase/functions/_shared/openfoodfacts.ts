// Conversion d'une fiche Open Food Facts en produit Sauge (module pur, testé).
import type { FoodCategory, FoodUnit } from './ai/types.ts';

export interface ProductInfo {
  found: boolean;
  name: string | null;
  brand: string | null;
  quantity_text: string | null;
  quantity: number | null;
  unit: FoodUnit | null;
  category_id: FoodCategory | null;
  image_url: string | null;
}

export const NOT_FOUND: ProductInfo = {
  found: false, name: null, brand: null, quantity_text: null, quantity: null, unit: null, category_id: null, image_url: null,
};

// Ordre significatif : la règle la plus spécifique d'abord (jus => boisson avant fruit, fromage avant laitier…).
const CATEGORY_RULES: [FoodCategory, string[]][] = [
  ['frozen', ['en:frozen-foods']],
  ['drinks', ['en:beverages', 'en:waters', 'en:sodas', 'en:juices', 'en:fruit-juices', 'en:wines', 'en:beers', 'en:alcoholic-beverages', 'en:coffees', 'en:teas']],
  ['cheese', ['en:cheeses']],
  ['dairy', ['en:dairies', 'en:milks', 'en:yogurts', 'en:creams', 'en:butters', 'en:dairy-desserts']],
  ['canned', ['en:canned-foods', 'en:canned-vegetables', 'en:canned-fishes']],
  ['fish', ['en:fishes', 'en:seafood', 'en:smoked-fishes']],
  ['meat', ['en:meats', 'en:poultries', 'en:hams', 'en:sausages', 'en:prepared-meats']],
  ['starches', ['en:pastas', 'en:rices', 'en:breads', 'en:cereals-and-potatoes', 'en:breakfast-cereals', 'en:legumes', 'en:flours']],
  ['vegetables', ['en:vegetables', 'en:fresh-vegetables', 'en:vegetables-based-foods']],
  ['fruits', ['en:fruits', 'en:fresh-fruits']],
  ['fresh', ['en:eggs', 'en:fresh-foods']],
];

export function mapCategory(tags: unknown): FoodCategory | null {
  if (!Array.isArray(tags)) return null;
  const set = new Set(tags.filter((t): t is string => typeof t === 'string'));
  for (const [cat, keys] of CATEGORY_RULES) if (keys.some((k) => set.has(k))) return cat;
  return null;
}

/** "500 g", "1,5 kg", "75 cl", "1L", "6 x 125 g" => quantité + unité Sauge. */
export function parseQuantity(text: unknown): { quantity: number; unit: FoodUnit } | null {
  if (typeof text !== 'string') return null;
  const t = text.toLowerCase().replace(',', '.').trim();
  const multi = t.match(/^(\d+)\s*[x×*]\s*\d/);
  if (multi) {
    const n = Number(multi[1]);
    return n > 0 && n <= 100 ? { quantity: n, unit: 'piece' } : null;
  }
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(kg|g|gr|mg|l|cl|ml|litres?|pièces?|pieces?|pcs?)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0)) return null;
  switch (m[2]) {
    case 'kg': return { quantity: n, unit: 'kg' };
    case 'g': case 'gr': return { quantity: n, unit: 'g' };
    case 'mg': return { quantity: Math.round(n / 10) / 100, unit: 'g' };
    case 'l': case 'litre': case 'litres': return { quantity: n, unit: 'l' };
    case 'cl': return { quantity: n * 10, unit: 'ml' };
    case 'ml': return { quantity: n, unit: 'ml' };
    default: return { quantity: n, unit: 'piece' };
  }
}

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}

export function parseOffResponse(body: unknown): ProductInfo {
  if (typeof body !== 'object' || body === null) return NOT_FOUND;
  const b = body as Record<string, unknown>;
  const p = b.product as Record<string, unknown> | undefined;
  if (b.status !== 1 || !p) return NOT_FOUND;
  const name = clean(p.product_name_fr, 80) ?? clean(p.product_name, 80) ?? clean(p.generic_name_fr, 80);
  if (!name) return NOT_FOUND;
  const quantityText = clean(p.quantity, 40);
  const q = parseQuantity(quantityText);
  const image = clean(p.image_front_small_url, 300);
  return {
    found: true,
    name,
    brand: clean(typeof p.brands === 'string' ? p.brands.split(',')[0] : null, 60),
    quantity_text: quantityText,
    quantity: q?.quantity ?? null,
    unit: q?.unit ?? null,
    category_id: mapCategory(p.categories_tags),
    image_url: image && image.startsWith('https://') ? image : null,
  };
}
