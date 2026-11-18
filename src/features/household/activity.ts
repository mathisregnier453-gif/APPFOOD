// Fil d'activité du foyer : textes (module pur, testé).
import type { ActivityEntry } from './api';

/** Texte d'une entrée du fil d'activité (module pur). */
export function activityText(e: Pick<ActivityEntry, 'kind' | 'item_count' | 'sample'>, actor: string): string {
  const n = e.item_count;
  const s = e.sample.length ? ` : ${e.sample.slice(0, 3).join(', ')}${n > e.sample.length ? '…' : ''}` : '';
  switch (e.kind) {
    case 'items_added': return `${actor} a ajouté ${n} aliment${n > 1 ? 's' : ''}${s}`;
    case 'shopping_added': return `${actor} a ajouté ${n} article${n > 1 ? 's' : ''} à la liste${s}`;
    case 'shopping_purchased': return `${actor} a rangé ${n} achat${n > 1 ? 's' : ''}`;
    case 'member_joined': return `${actor} a rejoint le foyer`;
    case 'member_left': return `${actor} a quitté le foyer`;
  }
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const min = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} jours`;
}
