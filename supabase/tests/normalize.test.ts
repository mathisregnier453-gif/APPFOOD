import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanExpiryDate, normalizeDetections } from '../functions/_shared/ai/normalize.ts';
import { estimateCostUsd } from '../functions/_shared/ai/pricing.ts';

const opts = { today: '2026-11-18', photoCount: 2 };

const base = {
  name: 'lait demi-écrémé', category: 'dairy', quantity: 1, unit: 'l', quantity_from_label: true,
  expiry_date: '2026-11-25', expiry_kind: 'dlc', expiry_visible: true, confidence: 0.93, photo_index: 0,
};

test('conserve un aliment valide et capitalise le nom', () => {
  const [item] = normalizeDetections({ items: [base] }, opts);
  assert.equal(item.name, 'Lait demi-écrémé');
  assert.equal(item.expiryDate, '2026-11-25');
  assert.equal(item.expiryKind, 'dlc');
  assert.equal(item.quantityIsEstimate, false);
});

test("n'invente jamais de date : date ignorée si non lue sur l'emballage", () => {
  const [item] = normalizeDetections({ items: [{ ...base, expiry_visible: false }] }, opts);
  assert.equal(item.expiryDate, null);
  assert.equal(item.expiryKind, null);
});

test('rejette les dates invalides ou implausibles', () => {
  assert.equal(cleanExpiryDate('2026-02-30', opts.today), null);
  assert.equal(cleanExpiryDate('12/03/2026', opts.today), null);
  assert.equal(cleanExpiryDate('2019-01-01', opts.today), null);
  assert.equal(cleanExpiryDate('2027-03-12', opts.today), '2027-03-12');
});

test('quantité inconnue => null + estimation', () => {
  const [item] = normalizeDetections({ items: [{ ...base, quantity: null }] }, opts);
  assert.equal(item.quantity, null);
  assert.equal(item.quantityIsEstimate, true);
});

test('quantités négatives ou absurdes ignorées', () => {
  const items = normalizeDetections({ items: [
    { ...base, name: 'Oeufs', unit: 'piece', quantity: -3 },
    { ...base, name: 'Beurre', unit: 'piece', quantity: 9999 },
  ] }, opts);
  assert.ok(items.every((i) => i.quantity === null));
});

test('quantité comptée sur photo = estimation', () => {
  const [item] = normalizeDetections({ items: [{ ...base, unit: 'piece', quantity: 6, quantity_from_label: false }] }, opts);
  assert.equal(item.quantityIsEstimate, true);
});

test('catégorie / unité inconnues ramenées à des valeurs sûres', () => {
  const [item] = normalizeDetections({ items: [{ ...base, category: 'snacks', unit: 'bottle' }] }, opts);
  assert.equal(item.category, 'other');
  assert.equal(item.unit, 'piece');
});

test('fusionne les doublons vus sur plusieurs photos sans additionner', () => {
  const items = normalizeDetections({ items: [
    { ...base, confidence: 0.6, photo_index: 0 },
    { ...base, name: 'Lait Demi-écrémé', confidence: 0.9, photo_index: 1 },
  ] }, opts);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 1);
  assert.equal(items[0].confidence, 0.9);
});

test('photo_index hors limites => null ; confiance bornée', () => {
  const [item] = normalizeDetections({ items: [{ ...base, photo_index: 7, confidence: 3 }] }, opts);
  assert.equal(item.photoIndex, null);
  assert.equal(item.confidence, 1);
});

test('entrée malformée => liste vide', () => {
  assert.deepEqual(normalizeDetections(null, opts), []);
  assert.deepEqual(normalizeDetections({ items: 'x' }, opts), []);
  assert.deepEqual(normalizeDetections({ items: [{ name: '' }, 42] }, opts), []);
});

test('estimation du coût IA', () => {
  // 7 000 tokens en entrée, 1 500 en sortie
  assert.equal(estimateCostUsd('claude-opus-5-5', 7000, 1500), 0.058);
  assert.equal(estimateCostUsd('claude-haiku-5-5', 7000, 1500), 0.00145);
  // modèle inconnu => tarif le plus élevé (prudence)
  assert.ok(estimateCostUsd('modele-inconnu', 7000, 1500) >= 0.058);
});
