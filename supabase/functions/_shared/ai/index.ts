// Point d'entrée unique de la couche IA. Fournisseur et modèles se choisissent
// par variables d'environnement (secrets Supabase), sans toucher à l'app :
//   AI_PROVIDER=anthropic
//   AI_VISION_MODEL=claude-opus-5-5    AI_VISION_EFFORT=low
//   AI_RECIPE_MODEL=claude-opus-5-5    AI_RECIPE_EFFORT=low
//   ANTHROPIC_API_KEY=...              (jamais dans l'app mobile)
// Voir docs/AI_COSTS.md pour le choix des modèles.
import { AnthropicRecipeProvider, AnthropicVisionProvider, type Effort } from './providers/anthropic.ts';
import { AiProviderError, type FoodVisionProvider, type RecipeProvider } from './types.ts';

export * from './types.ts';

type Env = (key: string) => string | undefined;

const DEFAULT_MODEL = 'claude-opus-5-5';

function effortFrom(value: string | undefined, fallback: Effort): Effort {
  return value === 'low' || value === 'medium' || value === 'high' ? value : fallback;
}

function provider(env: Env): string {
  return env('AI_PROVIDER') ?? 'anthropic';
}

function anthropicKey(env: Env): string {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) throw new AiProviderError('config', 'ANTHROPIC_API_KEY manquante');
  return apiKey;
}

let vision: FoodVisionProvider | null = null;
let recipes: RecipeProvider | null = null;

export function getVisionProvider(env: Env): FoodVisionProvider {
  if (vision) return vision;
  switch (provider(env)) {
    case 'anthropic':
      vision = new AnthropicVisionProvider({
        apiKey: anthropicKey(env),
        model: env('AI_VISION_MODEL') ?? DEFAULT_MODEL,
        effort: effortFrom(env('AI_VISION_EFFORT'), 'low'),
      });
      return vision;
    // Ajouter ici un autre fournisseur : implémenter FoodVisionProvider dans providers/.
    default:
      throw new AiProviderError('config', `Fournisseur IA inconnu : ${provider(env)}`);
  }
}

export function getRecipeProvider(env: Env): RecipeProvider {
  if (recipes) return recipes;
  switch (provider(env)) {
    case 'anthropic':
      recipes = new AnthropicRecipeProvider({
        apiKey: anthropicKey(env),
        model: env('AI_RECIPE_MODEL') ?? DEFAULT_MODEL,
        effort: effortFrom(env('AI_RECIPE_EFFORT'), 'low'),
      });
      return recipes;
    default:
      throw new AiProviderError('config', `Fournisseur IA inconnu : ${provider(env)}`);
  }
}
