import assert from 'node:assert/strict';
import { test } from 'node:test';
import { featureLines, matchOffers, type PlanRow } from '../src/features/billing/offers.ts';

const plans: PlanRow[] = [
  { code: 'free', label: 'Gratuit', monthly_scan_quota: 3, monthly_recipe_quota: 10, max_members: 1, store_product_monthly: null, store_product_yearly: null, features: {} },
  { code: 'premium', label: 'Premium', monthly_scan_quota: 30, monthly_recipe_quota: null, max_members: 1, store_product_monthly: 'sauge_premium_monthly', store_product_yearly: 'sauge_premium_yearly', features: { meal_plan: true, favorites: true, smart_notifications: true, consumption_history: true } },
  { code: 'family', label: 'Famille', monthly_scan_quota: 60, monthly_recipe_quota: null, max_members: 6, store_product_monthly: 'sauge_family_monthly', store_product_yearly: 'sauge_family_yearly', features: { meal_plan: true, shared_household: true } },
];

const pkg = (id: string, price: number) => ({ identifier: id, product: { identifier: id, price, priceString: `${price.toFixed(2).replace('.', ',')} €`, currencyCode: 'EUR' } });

test('offres associées aux produits des stores (prix issus du store)', () => {
  const offers = matchOffers([
    pkg('sauge_premium_monthly', 4.99), pkg('sauge_premium_yearly:annual', 47.9),
    pkg('sauge_family_monthly', 6.99), pkg('inconnu', 1),
  ], plans);
  assert.deepEqual(offers.map((o) => `${o.plan}/${o.period}/${o.priceString}`), [
    'premium/monthly/4,99 €', 'premium/yearly/47,90 €', 'family/monthly/6,99 €',
  ]);
  const yearly = offers.find((o) => o.period === 'yearly')!;
  assert.equal(yearly.savingsPercent, 20);
  assert.match(yearly.perMonth!, /3,99/);
});

test('produit absent du store : offre non affichée', () => {
  assert.equal(matchOffers([], plans).length, 0);
});

test('comparatif généré depuis la table des offres', () => {
  const premium = featureLines(plans[1]);
  assert.ok(!premium.some((l) => l.includes('scans')), 'scanner gratuit : aucun quota de scans affiché');
  assert.equal(featureLines(plans[1], { aiPhotoScan: true })[0], '30 scans IA par mois');
  assert.ok(premium.includes('Recettes IA illimitées (usage raisonnable)'));
  assert.ok(featureLines(plans[2]).some((l) => l.includes('6 personnes')));
  assert.equal(featureLines(plans[0])[0], '10 recettes IA par mois');
});
