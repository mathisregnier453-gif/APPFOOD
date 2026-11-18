// POST /functions/v1/revenuecat-webhook   (appelé par RevenueCat, pas par l'app)
// Achats, renouvellements, changements d'offre, résiliations, remboursements, transferts.
// - Authentifié par l'en-tête Authorization configuré dans RevenueCat (REVENUECAT_WEBHOOK_AUTH).
// - Idempotent : chaque événement n'est traité qu'une fois (table revenuecat_events).
// - Les droits sont recalculés depuis l'API RevenueCat (ordre des événements sans importance).
// - En cas d'erreur, réponse 500 : RevenueCat renvoie l'événement plus tard.
import { adminClient, env, errorResponse, json, logServerError } from '../_shared/http.ts';
import { affectedUserIds, safeEqual } from '../_shared/revenuecat.ts';
import { syncUserSubscription } from '../_shared/subscriptions.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');
  // Tant que le secret n'est pas configuré, on refuse proprement (RevenueCat réessaiera plus tard).
  const expected = env('REVENUECAT_WEBHOOK_AUTH');
  if (!expected) return errorResponse(503, 'not_configured');
  if (!safeEqual(req.headers.get('Authorization') ?? '', expected)) {
    return errorResponse(401, 'unauthorized');
  }

  const body = await req.json().catch(() => null);
  const event = body?.event;
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') return errorResponse(400, 'invalid_event');

  const admin = adminClient();
  const { data: existing } = await admin.from('revenuecat_events').select('processed_at').eq('id', event.id).maybeSingle();
  if (existing?.processed_at) return json({ ok: true, duplicate: true });
  if (!existing) {
    await admin.from('revenuecat_events').insert({
      id: event.id, type: event.type, app_user_id: typeof event.app_user_id === 'string' ? event.app_user_id : null,
      environment: typeof event.environment === 'string' ? event.environment : null, payload: body,
    });
  }

  if (event.type === 'TEST') {
    await admin.from('revenuecat_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id);
    return json({ ok: true, test: true });
  }

  const users = affectedUserIds(event);
  try {
    for (const userId of users) {
      // Un identifiant inconnu (compte supprimé) est ignoré.
      const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (profile) await syncUserSubscription(admin, userId, event.type);
    }
    await admin.from('revenuecat_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', event.id);
    return json({ ok: true, users: users.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from('revenuecat_events').update({ error: message.slice(0, 500) }).eq('id', event.id);
    console.error('revenuecat-webhook', { id: event.id, type: event.type, message });
    await logServerError(admin, 'revenuecat-webhook', event.type, message);
    return errorResponse(500, 'sync_failed');
  }
});
