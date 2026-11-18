import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignByUrgency, parseMealPlanRequest } from '../functions/_shared/meal-plan.ts';
import { mapCategory, parseOffResponse, parseQuantity } from '../functions/_shared/openfoodfacts.ts';

test('planning : 7 jours à partir de la date, créneaux filtrés', () => {
  const p = parseMealPlanRequest({ start_date: '2026-11-23', slots: ['dinner', 'brunch', 'lunch'], servings: 30, budget: 1 }, '2026-11-18', 2)!;
  assert.equal(p.dates.length, 7);
  assert.equal(p.dates[0], '2026-11-23');
  assert.equal(p.dates[6], '2026-11-29');
  assert.deepEqual(p.slots, ['lunch', 'dinner']);
  assert.equal(p.filters.servings, 12);
  assert.equal(p.filters.budget, 1);
  assert.equal(p.overwrite, false);
  assert.ok(p.filters.focus.includes('anti_waste'));
});

test('planning : dates invalides ou trop lointaines refusées', () => {
  assert.equal(parseMealPlanRequest({ start_date: '2026-10-01' }, '2026-11-18', 2), null);
  assert.equal(parseMealPlanRequest({ start_date: '2027-06-01' }, '2026-11-18', 2), null);
  assert.equal(parseMealPlanRequest({ start_date: 'lundi' }, '2026-11-18', 2), null);
  assert.equal(parseMealPlanRequest({ start_date: '2026-11-20', slots: [] }, '2026-11-18', 2), null);
  assert.equal(parseMealPlanRequest({ start_date: '2026-12-31', days: 3 }, '2026-12-31', 2)!.dates[2], '2027-01-02');
});

test('anti-gaspi : les recettes urgentes en début de semaine', () => {
  const out = assignByUrgency(
    [{ id: 'a', urgency: null }, { id: 'b', urgency: 5 }, { id: 'c', urgency: 1 }, { id: 'd', urgency: 5 }],
    ['L', 'M', 'Me'],
  );
  assert.deepEqual(out.map((o) => `${o.date}:${o.recipe.id}`), ['L:c', 'M:b', 'Me:d']);
});

test('code-barres : quantités', () => {
  assert.deepEqual(parseQuantity('500 g'), { quantity: 500, unit: 'g' });
  assert.deepEqual(parseQuantity('1,5 kg'), { quantity: 1.5, unit: 'kg' });
  assert.deepEqual(parseQuantity('75 cl'), { quantity: 750, unit: 'ml' });
  assert.deepEqual(parseQuantity('1L'), { quantity: 1, unit: 'l' });
  assert.deepEqual(parseQuantity('6 x 125 g'), { quantity: 6, unit: 'piece' });
  assert.equal(parseQuantity('environ un pot'), null);
  assert.equal(parseQuantity(undefined), null);
});

test('code-barres : catégories (règle la plus spécifique)', () => {
  assert.equal(mapCategory(['en:plant-based-foods', 'en:fruits', 'en:fruit-juices', 'en:beverages']), 'drinks');
  assert.equal(mapCategory(['en:dairies', 'en:cheeses']), 'cheese');
  assert.equal(mapCategory(['en:frozen-foods', 'en:pizzas']), 'frozen');
  assert.equal(mapCategory(['en:pastas']), 'starches');
  assert.equal(mapCategory(['en:snacks']), null);
});

test('code-barres : fiche OFF complète, introuvable ou incomplète', () => {
  const info = parseOffResponse({
    status: 1,
    product: {
      product_name: 'Organic yogurt', product_name_fr: 'Yaourt nature bio', brands: 'Ferme du Coin, Autre',
      quantity: '4 x 125 g', categories_tags: ['en:dairies', 'en:yogurts'], image_front_small_url: 'https://images.example/y.jpg',
    },
  });
  assert.equal(info.found, true);
  assert.equal(info.name, 'Yaourt nature bio');
  assert.equal(info.brand, 'Ferme du Coin');
  assert.deepEqual([info.quantity, info.unit, info.category_id], [4, 'piece', 'dairy']);
  assert.equal(parseOffResponse({ status: 0 }).found, false);
  assert.equal(parseOffResponse({ status: 1, product: { brands: 'X' } }).found, false);
  assert.equal(parseOffResponse({ status: 1, product: { product_name: 'X1', image_front_small_url: 'http://insecure' } }).image_url, null);
});
