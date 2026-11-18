// Politique de conservation des photos (RGPD) — tâche planifiée (toutes les heures).
// - Scans validés ou annulés : photos supprimées dès le passage suivant.
// - Tous les autres : photos supprimées au plus tard après SCAN_PHOTO_RETENTION_DAYS (7 par défaut).
// Appel autorisé uniquement avec l'en-tête x-cron-secret (secret serveur).
import { adminClient, corsHeaders, env, errorResponse, json, requireEnv } from '../_shared/http.ts';

const BATCH = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.headers.get('x-cron-secret') !== requireEnv('CRON_SECRET')) return errorResponse(401, 'unauthorized');

  const admin = adminClient();
  const retentionDays = Number(env('SCAN_PHOTO_RETENTION_DAYS') ?? '7');
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();

  const { data: closed } = await admin
    .from('scan_photos')
    .select('id, storage_path, scan_sessions!inner(status)')
    .is('deleted_at', null)
    .in('scan_sessions.status', ['confirmed', 'cancelled'])
    .limit(BATCH);
  const { data: expired } = await admin
    .from('scan_photos').select('id, storage_path')
    .is('deleted_at', null).lt('created_at', cutoff).limit(BATCH);

  const rows = new Map<string, string>();
  for (const r of [...(closed ?? []), ...(expired ?? [])]) rows.set(r.id, r.storage_path);
  if (rows.size === 0) return json({ deleted: 0 });

  const { error } = await admin.storage.from('scan-photos').remove([...rows.values()]);
  if (error) return errorResponse(500, 'storage_error', { message: error.message });

  await admin.from('scan_photos').update({ deleted_at: new Date().toISOString() }).in('id', [...rows.keys()]);
  return json({ deleted: rows.size });
});
