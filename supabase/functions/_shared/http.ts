import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: code, ...extra }, status);
}

export function env(key: string): string | undefined {
  return Deno.env.get(key);
}

export function requireEnv(key: string): string {
  const v = env(key);
  if (!v) throw new Error(`Variable d'environnement manquante : ${key}`);
  return v;
}

/** Client service_role : contourne RLS, à n'utiliser qu'après contrôle d'autorisation explicite. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticate(req: Request, admin: SupabaseClient): Promise<User | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function sha256Hex(data: Uint8Array<ArrayBuffer> | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Journalise une erreur serveur (visible dans l'espace admin). Ne lève jamais d'exception. */
// deno-lint-ignore no-explicit-any
export async function logServerError(admin: any, source: string, code: string, message: unknown, userId?: string | null): Promise<void> {
  try {
    const text = message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message);
    await admin.from('error_logs').insert({ source, code, message: text?.slice(0, 500) ?? null, user_id: userId ?? null });
  } catch {
    // le journal d'erreurs ne doit jamais faire échouer la requête
  }
}
