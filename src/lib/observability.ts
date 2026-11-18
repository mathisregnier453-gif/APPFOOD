import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

// -----------------------------------------------------------------------------
// Erreurs : Sentry (DSN public). Aucune donnée personnelle : ni e-mail, ni IP,
// ni contenu du stock ; les URLs sont tronquées à leur chemin.
// -----------------------------------------------------------------------------
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initErrorTracking(): void {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    attachViewHierarchy: false,
    reportAccessibilityIdentifier: false,
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',
    beforeSend(event) {
      if (event.user) event.user = { id: event.user.id };
      if (event.request?.url) event.request.url = event.request.url.split('?')[0];
      delete event.request?.headers;
      delete event.request?.data;
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.data?.url && typeof crumb.data.url === 'string') crumb.data.url = crumb.data.url.split('?')[0];
      return crumb;
    },
  });
}

/** Identifiant technique uniquement (jamais l'e-mail). */
export function setErrorUser(userId: string | null): void {
  if (SENTRY_DSN) Sentry.setUser(userId ? { id: userId } : null);
}

export const wrapRoot = <P extends Record<string, unknown>>(component: React.ComponentType<P>) =>
  SENTRY_DSN ? Sentry.wrap(component) : component;

// -----------------------------------------------------------------------------
// Statistiques d'usage : PostHog (serveur UE), UNIQUEMENT avec le consentement
// de l'utilisateur. Événements anonymes : aucun profil personne, aucun identifiant
// de compte, aucune propriété libre (liste blanche ci-dessous).
// -----------------------------------------------------------------------------
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

export type AnalyticsEvent =
  | { name: 'scan_completed'; props: { items: number; photos: number; from_cache: boolean } }
  | { name: 'recipes_generated'; props: { count: number; from_cache: boolean } }
  | { name: 'meal_plan_generated'; props: { meals: number } }
  | { name: 'paywall_viewed'; props: { reason: string } }
  | { name: 'purchase_completed'; props: { plan: string; period: string } }
  | { name: 'household_joined'; props: Record<string, never> }
  | { name: 'item_added_manually'; props: { barcode: boolean } };

let client: PostHog | null = null;
let consented = false;

export function setAnalyticsConsent(consent: boolean): void {
  consented = consent;
  if (!POSTHOG_KEY) return;
  if (consent && !client) {
    client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, personProfiles: 'never', defaultOptIn: true });
  }
  if (client) void (consent ? client.optIn() : client.optOut());
}

export function track<E extends AnalyticsEvent>(name: E['name'], props: E['props']): void {
  if (!consented || !client) return;
  client.capture(name, props as Record<string, string | number | boolean>);
}
