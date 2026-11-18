// Synchronisation d'un utilisateur avec RevenueCat (source de vérité des achats).
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './http.ts';
import { deriveSubscription, type PlanMapping } from './revenuecat.ts';

const RC_API = 'https://api.revenuecat.com/v1';

export async function loadPlanMappings(admin: SupabaseClient): Promise<PlanMapping[]> {
  const { data, error } = await admin
    .from('plans').select('code, revenuecat_entitlement, store_product_monthly, store_product_yearly, position');
  if (error) throw new Error(`plans: ${error.message}`);
  return (data ?? []).map((p) => ({
    code: p.code, entitlement: p.revenuecat_entitlement, monthly: p.store_product_monthly,
    yearly: p.store_product_yearly, position: p.position,
  }));
}

/** Relit l'état RevenueCat de l'utilisateur et met à jour `subscriptions`. */
export async function syncUserSubscription(admin: SupabaseClient, userId: string, eventType: string | null): Promise<void> {
  const res = await fetch(`${RC_API}/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${requireEnv('REVENUECAT_SECRET_KEY')}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`revenuecat ${res.status}`);
  const derived = deriveSubscription(await res.json(), await loadPlanMappings(admin), Date.now());

  if (!derived) {
    // Jamais abonné (ou historique effacé) : aucune ligne à conserver.
    await admin.from('subscriptions').delete().eq('user_id', userId);
    return;
  }

  // L'abonnement reste attaché au foyer où il a été souscrit tant que le payeur
  // en est membre (changer de foyer affiché ne déplace pas l'offre Famille) ;
  // sinon il couvre son foyer courant.
  const { data: profile } = await admin.from('profiles').select('current_household_id').eq('id', userId).maybeSingle();
  if (!profile?.current_household_id) throw new Error('payer without household');
  const { data: existing } = await admin.from('subscriptions').select('household_id').eq('user_id', userId).maybeSingle();
  let householdId: string = profile.current_household_id;
  if (existing?.household_id) {
    const { data: stillMember } = await admin.from('household_members').select('user_id')
      .eq('household_id', existing.household_id).eq('user_id', userId).maybeSingle();
    if (stillMember) householdId = existing.household_id;
  }

  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    household_id: householdId,
    plan: derived.plan,
    period: derived.period,
    status: derived.status,
    store: derived.store,
    revenuecat_app_user_id: userId,
    product_id: derived.product_id,
    current_period_end: derived.current_period_end,
    will_renew: derived.will_renew,
    price_paid_cents: derived.price_paid_cents,
    currency: derived.currency,
    is_sandbox: derived.is_sandbox,
    entitlement: derived.entitlement,
    last_event_type: eventType,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(`subscriptions upsert: ${error.message}`);
}

/** Suppression des données chez RevenueCat (droit à l'effacement). N'annule pas l'abonnement store. */
export async function deleteRevenueCatSubscriber(userId: string, secretKey: string): Promise<void> {
  await fetch(`${RC_API}/subscribers/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(10_000),
  });
}
