import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import { type PlannableItem, planExpiryReminders, planSignature } from './expiryPlanner';
import { type PlannedMealReminderInput, planMealReminders } from './mealPlanner';

// Notifications LOCALES : programmées sur le téléphone, aucune donnée de stock
// n'est envoyée à un service de push. Les notifications serveur (foyer, courses)
// arriveront avec les phases 3 et 5.

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const CHANNEL_ID = 'reminders';
let lastSignature: string | null = null;

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappels',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Demande l'autorisation (à appeler suite à une action explicite de l'utilisateur). */
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

async function cancelByPrefix(prefix: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Reprogramme les rappels de péremption (idempotent, ne fait rien si le plan est inchangé). */
export async function syncExpiryReminders(items: PlannableItem[], alertDays: number, enabled: boolean): Promise<void> {
  if (!enabled || !(await notificationsAllowed())) {
    if (lastSignature !== '') {
      await cancelByPrefix('expiry-');
      lastSignature = '';
    }
    return;
  }
  const plan = planExpiryReminders(items, alertDays, new Date());
  const signature = planSignature(plan);
  if (signature === lastSignature) return;

  await ensureChannel();
  await cancelByPrefix('expiry-');
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: '/recipes' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_ID },
    });
  }
  lastSignature = signature;
}

/** Alerte "quota bientôt atteint", au plus une fois par mois et par seuil. */
export async function notifyQuotaLow(scansLeft: number, periodEnd: string, enabled: boolean): Promise<void> {
  if (!enabled || scansLeft > 1 || !(await notificationsAllowed())) return;
  const key = `quota-alert:${periodEnd}:${scansLeft}`;
  try {
    if (await AsyncStorage.getItem(key)) return;
    await AsyncStorage.setItem(key, '1');
  } catch {
    return;
  }
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: scansLeft === 0 ? 'Scans du mois utilisés' : 'Plus qu\'un scan ce mois-ci',
      body: `Vos scans se renouvellent le ${new Date(periodEnd).toLocaleDateString('fr-FR')}. L'ajout manuel reste illimité.`,
    },
    trigger: null,
  });
}

let lastMealSignature: string | null = null;

/** Rappels de repas (heure du repas) et d'ingrédients manquants (la veille à 17 h). */
export async function syncMealReminders(meals: PlannedMealReminderInput[], prefs: { mealReminder: boolean; missingIngredient: boolean }): Promise<void> {
  const allowed = (prefs.mealReminder || prefs.missingIngredient) && (await notificationsAllowed());
  const plan = allowed ? planMealReminders(meals, { now: new Date(), ...prefs }) : [];
  const signature = plan.map((p) => `${p.id}|${p.body}|${p.fireAt.getTime()}`).join('\n');
  if (signature === lastMealSignature) return;
  await cancelByPrefix('meal-');
  await cancelByPrefix('missing-');
  if (plan.length) await ensureChannel();
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: r.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_ID },
    });
  }
  lastMealSignature = signature;
}


/**
 * Enregistre le jeton push de l'appareil (notifications d'activité du foyer).
 * Ne demande jamais l'autorisation : n'agit que si elle a déjà été accordée.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !(await notificationsAllowed())) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return; // projet EAS non configuré (développement)
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase.from('push_tokens').upsert(
    { token, user_id: userId, platform: Platform.OS === 'ios' ? 'ios' : 'android', updated_at: new Date().toISOString() },
    { onConflict: 'token' },
  );
}
