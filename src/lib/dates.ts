// Dates locales au format ISO (YYYY-MM-DD), semaine commençant le lundi (module pur).

export function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysIso(iso: string, n: number): string {
  const d = dateFromIso(iso);
  d.setDate(d.getDate() + n);
  return isoFromDate(d);
}

export function mondayOf(iso: string): string {
  const d = dateFromIso(iso);
  const shift = (d.getDay() + 6) % 7; // lundi = 0
  return addDaysIso(iso, -shift);
}

export function weekDays(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
}

const DAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function dayLabel(iso: string): string {
  const d = dateFromIso(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
}

export function weekLabel(mondayIso: string): string {
  const start = dateFromIso(mondayIso);
  const end = dateFromIso(addDaysIso(mondayIso, 6));
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}
