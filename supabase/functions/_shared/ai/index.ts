// Point d'entrée unique de la couche IA. Par défaut l'application n'utilise
// AUCUNE IA payante : recettes et planning passent par le moteur « catalog ».
// Fournisseurs optionnels, par variables d'environnement (secrets Supabase) :
//   AI_RECIPE_PROVIDER=catalog (défaut) | anthropic
//   AI_PROVIDER=anthropic              (scan photo, désactivé dans l'app)
//   AI_VISION_MODEL=claude-opus-5-5    AI_VISION_EFFORT=low
//   AI_RECIPE_MODEL=claude-opus-5-5    AI_RECIPE_EFFORT=low
//   ANTHROPIC_API_KEY=...              (jamais dans l'app mobile)
// Voir docs/AI_COSTS.md pour le choix des modèles.
import { CatalogRecipeProvider } from '../catalog/engine.ts';
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

// Recettes : moteur gratuit sur la base Sauge par défaut (aucune IA payante).
// AI_RECIPE_PROVIDER=anthropic réactive l'ancien moteur IA si besoin.
export function getRecipeProvider(env: Env): RecipeProvider {
  if (recipes) return recipes;
  switch (env('AI_RECIPE_PROVIDER') ?? 'catalog') {
    case 'catalog':
      recipes = new CatalogRecipeProvider();
      return recipes;
    case 'anthropic':
      recipes = new AnthropicRecipeProvider({
        apiKey: anthropicKey(env),
        model: env('AI_RECIPE_MODEL') ?? DEFAULT_MODEL,
        effort: effortFrom(env('AI_RECIPE_EFFORT'), 'low'),
      });
      return recipes;
    default:
      throw new AiProviderError('config', `Fournisseur de recettes inconnu : ${env('AI_RECIPE_PROVIDER')}`);
  }
}
