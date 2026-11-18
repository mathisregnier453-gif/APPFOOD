import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDaysIso, mondayOf, weekDays, weekLabel } from '../src/lib/dates.ts';
import { buildShoppingNeeds, convert, defaultStorageFor, guessCategory, suggestDeductions } from '../src/features/planning/shopping.ts';
import { planMealReminders } from '../src/features/notifications/mealPlanner.ts';
import type { RecipeIngredient } from '../src/lib/types.ts';

function ing(p: Partial<RecipeIngredient> & { name: string }): RecipeIngredient {
  return { id: p.name, quantity: null, unit: null, quantity_text: null, category_id: 'other', food_item_id: null, is_staple: false, is_optional: false, position: 0, ...p };
}

test('semaines : lundi, 7 jours, passage d\'année', () => {
  assert.equal(mondayOf('2026-11-18'), '2026-11-16'); // mercredi -> lundi
  assert.equal(mondayOf('2026-11-22'), '2026-11-16'); // dimanche -> lundi précédent
  assert.equal(weekDays('2026-12-28')[6], '2027-01-03');
  assert.equal(addDaysIso('2027-03-27', 2), '2027-03-29'); // changement d'heure
  assert.equal(weekLabel('2026-11-30'), '30 nov. – 6 déc.');
});

test('conversions d\'unités', () => {
  assert.equal(convert(1.5, 'kg', 'g'), 1500);
  assert.equal(convert(250, 'ml', 'l'), 0.25);
  assert.equal(convert(2, 'piece', 'g'), null);
});

test('courses : seulement le manquant, à l\'échelle des personnes', () => {
  const stock = new Map([['pates', { quantity: 300, unit: 'g' as const }], ['oeufs', { quantity: null, unit: 'piece' as const }]]);
  const needs = buildShoppingNeeds([
    { recipeId: 'r1', recipeServings: 2, servings: 4, ingredients: [
      ing({ name: 'Pâtes', quantity: 200, unit: 'g', food_item_id: 'pates', category_id: 'starches' }), // besoin 400 g, stock 300 => 100 g
      ing({ name: 'Oeufs', quantity: 2, unit: 'piece', food_item_id: 'oeufs' }), // quantité de stock inconnue => disponible
      ing({ name: 'Parmesan', quantity: 50, unit: 'g', category_id: 'cheese' }), // manquant => 100 g
      ing({ name: 'Sel', is_staple: true }), ing({ name: 'Basilic', is_optional: true }),
    ] },
  ], stock);
  assert.deepEqual(needs.map((n) => [n.name, n.quantity, n.unit]), [['Pâtes', 100, 'g'], ['Parmesan', 100, 'g']]);
});

test('courses : stock partagé entre deux repas et agrégation des unités', () => {
  const stock = new Map([['lait', { quantity: 1, unit: 'l' as const }]]);
  const meal = (id: string) => ({ recipeId: id, recipeServings: 2, servings: 2, ingredients: [
    ing({ name: 'Lait', quantity: 600, unit: 'ml', food_item_id: 'lait' }),
    ing({ name: 'Farine', quantity: 0.75, unit: 'kg' }),
  ] });
  const needs = buildShoppingNeeds([meal('a'), meal('b')], stock);
  const lait = needs.find((n) => n.name === 'Lait')!;
  const farine = needs.find((n) => n.name === 'Farine')!;
  assert.deepEqual([lait.quantity, lait.unit], [200, 'ml'], '1 L pour 1,2 L demandés');
  assert.deepEqual([farine.quantity, farine.unit], [1.5, 'kg'], '750 g + 750 g');
  assert.equal(farine.recipe_id, null, 'plusieurs recettes => pas de recette unique');
});

test('déductions proposées après cuisson', () => {
  const stock = new Map([
    ['pates', { id: 'pates', name: 'Pâtes', quantity: 0.5, unit: 'kg' as const }],
    ['oeufs', { id: 'oeufs', name: 'Oeufs', quantity: 6, unit: 'piece' as const }],
    ['creme', { id: 'creme', name: 'Crème', quantity: null, unit: 'ml' as const }],
  ]);
  const s = suggestDeductions([
    ing({ name: 'Pâtes', quantity: 250, unit: 'g', food_item_id: 'pates' }),
    ing({ name: 'Oeufs', quantity: 3, unit: 'piece', food_item_id: 'oeufs' }),
    ing({ name: 'Jaunes', quantity: 3, unit: 'piece', food_item_id: 'oeufs' }), // même aliment deux fois
    ing({ name: 'Crème', quantity: 20, unit: 'ml', food_item_id: 'creme' }),
    ing({ name: 'Absent', quantity: 1, unit: 'piece', food_item_id: 'termine' }),
  ], 2, 2, stock);
  const by = Object.fromEntries(s.map((d) => [d.food_item_id, d]));
  assert.equal(by.pates.suggested, 0.25);
  assert.equal(by.oeufs.suggested, 0);
  assert.equal(by.oeufs.finish, true);
  assert.equal(by.creme.suggested, null, 'quantité inconnue : à préciser');
  assert.equal(s.length, 3);
});

test('catégorie devinée et rangement par défaut', () => {
  assert.equal(guessCategory('Tomates cerises'), 'vegetables');
  assert.equal(guessCategory('Lait demi-écrémé'), 'dairy');
  assert.equal(guessCategory('Éponges'), 'other');
  assert.equal(defaultStorageFor('frozen'), 'freezer');
  assert.equal(defaultStorageFor('starches'), 'pantry');
  assert.equal(defaultStorageFor('meat'), 'fridge');
});

test('rappels de repas et ingrédients manquants', () => {
  const now = new Date(2026, 10, 18, 10, 0);
  const r = planMealReminders([
    { date: '2026-11-18', slot: 'lunch', title: 'Quiche', isCooked: false, missing: [] },
    { date: '2026-11-18', slot: 'breakfast', title: 'Porridge', isCooked: false, missing: [] }, // passé
    { date: '2026-11-19', slot: 'dinner', title: 'Curry', isCooked: false, missing: ['Lait de coco', 'Riz'] },
    { date: '2026-11-19', slot: 'lunch', title: 'Déjà fait', isCooked: true, missing: ['X'] },
  ], { now, mealReminder: true, missingIngredient: true });
  assert.deepEqual(r.map((x) => x.id), ['meal-2026-11-18-lunch', 'missing-2026-11-19-dinner', 'meal-2026-11-19-dinner']);
  assert.match(r[1].body, /Curry \(dîner\) : Lait de coco, Riz/);
  assert.equal(r[1].fireAt.getHours(), 17);
  assert.equal(planMealReminders([{ date: '2026-11-19', slot: 'dinner', title: 'C', isCooked: false, missing: ['a'] }], { now, mealReminder: false, missingIngredient: false }).length, 0);
});
