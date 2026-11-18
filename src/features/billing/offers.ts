// Offres affichées dans le paywall (module pur, testé).
// Les PRIX viennent toujours des stores (via RevenueCat) : jamais codés en dur.

export type PaidPlan = 'premium' | 'family';
export type Period = 'monthly' | 'yearly';

export interface PlanRow {
  code: 'free' | PaidPlan;
  label: string;
  monthly_scan_quota: number;
  monthly_recipe_quota: number | null;
  max_members: number;
  store_product_monthly: string | null;
  store_product_yearly: string | null;
  features: Record<string, boolean>;
}

export interface StorePackageLike {
  identifier: string;
  product: { identifier: string; priceString: string; price: number; currencyCode: string };
}

export interface Offer<P extends StorePackageLike = StorePackageLike> {
  plan: PaidPlan;
  period: Period;
  pkg: P;
  priceString: string;
  price: number;
  /** économie de l'annuel par rapport à 12 mensualités, en % (null si non calculable) */
  savingsPercent: number | null;
  /** prix mensuel équivalent pour l'annuel, formaté */
  perMonth: string | null;
}

const baseId = (id: string) => id.split(':')[0];

export function matchOffers<P extends StorePackageLike>(packages: P[], plans: PlanRow[]): Offer<P>[] {
  const offers: Offer<P>[] = [];
  for (const plan of plans) {
    if (plan.code === 'free') continue;
    for (const period of ['monthly', 'yearly'] as Period[]) {
      const productId = period === 'monthly' ? plan.store_product_monthly : plan.store_product_yearly;
      const pkg = productId ? packages.find((p) => baseId(p.product.identifier) === productId) : undefined;
      if (!pkg) continue;
      offers.push({ plan: plan.code, period, pkg, priceString: pkg.product.priceString, price: pkg.product.price, savingsPercent: null, perMonth: null });
    }
  }
  for (const yearly of offers.filter((o) => o.period === 'yearly')) {
    const monthly = offers.find((o) => o.plan === yearly.plan && o.period === 'monthly');
    if (monthly && monthly.price > 0) {
      const pct = Math.round((1 - yearly.price / (monthly.price * 12)) * 100);
      yearly.savingsPercent = pct > 0 ? pct : null;
    }
    yearly.perMonth = formatPrice(yearly.price / 12, yearly.pkg.product.currencyCode);
  }
  return offers;
}

export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Math.floor(amount * 100) / 100);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export type PaywallReason = 'scan_quota' | 'recipe_quota' | 'favorites' | 'meal_plan' | 'history' | 'notifications' | 'household' | 'profile';

export const REASON_COPY: Record<PaywallReason, { title: string; subtitle: string }> = {
  scan_quota: { title: 'Passez à la vitesse supérieure', subtitle: 'Recettes sans compter, planning de la semaine, foyer partagé.' },
  recipe_quota: { title: 'Plus d\'idées de recettes', subtitle: 'Vos 10 idées de recettes du mois sont utilisées. Avec Premium, elles sont illimitées.' },
  favorites: { title: 'Gardez vos recettes préférées', subtitle: 'Les favoris font partie de Premium.' },
  meal_plan: { title: 'Organisez votre semaine', subtitle: 'Planning des repas, génération automatique et liste de courses de la semaine avec Premium.' },
  history: { title: 'Suivez votre consommation', subtitle: 'L\'historique de consommation fait partie de Premium.' },
  notifications: { title: 'Des rappels plus malins', subtitle: 'Délai d\'alerte personnalisé, rappels des repas et des ingrédients manquants avec Premium.' },
  household: { title: 'Partagez avec votre foyer', subtitle: 'Stock, liste de courses et planning partagés en temps réel, jusqu\'à 6 personnes, avec l\'offre Famille.' },
  profile: { title: 'Passez à la vitesse supérieure', subtitle: 'Des recettes sans compter, une semaine organisée, un foyer partagé.' },
};

/** Lignes de comparaison, construites à partir de la table `plans` (quotas modifiables en admin). */
export function featureLines(plan: PlanRow, opts: { aiPhotoScan?: boolean } = {}): string[] {
  const lines = [
    ...(opts.aiPhotoScan ? [`${plan.monthly_scan_quota} scans IA par mois${plan.code === 'family' ? ' pour le foyer' : ''}`] : []),
    plan.monthly_recipe_quota === null ? 'Idées de recettes illimitées' : `${plan.monthly_recipe_quota} idées de recettes par mois`,
  ];
  if (plan.features.meal_plan) lines.push('Planning de la semaine et liste de courses automatique');
  if (plan.features.smart_notifications) lines.push('Rappels intelligents (repas, ingrédients manquants, délai personnalisé)');
  if (plan.features.favorites) lines.push('Recettes favorites');
  if (plan.features.consumption_history) lines.push('Historique de consommation');
  if (plan.features.shared_household) lines.push(`Foyer partagé jusqu'à ${plan.max_members} personnes`);
  return lines;
}
