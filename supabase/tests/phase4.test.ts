import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affectedUserIds, baseProductId, deriveSubscription, type PlanMapping, safeEqual } from '../functions/_shared/revenuecat.ts';

const plans: PlanMapping[] = [
  { code: 'free', entitlement: null, monthly: null, yearly: null, position: 0 },
  { code: 'premium', entitlement: 'premium', monthly: 'sauge_premium_monthly', yearly: 'sauge_premium_yearly', position: 1 },
  { code: 'family', entitlement: 'family', monthly: 'sauge_family_monthly', yearly: 'sauge_family_yearly', position: 2 },
];
const NOW = Date.parse('2026-11-21T12:00:00Z');
const future = '2026-12-21T12:00:00Z';
const past = '2026-11-01T12:00:00Z';

function subscriber(entitlements: Record<string, unknown>, subscriptions: Record<string, unknown>) {
  return { subscriber: { entitlements, subscriptions } };
}

test('Premium mensuel actif', () => {
  const d = deriveSubscription(subscriber(
    { premium: { expires_date: future, product_identifier: 'sauge_premium_monthly' } },
    { sauge_premium_monthly: { expires_date: future, store: 'app_store', is_sandbox: false, unsubscribe_detected_at: null, price: { amount: 4.99, currency: 'EUR' } } },
  ), plans, NOW)!;
  assert.deepEqual([d.plan, d.period, d.status, d.will_renew, d.price_paid_cents, d.currency], ['premium', 'monthly', 'active', true, 499, 'EUR']);
});

test('Google Play : identifiant produit avec base plan, offre annuelle', () => {
  assert.equal(baseProductId('sauge_family_yearly:annual'), 'sauge_family_yearly');
  const d = deriveSubscription(subscriber(
    { family: { expires_date: future, product_identifier: 'sauge_family_yearly:annual' } },
    { 'sauge_family_yearly:annual': { expires_date: future, store: 'play_store' } },
  ), plans, NOW)!;
  assert.deepEqual([d.plan, d.period, d.store], ['family', 'yearly', 'play_store']);
});

test('changement d\'offre : le droit le plus élevé l\'emporte', () => {
  const d = deriveSubscription(subscriber(
    { premium: { expires_date: future, product_identifier: 'sauge_premium_monthly' }, family: { expires_date: future, product_identifier: 'sauge_family_monthly' } },
    { sauge_premium_monthly: { expires_date: future, unsubscribe_detected_at: past }, sauge_family_monthly: { expires_date: future } },
  ), plans, NOW)!;
  assert.equal(d.plan, 'family');
});

test('résilié : droits conservés jusqu\'à l\'échéance, pas de renouvellement', () => {
  const d = deriveSubscription(subscriber(
    { premium: { expires_date: future, product_identifier: 'sauge_premium_monthly' } },
    { sauge_premium_monthly: { expires_date: future, unsubscribe_detected_at: past } },
  ), plans, NOW)!;
  assert.deepEqual([d.status, d.will_renew, d.current_period_end], ['cancelled', false, new Date(future).toISOString()]);
});

test('période de grâce (problème de paiement)', () => {
  const grace = '2026-11-25T12:00:00Z';
  const d = deriveSubscription(subscriber(
    { premium: { expires_date: past, grace_period_expires_date: grace, product_identifier: 'sauge_premium_monthly' } },
    { sauge_premium_monthly: { expires_date: past, grace_period_expires_date: grace, billing_issues_detected_at: past } },
  ), plans, NOW)!;
  assert.equal(d.status, 'in_grace_period');
  assert.equal(d.current_period_end, new Date(grace).toISOString());
});

test('expiré, remboursé, jamais abonné', () => {
  const expired = deriveSubscription(subscriber(
    { premium: { expires_date: past, product_identifier: 'sauge_premium_monthly' } }, { sauge_premium_monthly: { expires_date: past } },
  ), plans, NOW)!;
  assert.equal(expired.status, 'expired');
  const refunded = deriveSubscription(subscriber(
    { premium: { expires_date: future, product_identifier: 'sauge_premium_monthly' } }, { sauge_premium_monthly: { expires_date: future, refunded_at: past } },
  ), plans, NOW)!;
  assert.equal(refunded.status, 'expired');
  assert.equal(deriveSubscription(subscriber({}, {}), plans, NOW), null);
  assert.equal(deriveSubscription({ nope: 1 }, plans, NOW), null);
});

test('droit inconnu ignoré', () => {
  assert.equal(deriveSubscription(subscriber({ pro_max: { expires_date: future, product_identifier: 'x' } }, {}), plans, NOW), null);
});

test('webhook : utilisateurs concernés (transferts, alias anonymes ignorés)', () => {
  const a = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const b = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  assert.deepEqual(affectedUserIds({ app_user_id: a, original_app_user_id: '$RCAnonymousID:abc', aliases: [a, '$RCAnonymousID:abc'] }), [a]);
  assert.deepEqual(affectedUserIds({ type: 'TRANSFER', transferred_from: [a], transferred_to: [b.toUpperCase()] }), [a, b]);
});

test('comparaison du secret en temps constant', () => {
  assert.ok(safeEqual('Bearer abc', 'Bearer abc'));
  assert.ok(!safeEqual('Bearer abd', 'Bearer abc'));
  assert.ok(!safeEqual('', 'Bearer abc'));
});
