// POST /functions/v1/subscription-sync
// Appelé par l'app juste après un achat ou une restauration : les droits sont
// appliqués immédiatement, sans attendre le webhook. L'utilisateur ne peut
// synchroniser que son propre compte ; l'état vient toujours de RevenueCat.
import { adminClient, authenticate, corsHeaders, errorResponse, json, logServerError } from '../_shared/http.ts';
import { syncUserSubscription } from '../_shared/subscriptions.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');

  const admin = adminClient();
  const user = await authenticate(req, admin);
  if (!user) return errorResponse(401, 'unauthorized');

  try {
    await syncUserSubscription(admin, user.id, 'APP_SYNC');
  } catch (err) {
    console.error('subscription-sync', err instanceof Error ? err.message : err);
    await logServerError(admin, 'subscription-sync', 'sync_failed', err, user.id);
    return errorResponse(502, 'sync_failed');
  }

  const { data: profile } = await admin.from('profiles').select('current_household_id').eq('id', user.id).single();
  const { data: plan } = await admin.rpc('effective_plan', { p_household: profile?.current_household_id });
  return json({ plan: plan ?? 'free' });
});
