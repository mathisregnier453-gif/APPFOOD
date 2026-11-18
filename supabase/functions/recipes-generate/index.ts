// POST /functions/v1/recipes-generate
// { "filters": { "focus": ["anti_waste"], "max_total_minutes": 30, "servings": 2,
//                "budget": 1, "difficulty": 1, "meal_type": "dinner" }, "count": 3 }
//
// - Le stock est lu CÔTÉ SERVEUR (jamais fourni par l'app).
// - Disponible / manquant est recalculé par le serveur (voir _shared/ai/recipes.ts).
// - Quota de recettes vérifié et décompté côté serveur ; seules les recettes livrées comptent.
// - Cache 24 h : même stock + mêmes filtres + mêmes préférences = aucun appel IA.
import { adminClient, authenticate, corsHeaders, errorResponse, json, sha256Hex, todayUtc } from '../_shared/http.ts';
import { parseRecipeRequest } from '../_shared/recipe-request.ts';
import { generateAndStore, loadRecipeContext, resolveHousehold, ServiceError } from '../_shared/recipe-service.ts';

const CACHE_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');

  const admin = adminClient();
  const user = await authenticate(req, admin);
  if (!user) return errorResponse(401, 'unauthorized');

  try {
    const { householdId, householdSize } = await resolveHousehold(admin, user.id);
    const parsed = parseRecipeRequest(await req.json().catch(() => null), householdSize);
    if (!parsed) return errorResponse(400, 'invalid_body');

    const ctx = await loadRecipeContext(admin, user.id, householdId, todayUtc());

    const requestHash = await sha256Hex(JSON.stringify({ inventory: ctx.inventory, filters: parsed.filters, preferences: ctx.preferences, count: parsed.count, v: 1 }));
    const since = new Date(Date.now() - CACHE_HOURS * 3_600_000).toISOString();
    const { data: cached } = await admin
      .from('recipe_generations').select('id')
      .eq('household_id', householdId).eq('request_hash', requestHash).gte('created_at', since)
      .gt('recipe_count', 0).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (cached) {
      const { data: cachedRecipes } = await admin.from('recipes').select('id').eq('generation_id', cached.id);
      if (cachedRecipes && cachedRecipes.length > 0) {
        return json({ generation_id: cached.id, recipe_ids: cachedRecipes.map((r) => r.id), from_cache: true, recipes_consumed: 0 });
      }
    }

    const outcome = await generateAndStore(admin, ctx, {
      userId: user.id, householdId, filters: parsed.filters, count: parsed.count, requestHash,
    });
    return json({
      generation_id: outcome.generationId,
      recipe_ids: outcome.recipes.map((r) => r.id),
      from_cache: false,
      recipes_consumed: outcome.recipes.length,
      rejected: outcome.rejected,
      quota: outcome.quota,
    });
  } catch (err) {
    if (err instanceof ServiceError) return errorResponse(err.status, err.code, err.details);
    console.error('recipes-generate', err);
    return errorResponse(500, 'internal');
  }
});
