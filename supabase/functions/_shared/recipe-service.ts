// Service de génération de recettes partagé par recipes-generate et meal-plan-generate.
// Responsabilités : contexte (stock réel + préférences), quota atomique,
// appel IA, persistance, remboursement, journalisation des coûts.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AiProviderError, type AiUsage, type DietaryProfile, type FoodCategory, type FoodUnit, type GeneratedRecipe,
  getRecipeProvider, type InventoryEntry, type RecipeFilters,
} from './ai/index.ts';
import { env, logServerError } from './http.ts';
import { cleanPreferenceList } from './recipe-request.ts';

export const MAX_INVENTORY = 120;
const DAY_MS = 86_400_000;

export interface RecipeContext {
  inventory: InventoryEntry[];
  refToId: Map<number, string>;
  preferences: DietaryProfile;
  today: string;
}

export class ServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  constructor(status: number, code: string, details: Record<string, unknown> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function loadRecipeContext(admin: SupabaseClient, userId: string, householdId: string, today: string): Promise<RecipeContext> {
  const { data: items, error } = await admin
    .from('food_items')
    .select('id, name, category_id, quantity, unit, expiry_date')
    .eq('household_id', householdId).is('finished_at', null)
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .limit(MAX_INVENTORY);
  if (error) throw new ServiceError(500, 'inventory_error');

  const refToId = new Map<number, string>();
  const inventory: InventoryEntry[] = (items ?? [])
    .map((it) => ({
      id: it.id as string,
      name: String(it.name).replace(/[\n\r|#]/g, ' ').slice(0, 80),
      category: it.category_id as FoodCategory,
      quantity: it.quantity === null ? null : Number(it.quantity),
      unit: it.unit as FoodUnit,
      daysToExpiry: it.expiry_date ? Math.round((Date.parse(it.expiry_date) - Date.parse(today)) / DAY_MS) : null,
    }))
    // Les produits périmés depuis plus d'une semaine ne sont pas proposés à l'IA.
    .filter((it) => it.daysToExpiry === null || it.daysToExpiry >= -7)
    .map(({ id, ...it }, i) => {
      refToId.set(i + 1, id);
      return { ...it, ref: i + 1 };
    });
  if (inventory.length === 0) throw new ServiceError(422, 'empty_inventory');

  const { data: prefRow } = await admin
    .from('dietary_preferences').select('diets, allergies, dislikes').eq('user_id', userId).maybeSingle();
  // Foyer partagé : les allergies de TOUS les membres sont exclues (sécurité),
  // régimes et goûts restent ceux de la personne qui demande.
  const { data: householdAllergies } = await admin.rpc('household_allergies', { p_household: householdId });
  return {
    inventory,
    refToId,
    today,
    preferences: {
      diets: cleanPreferenceList(prefRow?.diets, 10),
      allergies: cleanPreferenceList([...(prefRow?.allergies ?? []), ...(householdAllergies ?? [])], 40),
      dislikes: cleanPreferenceList(prefRow?.dislikes, 30),
    },
  };
}

export interface StoredRecipe {
  id: string;
  /** Jours avant la péremption la plus proche parmi les ingrédients du stock (null = aucune date). */
  urgency: number | null;
}

export interface GenerationOutcome {
  generationId: string;
  recipes: StoredRecipe[];
  rejected: number;
  quota: { recipes_used: number; recipes_limit: number; plan: string };
}

function urgencyOf(r: GeneratedRecipe, inventory: InventoryEntry[]): number | null {
  const days = r.ingredients
    .map((i) => (i.inventoryRef === null ? null : inventory.find((e) => e.ref === i.inventoryRef)?.daysToExpiry ?? null))
    .filter((d): d is number => d !== null);
  return days.length ? Math.min(...days) : null;
}

export async function generateAndStore(
  admin: SupabaseClient,
  ctx: RecipeContext,
  opts: { userId: string; householdId: string; filters: RecipeFilters; count: number; requestHash: string },
): Promise<GenerationOutcome> {
  // Quota atomique : accorde au plus ce qui reste, jamais de dépassement.
  const { data: quotaRows, error: quotaError } = await admin.rpc('consume_recipe_quota', { p_household: opts.householdId, p_count: opts.count });
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : null;
  if (quotaError || !quota) throw new ServiceError(500, 'quota_error');
  const granted: number = quota.granted;
  if (granted === 0) {
    throw new ServiceError(402, 'quota_exceeded', { recipes_used: quota.recipes_used, recipes_limit: quota.recipes_limit, plan: quota.plan });
  }

  let usage: AiUsage | undefined;
  let refunded = 0;
  try {
    const result = await getRecipeProvider(env).generateRecipes({
      inventory: ctx.inventory, filters: opts.filters, preferences: ctx.preferences, count: granted, today: ctx.today,
    });
    usage = result.usage;
    const delivered = result.recipes.length;
    if (delivered < granted) {
      await admin.rpc('refund_recipe_quota', { p_household: opts.householdId, p_count: granted - delivered });
      refunded = granted - delivered;
    }
    if (delivered === 0) throw new AiProviderError('invalid_output', 'Aucune recette valide', usage);

    const { data: generation, error: genError } = await admin.from('recipe_generations').insert({
      household_id: opts.householdId, user_id: opts.userId, request_hash: opts.requestHash, filters: opts.filters,
      recipe_count: delivered, recipes_consumed: delivered,
      ai_provider: usage.provider, ai_model: usage.model, estimated_cost_usd: usage.costUsd,
    }).select('id').single();
    if (genError) throw new Error(`generation insert: ${genError.message}`);

    const stored: StoredRecipe[] = [];
    for (const r of result.recipes) {
      const { data: recipe, error: recipeError } = await admin.from('recipes').insert({
        household_id: opts.householdId, created_by: opts.userId, generation_id: generation.id,
        title: r.title, summary: r.summary, prep_minutes: r.prepMinutes, cook_minutes: r.cookMinutes,
        servings: r.servings, difficulty: r.difficulty, budget_level: r.budget, meal_type: r.mealType,
        tags: [...new Set([...r.tags, ...(r.usesExpiring ? ['anti-gaspi'] : [])])],
        steps: r.steps, source: 'ai', ai_model: usage.model,
      }).select('id').single();
      if (recipeError) throw new Error(`recipe insert: ${recipeError.message}`);

      const { error: ingError } = await admin.from('recipe_ingredients').insert(r.ingredients.map((ing, position) => ({
        recipe_id: recipe.id, household_id: opts.householdId, name: ing.name, quantity: ing.quantity, unit: ing.unit,
        quantity_text: ing.quantityText, category_id: ing.category,
        food_item_id: ing.inventoryRef === null ? null : ctx.refToId.get(ing.inventoryRef) ?? null,
        is_staple: ing.isStaple, is_optional: ing.isOptional, position,
      })));
      if (ingError) throw new Error(`ingredients insert: ${ingError.message}`);
      stored.push({ id: recipe.id, urgency: urgencyOf(r, ctx.inventory) });
    }

    await logUsage(admin, opts.userId, opts.householdId, true, null, usage);
    return {
      generationId: generation.id,
      recipes: stored,
      rejected: result.rejected,
      quota: { recipes_used: quota.recipes_used - (granted - delivered), recipes_limit: quota.recipes_limit, plan: quota.plan },
    };
  } catch (err) {
    // Échec => tout ce qui a été réservé et pas encore rendu est remboursé.
    if (granted - refunded > 0) await admin.rpc('refund_recipe_quota', { p_household: opts.householdId, p_count: granted - refunded });
    const code = err instanceof AiProviderError ? err.code : 'internal';
    await logUsage(admin, opts.userId, opts.householdId, false, code, err instanceof AiProviderError ? err.usage ?? usage : usage);
    console.error('recipe generation failed', { code, message: err instanceof Error ? err.message : String(err) });
    await logServerError(admin, 'recipes', code, err, opts.userId);
    throw new ServiceError(code === 'rate_limited' ? 503 : 502, 'generation_failed', { reason: code });
  }
}

async function logUsage(admin: SupabaseClient, userId: string, householdId: string, success: boolean, errorCode: string | null, usage?: AiUsage) {
  await admin.from('ai_usage_logs').insert({
    user_id: userId, household_id: householdId, feature: 'recipe',
    provider: usage?.provider ?? env('AI_PROVIDER') ?? 'anthropic',
    model: usage?.model ?? env('AI_RECIPE_MODEL') ?? 'unknown',
    input_tokens: usage?.inputTokens ?? 0, output_tokens: usage?.outputTokens ?? 0,
    cost_usd: usage?.costUsd ?? 0, latency_ms: usage?.latencyMs ?? null,
    success, error_code: errorCode,
  });
}

/** Contrôles communs : utilisateur actif, foyer courant dont il est membre. */
export async function resolveHousehold(admin: SupabaseClient, userId: string): Promise<{ householdId: string; householdSize: number }> {
  const { data: profile } = await admin
    .from('profiles').select('suspended_at, current_household_id, household_size').eq('id', userId).single();
  if (!profile) throw new ServiceError(403, 'profile_missing');
  if (profile.suspended_at) throw new ServiceError(403, 'account_suspended');
  if (!profile.current_household_id) throw new ServiceError(400, 'no_household');
  const { data: membership } = await admin
    .from('household_members').select('user_id')
    .eq('household_id', profile.current_household_id).eq('user_id', userId).maybeSingle();
  if (!membership) throw new ServiceError(403, 'forbidden');
  // Membre d'un foyer sans offre Famille : lecture seule.
  const { data: canWrite } = await admin.rpc('household_write_allowed', { p_household: profile.current_household_id, p_user: userId });
  if (canWrite !== true) throw new ServiceError(403, 'household_read_only');
  return { householdId: profile.current_household_id, householdSize: profile.household_size ?? 2 };
}
