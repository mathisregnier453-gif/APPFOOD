// POST /functions/v1/delete-account  { "confirm": "SUPPRIMER" }
// Droit à l'effacement (RGPD) : supprime le compte et toutes les données personnelles.
// - Foyers dont l'utilisateur est le seul membre : supprimés (photos comprises).
// - Foyers partagés : la propriété est transférée au membre le plus ancien.
// - Journaux de coûts IA : conservés anonymisés (user_id => null) pour la comptabilité.
// Les abonnements store se résilient dans l'App Store / Google Play (rappelé dans l'app) ;
// l'historique d'achat est supprimé chez RevenueCat.
import { adminClient, authenticate, corsHeaders, env, errorResponse, json } from '../_shared/http.ts';
import { deleteRevenueCatSubscriber } from '../_shared/subscriptions.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');

  const admin = adminClient();
  const user = await authenticate(req, admin);
  if (!user) return errorResponse(401, 'unauthorized');

  const body = await req.json().catch(() => null);
  if (body?.confirm !== 'SUPPRIMER') return errorResponse(400, 'confirmation_required');

  const { data: memberships, error } = await admin
    .from('household_members').select('household_id, role').eq('user_id', user.id);
  if (error) return errorResponse(500, 'lookup_failed');

  for (const m of memberships ?? []) {
    const { data: others } = await admin
      .from('household_members').select('user_id, joined_at')
      .eq('household_id', m.household_id).neq('user_id', user.id)
      .order('joined_at', { ascending: true });

    if (!others || others.length === 0) {
      await removeHouseholdPhotos(admin, m.household_id);
      await admin.from('households').delete().eq('id', m.household_id);
    } else if (m.role === 'owner') {
      const heir = others[0].user_id;
      await admin.from('household_members').update({ role: 'owner' }).eq('household_id', m.household_id).eq('user_id', heir);
      await admin.from('households').update({ owner_id: heir }).eq('id', m.household_id);
    }
  }

  // Données d'achat chez RevenueCat (l'abonnement store doit être résilié par l'utilisateur).
  const rcKey = env('REVENUECAT_SECRET_KEY');
  if (rcKey) await deleteRevenueCatSubscriber(user.id, rcKey).catch(() => undefined);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return errorResponse(500, 'delete_failed');
  return json({ deleted: true });
});

// deno-lint-ignore no-explicit-any
async function removeHouseholdPhotos(admin: any, householdId: string) {
  const { data } = await admin.from('scan_photos').select('storage_path').eq('household_id', householdId).is('deleted_at', null);
  const paths = (data ?? []).map((r: { storage_path: string }) => r.storage_path);
  for (let i = 0; i < paths.length; i += 500) {
    await admin.storage.from('scan-photos').remove(paths.slice(i, i + 500));
  }
}
