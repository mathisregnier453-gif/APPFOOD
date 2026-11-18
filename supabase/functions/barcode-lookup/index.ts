// POST /functions/v1/barcode-lookup  { "barcode": "3017620422003" }
// Recherche d'un produit sur Open Food Facts, via un cache partagé (product_cache) :
// moins d'appels externes, réponse instantanée pour les produits courants,
// et l'adresse IP / l'identité de l'utilisateur ne sont jamais transmises à OFF.
import { adminClient, authenticate, corsHeaders, env, errorResponse, json, logServerError } from '../_shared/http.ts';
import { NOT_FOUND, parseOffResponse, type ProductInfo } from '../_shared/openfoodfacts.ts';

const FOUND_TTL_DAYS = 30;
const NOT_FOUND_TTL_HOURS = 24;
const OFF_FIELDS = 'product_name,product_name_fr,generic_name_fr,brands,quantity,categories_tags,image_front_small_url';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');

  const admin = adminClient();
  const user = await authenticate(req, admin);
  if (!user) return errorResponse(401, 'unauthorized');

  const body = await req.json().catch(() => null);
  const barcode = typeof body?.barcode === 'string' ? body.barcode.trim() : '';
  if (!/^[0-9]{8,14}$/.test(barcode)) return errorResponse(400, 'invalid_barcode');

  const { data: cached } = await admin.from('product_cache').select('*').eq('barcode', barcode).maybeSingle();
  if (cached) {
    const ageMs = Date.now() - Date.parse(cached.fetched_at);
    const ttl = cached.found ? FOUND_TTL_DAYS * 86_400_000 : NOT_FOUND_TTL_HOURS * 3_600_000;
    if (ageMs < ttl) return json({ barcode, ...toInfo(cached), from_cache: true });
  }

  let info: ProductInfo;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${OFF_FIELDS}`, {
      headers: { 'User-Agent': env('OFF_USER_AGENT') ?? 'Sauge/1.0 (gestion alimentaire)' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 404) info = NOT_FOUND;
    else if (!res.ok) return errorResponse(503, 'lookup_unavailable');
    else info = parseOffResponse(await res.json());
  } catch (err) {
    await logServerError(admin, 'barcode-lookup', 'off_unavailable', err, user.id);
    // Service externe indisponible : on renvoie l'ancienne fiche si on en a une.
    if (cached?.found) return json({ barcode, ...toInfo(cached), from_cache: true, stale: true });
    return errorResponse(503, 'lookup_unavailable');
  }

  await admin.from('product_cache').upsert({ barcode, ...info, fetched_at: new Date().toISOString() });
  return json({ barcode, ...info, from_cache: false });
});

function toInfo(row: Record<string, unknown>): ProductInfo {
  return {
    found: row.found === true,
    name: (row.name as string) ?? null,
    brand: (row.brand as string) ?? null,
    quantity_text: (row.quantity_text as string) ?? null,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: (row.unit as ProductInfo['unit']) ?? null,
    category_id: (row.category_id as ProductInfo['category_id']) ?? null,
    image_url: (row.image_url as string) ?? null,
  };
}
