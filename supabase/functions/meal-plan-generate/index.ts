// POST /functions/v1/meal-plan-generate
// { "start_date": "2026-11-23", "days": 7, "slots": ["lunch", "dinner"], "servings": 2,
//   "budget": 1, "max_total_minutes": 45, "vegetarian": false, "overwrite": false }
//
// Génère les repas manquants de la semaine à partir du stock réel, des préférences,
// du nombre de personnes, du budget et du temps disponible. Les repas déjà planifiés
// par l'utilisateur ne sont jamais écrasés, sauf overwrite = true.
// Une génération par type de repas (en parallèle), recettes décomptées du quota.
import { adminClient, authenticate, corsHeaders, errorResponse, json, logServerError, sha256Hex, todayUtc } from '../_shared/http.ts';
import { assignByUrgency, parseMealPlanRequest } from '../_shared/meal-plan.ts';
import { type GenerationOutcome, generateAndStore, loadRecipeContext, resolveHousehold, ServiceError } from '../_shared/recipe-service.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');

  const admin = adminClient();
  const user = await authenticate(req, admin);
  if (!user) return errorResponse(401, 'unauthorized');

  try {
    const { householdId, householdSize } = await resolveHousehold(admin, user.id);
    // Planning = fonction des offres payantes, vérifiée côté serveur.
    const { data: allowed } = await admin.rpc('plan_has_feature', { p_household: householdId, p_feature: 'meal_plan' });
    if (allowed !== true) return errorResponse(402, 'feature_locked', { feature: 'meal_plan' });
    const today = todayUtc();
    const plan = parseMealPlanRequest(await req.json().catch(() => null), today, householdSize);
    if (!plan) return errorResponse(400, 'invalid_body');

    // Créneaux libres (on ne remplace pas les choix de l'utilisateur)
    const { data: existing } = await admin
      .from('meal_plans').select('plan_date, slot')
      .eq('household_id', householdId).in('plan_date', plan.dates);
    const taken = new Set((existing ?? []).map((m) => `${m.plan_date}|${m.slot}`));
    const todo = plan.slots
      .map((slot) => ({ slot, dates: plan.dates.filter((d) => plan.overwrite || !taken.has(`${d}|${slot}`)) }))
      .filter((s) => s.dates.length > 0);
    if (todo.length === 0) return json({ planned: 0, recipes_consumed: 0, message: 'already_planned' });

    const ctx = await loadRecipeContext(admin, user.id, householdId, today);
    const requestHash = await sha256Hex(JSON.stringify({ plan, inventory: ctx.inventory, t: Date.now() }));

    // Une génération par type de repas, en parallèle (temps de réponse ~ un seul appel).
    const results = await Promise.allSettled(todo.map((t) =>
      generateAndStore(admin, ctx, {
        userId: user.id, householdId, requestHash,
        filters: { ...plan.filters, mealType: t.slot },
        count: t.dates.length,
      })));

    let planned = 0;
    let consumed = 0;
    let quota: GenerationOutcome['quota'] | undefined;
    let firstError: ServiceError | null = null;

    for (const [i, res] of results.entries()) {
      if (res.status === 'rejected') {
        if (!firstError) firstError = res.reason instanceof ServiceError ? res.reason : new ServiceError(500, 'internal');
        continue;
      }
      consumed += res.value.recipes.length;
      quota = res.value.quota;
      const rows = assignByUrgency(res.value.recipes, todo[i].dates).map(({ date, recipe }) => ({
        household_id: householdId, plan_date: date, slot: todo[i].slot, recipe_id: recipe.id,
        servings: plan.filters.servings, is_cooked: false, created_by: user.id,
      }));
      const { error } = await admin.from('meal_plans').upsert(rows, { onConflict: 'household_id,plan_date,slot' });
      if (error) throw new ServiceError(500, 'plan_write_error');
      planned += rows.length;
    }

    if (planned === 0 && firstError) return errorResponse(firstError.status, firstError.code, firstError.details);
    return json({ planned, recipes_consumed: consumed, partial: !!firstError, quota });
  } catch (err) {
    if (err instanceof ServiceError) return errorResponse(err.status, err.code, err.details);
    console.error('meal-plan-generate', err);
    await logServerError(admin, 'meal-plan-generate', 'internal', err, user.id);
    return errorResponse(500, 'internal');
  }
});
