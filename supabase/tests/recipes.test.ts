import assert from 'node:assert/strict';
import { test } from 'node:test';
import { namesMatch, normalizeRecipes, recipeUserPrompt, violatesPreferences } from '../functions/_shared/ai/recipes.ts';
import type { GeneratedRecipe, InventoryEntry, RecipeFilters } from '../functions/_shared/ai/types.ts';
import { cleanPreferenceList, parseRecipeRequest } from '../functions/_shared/recipe-request.ts';

const inventory: InventoryEntry[] = [
  { ref: 1, name: 'Tomates cerises', category: 'vegetables', quantity: 250, unit: 'g', daysToExpiry: 1 },
  { ref: 2, name: 'Blanc de poulet', category: 'meat', quantity: 2, unit: 'piece', daysToExpiry: 4 },
  { ref: 3, name: 'Lait demi-écrémé', category: 'dairy', quantity: 1, unit: 'l', daysToExpiry: null },
  { ref: 4, name: 'Pâtes penne', category: 'starches', quantity: 500, unit: 'g', daysToExpiry: 200 },
];
const filters: RecipeFilters = { focus: ['stock'], maxTotalMinutes: null, servings: 2, budget: null, difficulty: null, mealType: null };
const noPrefs = { diets: [], allergies: [], dislikes: [] };

function rawRecipe(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Penne poulet tomates', summary: 'Simple et rapide.', prep_minutes: 10, cook_minutes: 15, servings: 2,
    difficulty: 1, budget: 1, meal_type: 'dinner', tags: ['Rapide'],
    steps: ['Cuire les pâtes.', 'Saisir le poulet.', 'Ajouter les tomates.'],
    ingredients: [
      { name: 'penne', quantity: 200, unit: 'g', quantity_text: null, category: 'starches', inventory_ref: 4, is_staple: false, is_optional: false },
      { name: 'blanc de poulet', quantity: 2, unit: 'piece', quantity_text: null, category: 'meat', inventory_ref: 2, is_staple: false, is_optional: false },
      { name: 'tomates cerises', quantity: 150, unit: 'g', quantity_text: null, category: 'vegetables', inventory_ref: 1, is_staple: false, is_optional: false },
      { name: "huile d'olive", quantity: null, unit: null, quantity_text: '1 c. à soupe', category: 'other', inventory_ref: null, is_staple: true, is_optional: false },
      { name: 'basilic', quantity: null, unit: null, quantity_text: 'quelques feuilles', category: 'vegetables', inventory_ref: null, is_staple: false, is_optional: true },
    ],
    ...overrides,
  };
}

test('correspondance des noms tolérante (pluriels, accents, mots vides)', () => {
  assert.ok(namesMatch('tomate', 'Tomates cerises'));
  assert.ok(namesMatch('poulet', 'Blanc de poulet'));
  assert.ok(namesMatch('lait', 'Lait demi-écrémé'));
  assert.ok(!namesMatch('crème fraîche', 'Lait demi-écrémé'));
});

test('ingrédients liés au stock conservés, anti-gaspi détecté', () => {
  const { recipes } = normalizeRecipes({ recipes: [rawRecipe()] }, { inventory, filters, preferences: noPrefs, max: 3 });
  assert.equal(recipes.length, 1);
  const r = recipes[0];
  assert.deepEqual(r.ingredients.slice(0, 3).map((i) => i.inventoryRef), [4, 2, 1]);
  assert.equal(r.ingredients[3].isStaple, true);
  assert.equal(r.ingredients[3].quantityText, '1 c. à soupe');
  assert.equal(r.usesExpiring, true);
});

test("l'IA ne peut pas déclarer disponible un ingrédient absent du stock", () => {
  const raw = rawRecipe({
    ingredients: [
      { name: 'crème fraîche', quantity: 20, unit: 'ml', quantity_text: null, category: 'dairy', inventory_ref: 3, is_staple: false, is_optional: false },
      { name: 'parmesan', quantity: 30, unit: 'g', quantity_text: null, category: 'cheese', inventory_ref: 99, is_staple: true, is_optional: false },
    ],
  });
  const [r] = normalizeRecipes({ recipes: [raw] }, { inventory, filters, preferences: noPrefs, max: 3 }).recipes;
  assert.equal(r.ingredients[0].inventoryRef, null, 'ref vers le lait mais nom = crème => manquant');
  assert.equal(r.ingredients[1].inventoryRef, null, 'ref inexistante => manquant');
});

test('allergies : recette écartée', () => {
  const out = normalizeRecipes({ recipes: [rawRecipe()] }, { inventory, filters, preferences: { ...noPrefs, allergies: ['gluten'] }, max: 3 });
  assert.equal(out.recipes.length, 0);
  assert.equal(out.rejected, 1);
});

test('régime végétarien : viande refusée', () => {
  const [r] = normalizeRecipes({ recipes: [rawRecipe()] }, { inventory, filters, preferences: noPrefs, max: 3 }).recipes;
  assert.ok(violatesPreferences(r as GeneratedRecipe, { ...noPrefs, diets: ['végétarien'] }, []));
  assert.ok(violatesPreferences(r as GeneratedRecipe, noPrefs, ['vegetarian']));
  assert.ok(!violatesPreferences(r as GeneratedRecipe, noPrefs, ['quick']));
});

test('durée max respectée, doublons et recettes vides écartés', () => {
  const out = normalizeRecipes({
    recipes: [rawRecipe({ cook_minutes: 60 }), rawRecipe(), rawRecipe(), rawRecipe({ title: 'Vide', steps: [] }), 'x'],
  }, { inventory, filters: { ...filters, maxTotalMinutes: 30 }, preferences: noPrefs, max: 3 });
  assert.equal(out.recipes.length, 1);
  assert.equal(out.rejected, 4);
});

test('prompt : stock référencé, allergies mises en avant', () => {
  const p = recipeUserPrompt({ inventory, filters: { ...filters, focus: ['anti_waste'] }, preferences: { ...noPrefs, allergies: ['arachide'] }, count: 3 });
  assert.match(p, /#1 \| Tomates cerises \| 250 g \| expire dans 1 j/);
  assert.match(p, /#3 \| Lait demi-écrémé \| 1 l \| date inconnue/);
  assert.match(p, /ALLERGIES.*arachide/);
});

test('validation de la requête', () => {
  const r = parseRecipeRequest({ filters: { focus: ['quick', 'hack', 'quick'], servings: 50, budget: 7 }, count: 99 }, 2)!;
  assert.deepEqual(r.filters.focus, ['quick']);
  assert.equal(r.filters.maxTotalMinutes, 30);
  assert.equal(r.filters.servings, 12);
  assert.equal(r.filters.budget, null);
  assert.equal(r.count, 4);
  assert.deepEqual(parseRecipeRequest({}, 3)!.filters.focus, ['stock']);
  assert.equal(parseRecipeRequest(null, 2), null);
});

test('préférences nettoyées avant injection dans le prompt', () => {
  assert.deepEqual(cleanPreferenceList(['  Gluten ', 'gluten', 'x', 'noix\n#| ignore', 42], 10), ['Gluten', 'gluten', 'noix ignore']);
});
