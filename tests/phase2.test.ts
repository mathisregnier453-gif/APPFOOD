import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeAvailability, rankRecipes } from '../src/features/recipes/availability.ts';
import { MAX_REMINDERS, planExpiryReminders, planSignature } from '../src/features/notifications/expiryPlanner.ts';
import type { RecipeIngredient } from '../src/lib/types.ts';

function ing(p: Partial<RecipeIngredient> & { name: string }): RecipeIngredient {
  return { id: p.name, quantity: null, unit: null, quantity_text: null, category_id: null, food_item_id: null, is_staple: false, is_optional: false, position: 0, ...p };
}

const stock = new Map([['item-1', { quantity: 2, unit: 'piece', name: 'Oeufs' }]]);
const lookup = { get: (id: string) => stock.get(id) };

test('disponibilité recalculée sur le stock actuel', () => {
  const a = computeAvailability([
    ing({ name: 'Oeufs', food_item_id: 'item-1', position: 0 }),
    ing({ name: 'Lait', food_item_id: 'item-terminé', position: 1 }),
    ing({ name: 'Sel', is_staple: true, position: 2 }),
    ing({ name: 'Ciboulette', is_optional: true, position: 3 }),
  ], lookup);
  assert.deepEqual(a.available.map((i) => i.name), ['Oeufs']);
  assert.deepEqual(a.missing.map((i) => i.name), ['Lait'], 'aliment terminé depuis la génération => manquant');
  assert.deepEqual(a.staples.map((i) => i.name), ['Sel']);
  assert.deepEqual(a.optional.map((i) => i.name), ['Ciboulette']);
  assert.equal(a.canCook, false);
  assert.equal(a.coverage, 0.5);
});

test('réalisable si seuls basiques et options manquent', () => {
  const a = computeAvailability([ing({ name: 'Oeufs', food_item_id: 'item-1' }), ing({ name: 'Sel', is_staple: true })], lookup);
  assert.equal(a.canCook, true);
});

test('classement : réalisables puis anti-gaspi', () => {
  const recipes = [
    { id: 'a', tags: ['anti-gaspi'], created_at: '2026-11-18', ok: false },
    { id: 'b', tags: [], created_at: '2026-11-17', ok: true },
    { id: 'c', tags: [], created_at: '2026-11-19', ok: false },
  ];
  const ranked = rankRecipes(recipes, (r) => ({ available: [], missing: [], staples: [], optional: [], canCook: r.ok, coverage: r.ok ? 1 : 0.5 }));
  assert.deepEqual(ranked.map((r) => r.id), ['b', 'a', 'c']);
});

test('rappels groupés par jour, à 9 h, alertDays avant la date', () => {
  const now = new Date(2026, 10, 18, 12, 0); // 18 nov. 2026 12:00 local
  const plan = planExpiryReminders([
    { id: '1', name: 'Yaourts', expiry_date: '2026-11-22' },
    { id: '2', name: 'Poulet', expiry_date: '2026-11-22' },
    { id: '3', name: 'Lait', expiry_date: '2026-11-25' },
    { id: '4', name: 'Pain', expiry_date: '2026-11-19' }, // rappel le 17 => passé
    { id: '5', name: 'Riz', expiry_date: null },
  ], 2, now);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].id, 'expiry-2026-11-20');
  assert.equal(plan[0].fireAt.getHours(), 9);
  assert.equal(plan[0].fireAt.getDate(), 20);
  assert.equal(plan[0].title, '2 produits à consommer bientôt');
  assert.match(plan[0].body, /Poulet \(dans 2 jours\), Yaourts \(dans 2 jours\)/);
  assert.ok(!/dangereu/i.test(plan.map((p) => p.body).join(' ')));
});

test('plafond de rappels et horizon', () => {
  const now = new Date(2026, 0, 1, 8, 0);
  const items = Array.from({ length: 80 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 3 + i));
    return { id: String(i), name: `P${i}`, expiry_date: d.toISOString().slice(0, 10) };
  });
  const plan = planExpiryReminders(items, 0, now);
  assert.ok(plan.length <= MAX_REMINDERS);
  assert.equal(planSignature(plan), planSignature(planExpiryReminders(items, 0, now)), 'plan déterministe');
});

test('au-delà de 3 produits : résumé', () => {
  const now = new Date(2026, 10, 18, 8, 0);
  const items = ['A', 'B', 'C', 'D', 'E'].map((n) => ({ id: n, name: n, expiry_date: '2026-11-20' }));
  const [r] = planExpiryReminders(items, 1, now);
  assert.match(r.body, /et 2 autres/);
});
