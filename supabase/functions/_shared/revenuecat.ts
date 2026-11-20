// Traduction de l'état RevenueCat (API REST v1 /subscribers) en abonnement Sauge.
// Module pur, testé. On ne fait pas confiance au contenu des webhooks pour les
// droits : à chaque événement, on relit l'état de référence chez RevenueCat.

export type PlanCode = 'free' | 'premium' | 'family';

export interface PlanMapping {
  code: PlanCode;
  entitlement: string | null;
  monthly: string | null;
  yearly: string | null;
  position: number;
}

export interface DerivedSubscription {
  plan: Exclude<PlanCode, 'free'>;
  period: 'monthly' | 'yearly';
  status: 'active' | 'in_grace_period' | 'cancelled' | 'billing_issue' | 'expired';
  product_id: string | null;
  store: string | null;
  current_period_end: string | null;
  will_renew: boolean;
  is_sandbox: boolean;
  entitlement: string;
  price_paid_cents: number | null;
  currency: string | null;
}

type Json = Record<string, unknown>;

function obj(v: unknown): Json | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : null;
}
function time(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}
/** Google Play : "produit:base-plan" => "produit" */
export function baseProductId(id: unknown): string | null {
  return typeof id === 'string' && id ? id.split(':')[0] : null;
}

/** Mensuel ou annuel : par identifiant produit connu, sinon par la durée de la période en cours. */
function periodOf(product: string | null, plan: PlanMapping, sub: Record<string, unknown>): 'monthly' | 'yearly' {
  if (product !== null && product === plan.yearly) return 'yearly';
  if (product !== null && product === plan.monthly) return 'monthly';
  const start = time(sub.purchase_date), end = time(sub.expires_date);
  return start !== null && end !== null && end - start > 45 * 86_400_000 ? 'yearly' : 'monthly';
}

export function deriveSubscription(body: unknown, plans: PlanMapping[], now: number): DerivedSubscription | null {
  const subscriber = obj(obj(body)?.subscriber);
  if (!subscriber) return null;
  const entitlements = obj(subscriber.entitlements) ?? {};
  const subscriptions = obj(subscriber.subscriptions) ?? {};

  const candidates: { derived: DerivedSubscription; active: boolean; end: number; position: number }[] = [];

  for (const plan of plans) {
    if (plan.code === 'free' || !plan.entitlement) continue;
    const ent = obj(entitlements[plan.entitlement]);
    if (!ent) continue;

    const product = baseProductId(ent.product_identifier);
    const subKey = Object.keys(subscriptions).find((k) => baseProductId(k) === product);
    const sub = subKey ? obj(subscriptions[subKey]) ?? {} : {};

    const expires = time(ent.expires_date) ?? time(sub.expires_date);
    const grace = time(ent.grace_period_expires_date) ?? time(sub.grace_period_expires_date);
    const refunded = time(sub.refunded_at) !== null;
    const end = Math.max(expires ?? 0, grace ?? 0);
    const lifetime = ent.expires_date === null && !refunded;
    const active = !refunded && (lifetime || end > now);

    let status: DerivedSubscription['status'];
    if (!active) status = sub.billing_issues_detected_at ? 'billing_issue' : 'expired';
    else if (expires !== null && expires <= now && grace !== null && grace > now) status = 'in_grace_period';
    else if (sub.unsubscribe_detected_at) status = 'cancelled';
    else status = 'active';

    const price = obj(sub.price);
    const amount = typeof price?.amount === 'number' ? Math.round(price.amount * 100) : null;

    candidates.push({
      active,
      end,
      position: plan.position,
      derived: {
        plan: plan.code,
        period: periodOf(product, plan, sub),
        status,
        product_id: product,
        store: typeof sub.store === 'string' ? sub.store : null,
        current_period_end: lifetime ? null : end > 0 ? new Date(end).toISOString() : null,
        will_renew: active && !sub.unsubscribe_detected_at && !refunded,
        is_sandbox: sub.is_sandbox === true,
        entitlement: plan.entitlement,
        price_paid_cents: amount,
        currency: typeof price?.currency === 'string' ? price.currency : null,
      },
    });
  }

  if (candidates.length === 0) return null;
  // Droit actif le plus élevé (Famille > Premium) ; sinon le plus récemment expiré.
  const active = candidates.filter((c) => c.active).sort((a, b) => b.position - a.position);
  if (active.length) return active[0].derived;
  return candidates.sort((a, b) => b.end - a.end)[0].derived;
}

/** Utilisateurs concernés par un webhook (identifiants Supabase uniquement). */
export function affectedUserIds(event: Json): string[] {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const raw: unknown[] = [
    event.app_user_id, event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
    ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
  ];
  return [...new Set(raw.filter((v): v is string => typeof v === 'string' && uuid.test(v)).map((v) => v.toLowerCase()))];
}

/** Comparaison en temps constant du secret du webhook. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
