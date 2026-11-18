// Recettes : prompt, schéma de sortie et validation stricte (module pur, testé).
//
// Garanties apportées ici, indépendamment du modèle :
// - un ingrédient n'est "disponible" que s'il pointe vers un aliment RÉEL du stock
//   ET que les noms correspondent (sinon il est requalifié "manquant") ;
// - toute recette contenant un allergène déclaré est écartée ;
// - régimes végétarien / végétalien vérifiés sur les ingrédients ;
// - durées, portions, textes bornés.
import {
  type DietaryProfile, FOOD_CATEGORIES, FOOD_UNITS, type FoodCategory, type FoodUnit,
  type GeneratedIngredient, type GeneratedRecipe, type InventoryEntry, MEAL_TYPES, type MealType,
  type RecipeFilters, type RecipeFocus,
} from './types.ts';

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------
export const RECIPE_SYSTEM_PROMPT = `Tu es le chef cuisinier d'une application anti-gaspillage. Tu proposes des recettes familiales, réalistes et savoureuses, en français, à partir du stock réel d'un foyer.

Règles impératives :
- Le stock t'est fourni sous forme de lignes "#ref | nom | quantité | péremption". Utilise-le en priorité.
- Pour chaque ingrédient provenant du stock, renseigne inventory_ref avec le numéro #ref exact. N'attribue JAMAIS un inventory_ref à un ingrédient qui n'est pas dans la liste : dans ce cas inventory_ref = null (ingrédient manquant).
- Limite les ingrédients manquants (3 au maximum par recette, hors basiques).
- Basiques de cuisine (sel, poivre, huile, vinaigre, sucre, farine, eau, épices sèches courantes) : is_staple = true et inventory_ref = null, sauf s'ils figurent dans le stock.
- Respecte STRICTEMENT les allergies et régimes indiqués : aucun ingrédient interdit, même en option.
- Évite les aliments que la personne n'aime pas.
- Quantités adaptées au nombre de personnes demandé. Utilise quantity + unit (piece, g, kg, ml, l, pack) quand c'est possible ; sinon quantity = null, unit = null et quantity_text (ex. "2 c. à soupe", "1 pincée").
- Étapes détaillées, claires, numérotables, sans numéro au début du texte.
- Temps réalistes (prep_minutes, cook_minutes). difficulty et budget de 1 (facile / économique) à 3.
- N'affirme rien de médical ou de nutritionnel chiffré. Les tags restent descriptifs (ex. "végétarien", "rapide", "riche en protéines", "anti-gaspi").
- Propose des recettes variées entre elles.`;

const FOCUS_TEXT: Record<RecipeFocus, string> = {
  stock: 'réalisables uniquement avec le stock (zéro ou un ingrédient manquant)',
  anti_waste: 'qui utilisent en priorité les produits qui périment le plus tôt',
  quick: 'rapides (30 minutes maximum au total)',
  cheap: 'économiques',
  balanced: 'équilibrées (légumes, protéines, féculents)',
  protein: 'riches en protéines',
  vegetarian: 'végétariennes (ni viande ni poisson)',
};

const MEAL_TEXT: Record<MealType, string> = {
  breakfast: 'petit-déjeuner', lunch: 'déjeuner', dinner: 'dîner', dessert: 'dessert', snack: 'en-cas',
};

function formatInventoryLine(e: InventoryEntry): string {
  const qty = e.quantity === null ? 'quantité inconnue' : `${e.quantity} ${e.unit}`;
  const exp = e.daysToExpiry === null ? 'date inconnue'
    : e.daysToExpiry < 0 ? `date dépassée depuis ${-e.daysToExpiry} j`
    : e.daysToExpiry === 0 ? "expire aujourd'hui" : `expire dans ${e.daysToExpiry} j`;
  return `#${e.ref} | ${e.name} | ${qty} | ${exp}`;
}

export function recipeUserPrompt(req: { inventory: InventoryEntry[]; filters: RecipeFilters; preferences: DietaryProfile; count: number }): string {
  const f = req.filters;
  const wishes = [
    ...f.focus.map((x) => FOCUS_TEXT[x]),
    f.maxTotalMinutes ? `${f.maxTotalMinutes} minutes maximum au total` : null,
    f.budget ? `budget ${['', 'serré', 'moyen', 'libre'][f.budget]}` : null,
    f.difficulty ? `difficulté ${['', 'facile', 'intermédiaire', 'avancée'][f.difficulty]} au maximum` : null,
    f.mealType ? `pour un ${MEAL_TEXT[f.mealType]}` : null,
  ].filter(Boolean);
  const p = req.preferences;
  return [
    `Propose ${req.count} recette${req.count > 1 ? 's' : ''} pour ${f.servings} personne${f.servings > 1 ? 's' : ''}.`,
    wishes.length ? `Souhaits : ${wishes.join(' ; ')}.` : null,
    p.diets.length ? `Régimes : ${p.diets.join(', ')}.` : null,
    p.allergies.length ? `ALLERGIES (à exclure absolument) : ${p.allergies.join(', ')}.` : null,
    p.dislikes.length ? `N'aime pas : ${p.dislikes.join(', ')}.` : null,
    '',
    'Stock disponible :',
    ...req.inventory.map(formatInventoryLine),
  ].filter((l) => l !== null).join('\n');
}

export const RECIPE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recipes'],
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'summary', 'prep_minutes', 'cook_minutes', 'servings', 'difficulty', 'budget', 'meal_type', 'tags', 'ingredients', 'steps'],
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          prep_minutes: { type: 'integer' },
          cook_minutes: { type: 'integer' },
          servings: { type: 'integer' },
          difficulty: { type: 'integer', enum: [1, 2, 3] },
          budget: { type: 'integer', enum: [1, 2, 3] },
          meal_type: { type: 'string', enum: [...MEAL_TYPES] },
          tags: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'quantity', 'unit', 'quantity_text', 'category', 'inventory_ref', 'is_staple', 'is_optional'],
              properties: {
                name: { type: 'string' },
                quantity: { type: ['number', 'null'] },
                unit: { type: ['string', 'null'], enum: [...FOOD_UNITS, null] },
                quantity_text: { type: ['string', 'null'] },
                category: { type: 'string', enum: [...FOOD_CATEGORIES] },
                inventory_ref: { type: ['integer', 'null'] },
                is_staple: { type: 'boolean' },
                is_optional: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
} as const;

// -----------------------------------------------------------------------------
// Correspondance des noms (ingrédient ↔ aliment du stock)
// -----------------------------------------------------------------------------
const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'au', 'aux', 'et', 'en', 'a', 'l', 'd',
  'frais', 'fraiche', 'fraiches', 'nature', 'bio', 'entier', 'entiere', 'demi', 'ecreme', 'gros', 'petit', 'petits',
]);

export function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function stem(word: string): string {
  if (word.length > 4 && (word.endsWith('s') || word.endsWith('x'))) return word.slice(0, -1);
  return word;
}

export function tokens(s: string): Set<string> {
  return new Set(normalizeText(s).split(' ').filter((w) => w.length >= 3 && !STOPWORDS.has(w)).map(stem));
}

export function namesMatch(ingredient: string, stockItem: string): boolean {
  const a = tokens(ingredient);
  for (const t of tokens(stockItem)) if (a.has(t)) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Allergènes et régimes (garde-fou côté serveur ; l'app rappelle de vérifier les étiquettes)
// -----------------------------------------------------------------------------
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: [
    'gluten', 'ble', 'farine', 'pain', 'pate', 'pates', 'semoule', 'orge', 'seigle', 'epeautre', 'boulgour', 'couscous',
    'chapelure', 'panure', 'biscuit', 'brioche', 'baguette', 'croissant', 'penne', 'spaghetti', 'tagliatelle', 'fusilli',
    'macaroni', 'coquillette', 'lasagne', 'ravioli', 'gnocchi', 'nouille', 'tortilla', 'wrap', 'pizza', 'tarte', 'quiche',
    'crepe', 'gateau', 'cake', 'muffin', 'biere', 'seitan',
  ],
  lactose: ['lait', 'beurre', 'creme', 'fromage', 'yaourt', 'mozzarella', 'parmesan', 'emmental', 'comte', 'gruyere', 'ricotta', 'mascarpone', 'feta'],
  lait: ['lait', 'beurre', 'creme', 'fromage', 'yaourt', 'mozzarella', 'parmesan', 'emmental', 'comte', 'gruyere', 'ricotta', 'mascarpone', 'feta'],
  oeuf: ['oeuf', 'mayonnaise'],
  arachide: ['arachide', 'cacahuete'],
  'fruits a coque': ['noix', 'noisette', 'amande', 'cajou', 'pistache', 'pecan', 'macadamia'],
  poisson: ['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'sardine', 'maquereau', 'anchois', 'truite', 'merlu'],
  crustace: ['crevette', 'crabe', 'homard', 'langoustine', 'ecrevisse', 'gambas'],
  mollusque: ['moule', 'huitre', 'calamar', 'seiche', 'poulpe', 'coquille'],
  soja: ['soja', 'tofu', 'edamame'],
  sesame: ['sesame', 'tahini', 'tahin'],
  moutarde: ['moutarde'],
  celeri: ['celeri'],
  lupin: ['lupin'],
  sulfite: ['vin', 'sulfite'],
};

const MEAT_FISH_CATEGORIES = new Set<FoodCategory>(['meat', 'fish']);
const MEAT_FISH_WORDS = ['viande', 'poulet', 'boeuf', 'porc', 'jambon', 'lardon', 'bacon', 'saucisse', 'dinde', 'veau', 'agneau', 'canard', 'chorizo', 'merguez', ...ALLERGEN_KEYWORDS.poisson, ...ALLERGEN_KEYWORDS.crustace, ...ALLERGEN_KEYWORDS.mollusque];
const ANIMAL_WORDS = [...MEAT_FISH_WORDS, ...ALLERGEN_KEYWORDS.lait, 'oeuf', 'miel', 'gelatine'];

function containsWord(text: string, words: string[]): boolean {
  const t = new Set(normalizeText(text).split(' ').map(stem));
  return words.some((w) => t.has(stem(w)));
}

function allergenWords(allergy: string): string[] {
  const key = normalizeText(allergy);
  for (const [k, words] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (key.includes(k) || k.includes(key)) return [...words, key];
  }
  return key.split(' ').filter((w) => w.length >= 3);
}

export function violatesPreferences(recipe: GeneratedRecipe, prefs: DietaryProfile, focus: RecipeFocus[]): boolean {
  const texts = [recipe.title, ...recipe.ingredients.map((i) => i.name)];
  for (const allergy of prefs.allergies) {
    const words = allergenWords(allergy);
    if (words.length && texts.some((t) => containsWord(t, words))) return true;
  }
  const diets = prefs.diets.map(normalizeText);
  const vegan = diets.some((d) => d.includes('vegan') || d.includes('vegetalien'));
  const vegetarian = vegan || focus.includes('vegetarian') || diets.some((d) => d.includes('vegetarien'));
  if (vegetarian && recipe.ingredients.some((i) => MEAT_FISH_CATEGORIES.has(i.category) || containsWord(i.name, MEAT_FISH_WORDS))) return true;
  if (vegan && recipe.ingredients.some((i) => i.category === 'dairy' || i.category === 'cheese' || containsWord(i.name, ANIMAL_WORDS))) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Normalisation
// -----------------------------------------------------------------------------
const UNIT_SET = new Set<string>(FOOD_UNITS);
const CATEGORY_SET = new Set<string>(FOOD_CATEGORIES);
const MEAL_SET = new Set<string>(MEAL_TYPES);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
function int(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}
function level(v: unknown): 1 | 2 | 3 {
  return v === 1 || v === 2 || v === 3 ? v : 2;
}

function normalizeIngredient(raw: unknown, inventory: InventoryEntry[]): GeneratedIngredient | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name, 60);
  if (name.length < 2) return null;
  const unit = typeof raw.unit === 'string' && UNIT_SET.has(raw.unit) ? (raw.unit as FoodUnit) : null;
  const quantity = typeof raw.quantity === 'number' && Number.isFinite(raw.quantity) && raw.quantity > 0 && raw.quantity < 100_000
    ? Math.round(raw.quantity * 100) / 100 : null;

  // Lien vers le stock : accepté seulement si la référence existe ET que les noms correspondent.
  let inventoryRef: number | null = null;
  if (typeof raw.inventory_ref === 'number' && Number.isInteger(raw.inventory_ref)) {
    const entry = inventory.find((e) => e.ref === raw.inventory_ref);
    if (entry && namesMatch(name, entry.name)) inventoryRef = entry.ref;
  }

  return {
    name: name.charAt(0).toLocaleUpperCase('fr-FR') + name.slice(1),
    quantity: unit ? quantity : null,
    unit: quantity !== null ? unit : null,
    quantityText: str(raw.quantity_text, 40) || null,
    category: typeof raw.category === 'string' && CATEGORY_SET.has(raw.category) ? (raw.category as FoodCategory) : 'other',
    inventoryRef,
    isStaple: inventoryRef === null && raw.is_staple === true,
    isOptional: raw.is_optional === true,
  };
}

export interface NormalizeRecipesOptions {
  inventory: InventoryEntry[];
  filters: RecipeFilters;
  preferences: DietaryProfile;
  max: number;
}

export function normalizeRecipes(raw: unknown, opts: NormalizeRecipesOptions): { recipes: GeneratedRecipe[]; rejected: number } {
  const list = isRecord(raw) && Array.isArray(raw.recipes) ? raw.recipes : [];
  const recipes: GeneratedRecipe[] = [];
  const seenTitles = new Set<string>();
  let rejected = 0;

  for (const r of list) {
    if (!isRecord(r)) { rejected++; continue; }
    const title = str(r.title, 80);
    const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
      .slice(0, 30)
      .map((i) => normalizeIngredient(i, opts.inventory))
      .filter((i): i is GeneratedIngredient => i !== null);
    const steps = (Array.isArray(r.steps) ? r.steps : []).map((s) => str(s, 600)).filter((s) => s.length > 3).slice(0, 20);

    if (title.length < 3 || ingredients.length === 0 || steps.length === 0 || seenTitles.has(normalizeText(title))) {
      rejected++;
      continue;
    }

    const recipe: GeneratedRecipe = {
      title,
      summary: str(r.summary, 280),
      prepMinutes: int(r.prep_minutes, 0, 600, 15),
      cookMinutes: int(r.cook_minutes, 0, 900, 0),
      servings: opts.filters.servings,
      difficulty: level(r.difficulty),
      budget: level(r.budget),
      mealType: typeof r.meal_type === 'string' && MEAL_SET.has(r.meal_type) ? (r.meal_type as MealType) : opts.filters.mealType ?? 'dinner',
      tags: (Array.isArray(r.tags) ? r.tags : []).map((t) => str(t, 30).toLowerCase()).filter(Boolean).slice(0, 6),
      steps,
      ingredients,
      usesExpiring: ingredients.some((i) => {
        const e = i.inventoryRef === null ? undefined : opts.inventory.find((x) => x.ref === i.inventoryRef);
        return e?.daysToExpiry !== null && e?.daysToExpiry !== undefined && e.daysToExpiry <= 3;
      }),
    };

    const tooLong = opts.filters.maxTotalMinutes !== null && recipe.prepMinutes + recipe.cookMinutes > opts.filters.maxTotalMinutes + 5;
    if (tooLong || violatesPreferences(recipe, opts.preferences, opts.filters.focus)) {
      rejected++;
      continue;
    }

    seenTitles.add(normalizeText(title));
    recipes.push(recipe);
    if (recipes.length >= opts.max) break;
  }
  return { recipes, rejected };
}
