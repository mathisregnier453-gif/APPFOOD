// POST /functions/v1/scan-analyze  { "session_id": "<uuid>" }
//
// Analyse les photos d'une session de scan. Garanties :
// - le quota est vérifié et décrémenté CÔTÉ SERVEUR, de façon atomique ;
// - un scan qui échoue est remboursé ; aucun dépassement n'est jamais facturé ;
// - un appel IA n'est fait qu'une fois par session (idempotent) et jamais
//   pour des photos identiques déjà analysées (cache par empreinte) ;
// - chaque appel est journalisé avec son coût (ai_usage_logs).
import {
  adminClient, authenticate, corsHeaders, env, errorResponse, json, logServerError, sha256Hex, toBase64, todayUtc,
} from '../_shared/http.ts';
import { AiProviderError, type DetectedFood, getVisionProvider, type ScanImage, STORAGE_KINDS, type StorageKind } from '../_shared/ai/index.ts';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DetectionRow {
  id: string;
  name: string;
  category_id: string;
  quantity: number | null;
  unit: string;
  quantity_is_estimate: boolean;
  expiry_date: string | null;
  expiry_kind: string | null;
  confidence: number;
  photo_index: number | null;
}
const DETECTION_COLUMNS = 'id, name, category_id, quantity, unit, quantity_is_estimate, expiry_date, expiry_kind, confidence, photo_index';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');

  const admin = adminClient();
  const user = await authenticate(req, admin);
  if (!user) return errorResponse(401, 'unauthorized');

  let sessionId: unknown;
  try {
    sessionId = (await req.json())?.session_id;
  } catch {
    return errorResponse(400, 'invalid_body');
  }
  if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) return errorResponse(400, 'invalid_session_id');

  // 1. Profil : compte actif + consentement RGPD au traitement des photos
  const { data: profile } = await admin
    .from('profiles').select('suspended_at, privacy_consent_at').eq('id', user.id).single();
  if (!profile) return errorResponse(403, 'profile_missing');
  if (profile.suspended_at) return errorResponse(403, 'account_suspended');
  if (!profile.privacy_consent_at) return errorResponse(403, 'consent_required');

  // 2. Session : appartient à l'utilisateur, toujours membre du foyer
  const { data: session } = await admin
    .from('scan_sessions')
    .select('id, household_id, user_id, storage_kind, status')
    .eq('id', sessionId).eq('user_id', user.id).single();
  if (!session) return errorResponse(404, 'session_not_found');

  const { data: membership } = await admin
    .from('household_members').select('user_id')
    .eq('household_id', session.household_id).eq('user_id', user.id).maybeSingle();
  if (!membership) return errorResponse(403, 'forbidden');
  const { data: canWrite } = await admin.rpc('household_write_allowed', { p_household: session.household_id, p_user: user.id });
  if (canWrite !== true) return errorResponse(403, 'household_read_only');

  // Idempotence : session déjà analysée => on renvoie le résultat sans nouvel appel IA
  if (session.status === 'analyzed') {
    const { data: existing } = await admin.from('scan_detections').select(DETECTION_COLUMNS).eq('session_id', session.id);
    return json({ session_id: session.id, detections: existing ?? [], from_cache: true, scans_consumed: 0 });
  }
  if (session.status !== 'draft' && session.status !== 'failed') return errorResponse(409, 'invalid_session_status');
  if (!STORAGE_KINDS.includes(session.storage_kind as StorageKind)) return errorResponse(400, 'invalid_storage_kind');

  // 3. Photos (nombre max défini par l'offre, modifiable en admin)
  const { data: planCode } = await admin.rpc('effective_plan', { p_household: session.household_id });
  const { data: plan } = await admin.from('plans').select('max_photos_per_scan').eq('code', planCode ?? 'free').single();
  const maxPhotos = plan?.max_photos_per_scan ?? 4;

  const { data: photos } = await admin
    .from('scan_photos').select('storage_path, position')
    .eq('session_id', session.id).is('deleted_at', null).order('position');
  if (!photos || photos.length === 0) return errorResponse(400, 'no_photos');
  if (photos.length > maxPhotos) return errorResponse(400, 'too_many_photos', { max: maxPhotos });

  const images: ScanImage[] = [];
  const photoHashes: string[] = [];
  for (const photo of photos) {
    if (!photo.storage_path.startsWith(`${session.household_id}/${session.id}/`)) return errorResponse(400, 'invalid_photo_path');
    const { data: blob, error } = await admin.storage.from('scan-photos').download(photo.storage_path);
    if (error || !blob) return errorResponse(400, 'photo_unavailable');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > MAX_PHOTO_BYTES) return errorResponse(413, 'photo_too_large');
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return errorResponse(415, 'photo_not_jpeg');
    photoHashes.push(await sha256Hex(bytes));
    images.push({ base64: toBase64(bytes), mediaType: 'image/jpeg' });
  }
  const imagesHash = await sha256Hex(`${session.storage_kind}|${photoHashes.join(',')}`);

  // 4. Verrou de traitement (empêche deux analyses simultanées de la même session)
  const { data: locked } = await admin
    .from('scan_sessions')
    .update({ status: 'processing', photo_count: photos.length, images_hash: imagesHash, error_code: null })
    .eq('id', session.id).in('status', ['draft', 'failed'])
    .select('id').maybeSingle();
  if (!locked) return errorResponse(409, 'already_processing');

  // 5. Cache : photos identiques déjà analysées dans ce foyer => 0 scan consommé, 0 appel IA
  const { data: cachedSession } = await admin
    .from('scan_sessions').select('id')
    .eq('household_id', session.household_id).eq('images_hash', imagesHash)
    .in('status', ['analyzed', 'confirmed']).neq('id', session.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (cachedSession) {
    const { data: previous } = await admin.from('scan_detections').select(DETECTION_COLUMNS).eq('session_id', cachedSession.id);
    const rows = (previous ?? []).map(({ id: _id, ...d }) => ({ ...d, session_id: session.id, household_id: session.household_id }));
    const detections = await insertDetections(admin, rows);
    await admin.from('scan_sessions').update({
      status: 'analyzed', analyzed_at: new Date().toISOString(), from_cache: true, scans_consumed: 0,
      estimated_cost_usd: 0, result_summary: { item_count: detections.length },
    }).eq('id', session.id);
    return json({ session_id: session.id, detections, from_cache: true, scans_consumed: 0 });
  }

  // 6. Quota (atomique, côté serveur)
  const { data: quotaRows, error: quotaError } = await admin.rpc('consume_scan_quota', { p_household: session.household_id, p_count: 1 });
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : null;
  if (quotaError || !quota) {
    await admin.from('scan_sessions').update({ status: 'failed', error_code: 'quota_error' }).eq('id', session.id);
    return errorResponse(500, 'quota_error');
  }
  if (!quota.allowed) {
    await admin.from('scan_sessions').update({ status: 'draft' }).eq('id', session.id);
    return errorResponse(402, 'quota_exceeded', { scans_used: quota.scans_used, scans_limit: quota.scans_limit, plan: quota.plan });
  }

  // 7. Appel IA
  const { data: prefs } = await admin.from('profiles').select('locale').eq('id', user.id).single();
  try {
    const provider = getVisionProvider(env);
    const result = await provider.detectFoods({
      images, storageKind: session.storage_kind as StorageKind, locale: prefs?.locale ?? 'fr-FR', today: todayUtc(),
    });

    const detections = await insertDetections(admin, result.items.map((d) => toRow(d, session.id, session.household_id)));
    await admin.from('scan_sessions').update({
      status: 'analyzed', analyzed_at: new Date().toISOString(), scans_consumed: 1,
      ai_provider: result.usage.provider, ai_model: result.usage.model,
      input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens,
      estimated_cost_usd: result.usage.costUsd, result_summary: { item_count: detections.length },
    }).eq('id', session.id);
    await logUsage(admin, user.id, session, images.length, true, null, result.usage);

    return json({
      session_id: session.id, detections, from_cache: false, scans_consumed: 1,
      quota: { scans_used: quota.scans_used, scans_limit: quota.scans_limit, plan: quota.plan },
    });
  } catch (err) {
    // Échec => scan remboursé, rien n'est facturé à l'utilisateur.
    await admin.rpc('refund_scan_quota', { p_household: session.household_id, p_count: 1 });
    const code = err instanceof AiProviderError ? err.code : 'internal';
    await admin.from('scan_sessions').update({ status: 'failed', error_code: code, scans_consumed: 0 }).eq('id', session.id);
    await logUsage(admin, user.id, session, images.length, false, code, err instanceof AiProviderError ? err.usage : undefined);
    console.error('scan-analyze failed', { session: session.id, code, message: err instanceof Error ? err.message : String(err) });
    await logServerError(admin, 'scan-analyze', code, err, user.id);
    return errorResponse(code === 'rate_limited' ? 503 : 502, 'analysis_failed', { reason: code });
  }
});

function toRow(d: DetectedFood, sessionId: string, householdId: string) {
  return {
    session_id: sessionId,
    household_id: householdId,
    name: d.name,
    category_id: d.category,
    quantity: d.quantity,
    unit: d.unit,
    quantity_is_estimate: d.quantityIsEstimate,
    expiry_date: d.expiryDate,
    expiry_kind: d.expiryKind,
    confidence: d.confidence,
    photo_index: d.photoIndex,
  };
}

// deno-lint-ignore no-explicit-any
async function insertDetections(admin: any, rows: Record<string, unknown>[]): Promise<DetectionRow[]> {
  if (rows.length === 0) return [];
  const { data, error } = await admin.from('scan_detections').insert(rows).select(DETECTION_COLUMNS);
  if (error) throw new Error(`insert detections: ${error.message}`);
  return data as DetectionRow[];
}

async function logUsage(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
  session: { id: string; household_id: string },
  imageCount: number,
  success: boolean,
  errorCode: string | null,
  usage?: { provider: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number },
) {
  await admin.from('ai_usage_logs').insert({
    user_id: userId,
    household_id: session.household_id,
    feature: 'scan',
    provider: usage?.provider ?? env('AI_PROVIDER') ?? 'anthropic',
    model: usage?.model ?? env('AI_VISION_MODEL') ?? 'unknown',
    input_tokens: usage?.inputTokens ?? 0,
    output_tokens: usage?.outputTokens ?? 0,
    image_count: imageCount,
    cost_usd: usage?.costUsd ?? 0,
    latency_ms: usage?.latencyMs ?? null,
    success,
    error_code: errorCode,
    scan_session_id: session.id,
  });
}
