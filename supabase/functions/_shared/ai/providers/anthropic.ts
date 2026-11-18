import Anthropic from '@anthropic-ai/sdk';
import { normalizeDetections } from '../normalize.ts';
import { estimateCostUsd } from '../pricing.ts';
import { SCAN_OUTPUT_SCHEMA, SCAN_SYSTEM_PROMPT, scanUserPrompt } from '../prompts.ts';
import { normalizeRecipes, RECIPE_OUTPUT_SCHEMA, RECIPE_SYSTEM_PROMPT, recipeUserPrompt } from '../recipes.ts';
import {
  type AiUsage,
  AiProviderError,
  type FoodDetectionRequest,
  type FoodDetectionResult,
  type FoodVisionProvider,
  type RecipeGenerationResult,
  type RecipeProvider,
  type RecipeRequest,
} from '../types.ts';

// Modèles qui acceptent le repli serveur automatique en cas de refus.
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-opus-5', 'claude-fable-5-2']);

export type Effort = 'low' | 'medium' | 'high';

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  /** Profondeur de raisonnement : plus bas = moins cher. */
  effort: Effort;
}

/** Appel unique à sortie JSON structurée, avec gestion d'erreurs et mesure du coût. */
async function structuredCall(
  client: Anthropic,
  opts: AnthropicOptions,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  schema: unknown,
): Promise<{ json: unknown; usage: AiUsage }> {
  const started = Date.now();
  const useFallback = SERVER_FALLBACK_MODELS.has(opts.model);

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: opts.model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content }],
      output_config: {
        effort: opts.effort,
        format: { type: 'json_schema', schema: schema as Record<string, unknown> },
      },
      ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new AiProviderError('rate_limited', err.message);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new AiProviderError('config', err.message);
    }
    if (err instanceof Anthropic.BadRequestError) throw new AiProviderError('invalid_output', err.message);
    if (err instanceof Anthropic.APIError) throw new AiProviderError('unavailable', err.message);
    throw new AiProviderError('unavailable', err instanceof Error ? err.message : String(err));
  }

  const usage: AiUsage = {
    provider: 'anthropic',
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd: estimateCostUsd(response.model, response.usage.input_tokens, response.usage.output_tokens),
    latencyMs: Date.now() - started,
  };

  if (response.stop_reason === 'refusal') throw new AiProviderError('refused', 'Requête refusée par le modèle', usage);
  if (response.stop_reason === 'max_tokens') throw new AiProviderError('truncated', 'Réponse tronquée', usage);

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  try {
    return { json: JSON.parse(text), usage };
  } catch {
    throw new AiProviderError('invalid_output', 'Sortie JSON invalide', usage);
  }
}

export class AnthropicVisionProvider implements FoodVisionProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly opts: AnthropicOptions;

  constructor(opts: AnthropicOptions) {
    this.opts = opts;
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 2, timeout: 90_000 });
  }

  async detectFoods(req: FoodDetectionRequest): Promise<FoodDetectionResult> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...req.images.map((img): Anthropic.Beta.BetaImageBlockParam => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
      })),
      { type: 'text', text: scanUserPrompt(req.storageKind, req.today, req.images.length) },
    ];
    const { json, usage } = await structuredCall(this.client, this.opts, SCAN_SYSTEM_PROMPT, content, SCAN_OUTPUT_SCHEMA);
    return { items: normalizeDetections(json, { today: req.today, photoCount: req.images.length }), usage };
  }
}

export class AnthropicRecipeProvider implements RecipeProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly opts: AnthropicOptions;

  constructor(opts: AnthropicOptions) {
    this.opts = opts;
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async generateRecipes(req: RecipeRequest): Promise<RecipeGenerationResult> {
    // On demande une recette de plus que nécessaire : marge si l'une est écartée
    // par les contrôles (allergènes, durée). Seules les recettes conservées sont décomptées.
    const asked = Math.min(req.count + 1, 8);
    const { json, usage } = await structuredCall(
      this.client, this.opts, RECIPE_SYSTEM_PROMPT,
      [{ type: 'text', text: recipeUserPrompt({ ...req, count: asked }) }],
      RECIPE_OUTPUT_SCHEMA,
    );
    const { recipes, rejected } = normalizeRecipes(json, {
      inventory: req.inventory, filters: req.filters, preferences: req.preferences, max: req.count,
    });
    return { recipes, rejected, usage };
  }
}
