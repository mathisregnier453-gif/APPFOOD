import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { invokeFunction, supabase } from '@/lib/supabase';
import { matchOffers, type Offer, type PlanRow } from './offers';

// Clés SDK RevenueCat PUBLIQUES (une par store). La clé secrète reste sur le serveur.
const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let configured = false;

export function billingAvailable(): boolean {
  return !!API_KEY && Platform.OS !== 'web';
}

/** Associe les achats au compte Supabase (app_user_id = id utilisateur). */
export async function identify(userId: string | null): Promise<void> {
  if (!billingAvailable()) return;
  if (!configured) {
    Purchases.configure({ apiKey: API_KEY!, appUserID: userId ?? undefined });
    configured = true;
    return;
  }
  if (userId) await Purchases.logIn(userId);
  else if (!(await Purchases.getCustomerInfo()).originalAppUserId.startsWith('$RCAnonymousID')) await Purchases.logOut();
}

export async function fetchPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('code, label, monthly_scan_quota, monthly_recipe_quota, max_members, store_product_monthly, store_product_yearly, features')
    .order('position');
  if (error) throw error;
  return data as PlanRow[];
}

export async function fetchOffers(plans: PlanRow[]): Promise<Offer<PurchasesPackage>[]> {
  if (!billingAvailable()) return [];
  const offerings = await Purchases.getOfferings();
  return matchOffers(offerings.current?.availablePackages ?? [], plans, Object.values(offerings.all ?? {}));
}

export type PurchaseOutcome = 'purchased' | 'cancelled';

/**
 * Achat explicite d'un abonnement (fenêtre de confirmation du store).
 * Changement d'offre sur Android : remplacement de l'abonnement en cours.
 * Après l'achat, le serveur relit l'état chez RevenueCat et applique les droits.
 */
export async function purchase(offer: Offer<PurchasesPackage>): Promise<PurchaseOutcome> {
  try {
    let productChange = null;
    if (Platform.OS === 'android') {
      const info = await Purchases.getCustomerInfo();
      const current = info.activeSubscriptions.find((id) => id.split(':')[0] !== offer.pkg.product.identifier.split(':')[0]);
      if (current) productChange = { oldProductIdentifier: current.split(':')[0] };
    }
    await Purchases.purchasePackage(offer.pkg, null, productChange);
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw err;
  }
  await syncSubscription();
  return 'purchased';
}

export async function restore(): Promise<void> {
  await Purchases.restorePurchases();
  await syncSubscription();
}

export async function syncSubscription(): Promise<void> {
  await invokeFunction('subscription-sync', {});
}

export async function manageSubscription(): Promise<void> {
  await Purchases.showManageSubscriptions();
}
