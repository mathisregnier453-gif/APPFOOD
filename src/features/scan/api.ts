import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { invokeFunction, supabase } from '@/lib/supabase';
import type { ExpiryKind, FoodUnit, ScanDetection, StorageKind } from '@/lib/types';

// Optimisation des coûts IA : chaque photo est redimensionnée (1280 px sur le
// grand côté, suffisant pour lire une étiquette) et compressée en JPEG avant
// l'envoi. Une photo de 12 Mpx (~4 Mo) passe ainsi à ~200-400 Ko et à
// ~1 600 tokens image côté IA, au lieu d'être réduite (et facturée) par le serveur.
export const MAX_EDGE_PX = 1280;
export const JPEG_QUALITY = 0.7;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export async function compressPhoto(photo: CapturedPhoto): Promise<CapturedPhoto> {
  const landscape = photo.width >= photo.height;
  const longEdge = Math.max(photo.width, photo.height);
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (longEdge > MAX_EDGE_PX) {
    ctx.resize(landscape ? { width: MAX_EDGE_PX } : { height: MAX_EDGE_PX });
  }
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export async function createScanSession(householdId: string, userId: string, storageKind: StorageKind): Promise<string> {
  const { data, error } = await supabase
    .from('scan_sessions')
    .insert({ household_id: householdId, user_id: userId, storage_kind: storageKind })
    .select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function uploadScanPhotos(householdId: string, sessionId: string, photos: CapturedPhoto[]): Promise<void> {
  for (const [index, photo] of photos.entries()) {
    const bytes = await new File(photo.uri).arrayBuffer();
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error('photo_too_large');
    const path = `${householdId}/${sessionId}/${index}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('scan-photos')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    // Ré-essai après coupure réseau : le fichier peut déjà être en ligne.
    if (uploadError && !/exist|duplicate/i.test(uploadError.message)) throw uploadError;
    const { error } = await supabase.from('scan_photos').insert({
      session_id: sessionId, household_id: householdId, storage_path: path,
      width: photo.width, height: photo.height, bytes: bytes.byteLength, position: index,
    });
    // Ré-essai après échec réseau : la ligne peut déjà exister (chemin unique).
    if (error && error.code !== '23505') throw error;
  }
}

export interface AnalyzeResponse {
  session_id: string;
  detections: ScanDetection[];
  from_cache: boolean;
  scans_consumed: number;
  quota?: { scans_used: number; scans_limit: number; plan: string };
}

export function analyzeScan(sessionId: string): Promise<AnalyzeResponse> {
  return invokeFunction<AnalyzeResponse>('scan-analyze', { session_id: sessionId });
}

export interface ConfirmItem {
  detection_id: string | null;
  name: string;
  category_id: string;
  quantity: number | null;
  unit: FoodUnit;
  quantity_is_estimate: boolean;
  expiry_date: string | null;
  expiry_kind: ExpiryKind | null;
  storage_location_id: string;
}

export async function confirmScan(sessionId: string, items: ConfirmItem[]): Promise<number> {
  const { data, error } = await supabase.rpc('confirm_scan', { p_session: sessionId, p_items: items });
  if (error) throw error;
  return data as number;
}

export async function cancelScan(sessionId: string): Promise<void> {
  await supabase.rpc('cancel_scan', { p_session: sessionId });
}
