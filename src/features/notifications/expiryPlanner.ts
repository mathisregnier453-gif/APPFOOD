// Planification des rappels de péremption (module pur, testé).
// Un seul rappel par jour, regroupant tous les produits concernés, à 9 h.
// Plafond de rappels programmés (iOS limite à 64 notifications locales).

export interface PlannableItem {
  id: string;
  name: string;
  expiry_date: string | null;
}

export interface PlannedReminder {
  /** identifiant stable => replanification idempotente */
  id: string;
  fireAt: Date;
  title: string;
  body: string;
}

export const REMINDER_HOUR = 9;
export const MAX_REMINDERS = 30;
export const HORIZON_DAYS = 30;

function atLocal(dateIso: string, hour: number): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

function shiftDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

function whenLabel(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

export function planExpiryReminders(items: PlannableItem[], alertDays: number, now: Date): PlannedReminder[] {
  const byDay = new Map<string, { item: PlannableItem; daysLeft: number }[]>();

  for (const item of items) {
    if (!item.expiry_date) continue;
    const expiry = item.expiry_date.slice(0, 10);
    const notifyDay = shiftDays(expiry, -alertDays);
    const fireAt = atLocal(notifyDay, REMINDER_HOUR);
    if (fireAt.getTime() <= now.getTime()) continue; // passé : déjà visible dans l'app
    if (fireAt.getTime() - now.getTime() > HORIZON_DAYS * 86_400_000) continue;
    const list = byDay.get(notifyDay) ?? [];
    list.push({ item, daysLeft: dayDiff(expiry, notifyDay) });
    byDay.set(notifyDay, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, MAX_REMINDERS)
    .map(([day, entries]) => {
      entries.sort((a, b) => a.daysLeft - b.daysLeft || a.item.name.localeCompare(b.item.name, 'fr'));
      const shown = entries.slice(0, 3).map((e) => `${e.item.name} (${whenLabel(e.daysLeft)})`);
      const more = entries.length - shown.length;
      return {
        id: `expiry-${day}`,
        fireAt: atLocal(day, REMINDER_HOUR),
        title: entries.length === 1 ? 'À consommer bientôt' : `${entries.length} produits à consommer bientôt`,
        body: shown.join(', ') + (more > 0 ? ` et ${more} autre${more > 1 ? 's' : ''}` : '') + '. Des idées de recettes vous attendent.',
      };
    });
}

/** Empreinte du plan : évite de reprogrammer si rien n'a changé. */
export function planSignature(plan: PlannedReminder[]): string {
  return plan.map((p) => `${p.id}|${p.body}`).join('\n');
}
