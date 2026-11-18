// Tâche planifiée (chaque minute) : envoie les notifications d'activité du foyer.
// - attend 1 minute avant d'envoyer (regroupe un scan de 20 produits en un seul message) ;
// - uniquement aux autres membres, selon leurs préférences, dans les foyers Famille ;
// - jetons invalides supprimés (DeviceNotRegistered).
// Appel autorisé uniquement avec l'en-tête x-cron-secret.
import { adminClient, env, errorResponse, json, logServerError, requireEnv } from '../_shared/http.ts';
import { type ActivityRow, buildPushMessages, chunk, type Recipient } from '../_shared/household-push.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SETTLE_MS = 60_000;

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== requireEnv('CRON_SECRET')) return errorResponse(401, 'unauthorized');
  const admin = adminClient();

  const { data: pending, error } = await admin
    .from('household_activity').select('id, household_id, actor_id, kind, item_count, sample')
    .is('notified_at', null).lt('created_at', new Date(Date.now() - SETTLE_MS).toISOString())
    .order('created_at').limit(500);
  if (error) return errorResponse(500, 'read_failed');
  const activities = (pending ?? []) as ActivityRow[];
  if (activities.length === 0) return json({ sent: 0 });

  // Marquées d'abord : une erreur d'envoi ne provoque jamais de doublons.
  await admin.from('household_activity').update({ notified_at: new Date().toISOString() }).in('id', activities.map((a) => a.id));

  const householdIds = [...new Set(activities.map((a) => a.household_id))];
  const allowed: string[] = [];
  for (const h of householdIds) {
    const { data } = await admin.rpc('plan_has_feature', { p_household: h, p_feature: 'shared_household' });
    if (data === true) allowed.push(h);
  }
  if (allowed.length === 0) return json({ sent: 0 });

  const { data: members } = await admin.from('household_members').select('household_id, user_id').in('household_id', allowed);
  const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  const [{ data: profiles }, { data: tokens }] = await Promise.all([
    admin.from('profiles').select('id, display_name, notification_prefs').in('id', userIds),
    admin.from('push_tokens').select('token, user_id').in('user_id', userIds),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const recipients: Recipient[] = (members ?? []).map((m) => ({
    user_id: m.user_id, household_id: m.household_id,
    prefs: profileById.get(m.user_id)?.notification_prefs ?? null,
    tokens: (tokens ?? []).filter((t) => t.user_id === m.user_id).map((t) => t.token as string),
  }));

  const messages = buildPushMessages(
    activities.filter((a) => allowed.includes(a.household_id)),
    recipients,
    (id) => (id && profileById.get(id)?.display_name) || 'Un membre',
  );

  let sent = 0;
  const invalid: string[] = [];
  for (const batch of chunk(messages, 100)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${env('EXPO_ACCESS_TOKEN')}` } : {}),
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.json().catch(() => null);
      const tickets: { status: string; details?: { error?: string } }[] = body?.data ?? [];
      tickets.forEach((t, i) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered') invalid.push(batch[i].to);
      });
    } catch (err) {
      console.error('push-dispatch batch failed', err instanceof Error ? err.message : err);
      await logServerError(admin, 'push-dispatch', 'batch_failed', err);
    }
  }
  if (invalid.length) await admin.from('push_tokens').delete().in('token', invalid);
  return json({ sent, invalid: invalid.length });
});
