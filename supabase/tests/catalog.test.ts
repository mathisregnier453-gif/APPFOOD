import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CatalogRecipeProvider, suggestFromCatalog } from '../functions/_shared/catalog/engine.ts';
import { ALL_RECIPES as RECIPES_FR } from '../functions/_shared/catalog/engine.ts';
import type { InventoryEntry, RecipeFilters } from '../functions/_shared/ai/types.ts';

const inventory: InventoryEntry[] = [
  { ref: 1, name: 'Oeufs', category: 'fresh', quantity: 6, unit: 'piece', daysToExpiry: 2 },
  { ref: 2, name: 'Penne rigate', category: 'starches', quantity: 500, unit: 'g', daysToExpiry: 300 },
  { ref: 3, name: 'Lardons fumés', category: 'meat', quantity: 200, unit: 'g', daysToExpiry: 1 },
  { ref: 4, name: 'Emmental râpé', category: 'cheese', quantity: 200, unit: 'g', daysToExpiry: 10 },
  { ref: 5, name: 'Lait demi-écrémé', category: 'dairy', quantity: 1, unit: 'l', daysToExpiry: 5 },
  { ref: 6, name: 'Pommes golden', category: 'fruits', quantity: 4, unit: 'piece', daysToExpiry: null },
];
const base: RecipeFilters = { focus: ['stock'], maxTotalMinutes: null, servings: 2, budget: null, difficulty: null, mealType: null };
const noPrefs = { diets: [], allergies: [], dislikes: [] };
const fixed = () => 0.5;

test('la base de recettes est complète et cohérente', () => {
  assert.ok(RECIPES_FR.length >= 95);
  const ids = new Set(RECIPES_FR.map((r) => r.id));
  assert.equal(ids.size, RECIPES_FR.length, 'identifiants uniques');
  for (const r of RECIPES_FR) {
    assert.ok(r.steps.length >= 2 && r.ingredients.length >= 2, r.id);
    assert.ok(r.meals.length >= 1, r.id);
  }
});

test('priorité au stock et aux produits qui périment', () => {
  const { recipes } = suggestFromCatalog({ inventory, filters: { ...base, focus: ['anti_waste'], mealType: 'dinner' }, preferences: noPrefs, count: 3, today: '2026-11-18', random: fixed });
  assert.equal(recipes[0].title, 'Pâtes à la carbonara', 'oeufs + lardons qui périment, tout est en stock');
  assert.ok(recipes[0].usesExpiring);
  const ing = Object.fromEntries(recipes[0].ingredients.map((i) => [i.name, i.inventoryRef]));
  assert.deepEqual([ing['Pâtes'], ing['Lardons'], ing['Oeufs'], ing['Parmesan']], [2, 3, 1, 4], 'liens vers les vrais aliments du stock');
});

test('jamais un ingrédient déclaré disponible sans correspondance réelle', () => {
  const { recipes } = suggestFromCatalog({ inventory, filters: base, preferences: noPrefs, count: 5, today: '2026-11-18', random: fixed });
  for (const r of recipes) {
    for (const i of r.ingredients) {
      if (i.inventoryRef === null) continue;
      const stock = inventory.find((e) => e.ref === i.inventoryRef)!;
      assert.ok(stock, `${r.title} / ${i.name}`);
    }
  }
});

test('quantités adaptées au nombre de personnes', () => {
  const { recipes } = suggestFromCatalog({ inventory, filters: { ...base, servings: 4, mealType: 'dinner' }, preferences: noPrefs, count: 1, today: '2026-11-18', random: fixed });
  const pates = recipes[0].ingredients.find((i) => i.name === 'Pâtes')!;
  assert.deepEqual([pates.quantity, pates.unit], [400, 'g']);
  assert.equal(recipes[0].servings, 4);
});

test('filtres stricts : temps, type de repas, difficulté', () => {
  const { recipes } = suggestFromCatalog({ inventory, filters: { ...base, maxTotalMinutes: 15, mealType: 'breakfast' }, preferences: noPrefs, count: 5, today: '2026-11-18', random: fixed });
  assert.ok(recipes.length > 0);
  assert.ok(recipes.every((r) => r.prepMinutes + r.cookMinutes <= 15));
  const hard = suggestFromCatalog({ inventory, filters: { ...base, difficulty: 1 }, preferences: noPrefs, count: 10, today: '2026-11-18', random: fixed });
  assert.ok(hard.recipes.every((r) => r.difficulty === 1));
});

test('allergies, régime végétarien et aliments non aimés respectés', () => {
  const gluten = suggestFromCatalog({ inventory, filters: base, preferences: { ...noPrefs, allergies: ['Gluten'] }, count: 10, today: '2026-11-18', random: fixed });
  assert.ok(!gluten.recipes.some((r) => /pâtes|pain|farine/i.test(r.ingredients.map((i) => i.name).join(' '))));
  const veg = suggestFromCatalog({ inventory, filters: { ...base, focus: ['vegetarian'] }, preferences: noPrefs, count: 10, today: '2026-11-18', random: fixed });
  assert.ok(veg.recipes.length > 0 && !veg.recipes.some((r) => r.ingredients.some((i) => i.category === 'meat' || i.category === 'fish')));
  const noEgg = suggestFromCatalog({ inventory, filters: base, preferences: { ...noPrefs, dislikes: ['oeufs'] }, count: 10, today: '2026-11-18', random: fixed });
  assert.ok(!noEgg.recipes.some((r) => r.ingredients.some((i) => i.name === 'Oeufs')));
});

test('variété : idées récentes reléguées, pas deux fois le même ingrédient principal', () => {
  const first = suggestFromCatalog({ inventory, filters: { ...base, mealType: 'dinner' }, preferences: noPrefs, count: 3, today: '2026-11-18', random: fixed });
  const next = suggestFromCatalog({ inventory, filters: { ...base, mealType: 'dinner' }, preferences: noPrefs, count: 3, today: '2026-11-18', random: fixed, excludeTitles: first.recipes.map((r) => r.title) });
  assert.ok(!next.recipes.some((r) => first.recipes.map((x) => x.title).includes(r.title)), 'autres idées proposées');
  const mains = first.recipes.map((r) => r.ingredients.find((i) => !i.isStaple && !i.isOptional)!.name);
  assert.equal(new Set(mains).size, mains.length);
});

test('stock vide : aucune idée inventée ; fournisseur à coût nul', async () => {
  assert.equal(suggestFromCatalog({ inventory: [], filters: base, preferences: noPrefs, count: 3, today: '2026-11-18' }).recipes.length, 0);
  const res = await new CatalogRecipeProvider().generateRecipes({ inventory, filters: base, preferences: noPrefs, count: 3, today: '2026-11-18' });
  assert.equal(res.usage.costUsd, 0);
  assert.equal(res.usage.provider, 'catalog');
  assert.equal(res.recipes.length, 3);
});

test('les recettes végétariennes ne contiennent ni viande ni poisson', () => {
  for (const r of RECIPES_FR.filter((x) => x.tags.includes('végétarien'))) {
    for (const i of r.ingredients) assert.ok(i.category !== 'meat' && i.category !== 'fish', `${r.id} : ${i.name}`);
  }
});
