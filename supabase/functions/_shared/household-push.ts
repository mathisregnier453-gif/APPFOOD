// Notifications d'activité du foyer (module pur, testé) : regroupement des
// entrées, destinataires selon leurs préférences, messages Expo Push.

export type ActivityKind = 'items_added' | 'shopping_added' | 'shopping_purchased' | 'member_joined' | 'member_left';

export interface ActivityRow {
  id: string;
  household_id: string;
  actor_id: string | null;
  kind: ActivityKind;
  item_count: number;
  sample: string[];
}

export interface Recipient {
  user_id: string;
  household_id: string;
  prefs: { household_activity?: boolean; shopping_update?: boolean } | null;
  tokens: string[];
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: { url: string };
  sound: null;
}

const PREF_FOR: Record<ActivityKind, 'household_activity' | 'shopping_update'> = {
  items_added: 'household_activity',
  member_joined: 'household_activity',
  member_left: 'household_activity',
  shopping_added: 'shopping_update',
  shopping_purchased: 'shopping_update',
};

const URL_FOR: Record<ActivityKind, string> = {
  items_added: '/stock', member_joined: '/household', member_left: '/household', shopping_added: '/courses', shopping_purchased: '/stock',
};

function list(sample: string[], total: number): string {
  const shown = sample.slice(0, 3).join(', ');
  return total > sample.length && shown ? `${shown}…` : shown;
}

export function describe(kind: ActivityKind, actor: string, count: number, sample: string[]): { title: string; body: string } {
  switch (kind) {
    case 'items_added':
      return { title: 'Stock mis à jour', body: `${actor} a ajouté ${count} aliment${count > 1 ? 's' : ''}${sample.length ? ` : ${list(sample, count)}` : ''}.` };
    case 'shopping_added':
      return { title: 'Liste de courses mise à jour', body: `${actor} a ajouté ${count} article${count > 1 ? 's' : ''}${sample.length ? ` : ${list(sample, count)}` : ''}.` };
    case 'shopping_purchased':
      return { title: 'Courses rangées', body: `${actor} a rangé ${count} achat${count > 1 ? 's' : ''} dans le stock.` };
    case 'member_joined':
      return { title: 'Nouveau membre', body: `${actor} a rejoint le foyer.` };
    case 'member_left':
      return { title: 'Foyer', body: `${actor} a quitté le foyer.` };
  }
}

/** Regroupe par (foyer, auteur, type) puis produit un message par appareil des autres membres. */
export function buildPushMessages(
  activities: ActivityRow[],
  recipients: Recipient[],
  actorName: (userId: string | null) => string,
): PushMessage[] {
  const groups = new Map<string, { a: ActivityRow; count: number; sample: string[] }>();
  for (const a of activities) {
    const key = `${a.household_id}|${a.actor_id}|${a.kind}`;
    const g = groups.get(key);
    if (g) {
      g.count += a.item_count;
      for (const s of a.sample) if (g.sample.length < 3 && !g.sample.includes(s)) g.sample.push(s);
    } else groups.set(key, { a, count: a.item_count, sample: [...a.sample].slice(0, 3) });
  }

  const messages: PushMessage[] = [];
  for (const { a, count, sample } of groups.values()) {
    const { title, body } = describe(a.kind, actorName(a.actor_id), count, sample);
    for (const r of recipients) {
      if (r.household_id !== a.household_id || r.user_id === a.actor_id) continue;
      if (r.prefs?.[PREF_FOR[a.kind]] === false) continue;
      for (const to of r.tokens) messages.push({ to, title, body, data: { url: URL_FOR[a.kind] }, sound: null });
    }
  }
  return messages;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
