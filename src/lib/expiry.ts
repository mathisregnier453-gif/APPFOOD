// Logique des dates de péremption (module pur, testé dans tests/expiry.test.ts).
// Règle produit : ne JAMAIS affirmer qu'un produit est dangereux uniquement
// sur la base de la date ; on invite à vérifier le produit et les consignes.

export type ExpiryLevel = 'none' | 'ok' | 'soon' | 'urgent' | 'passed';

export interface ExpiryStatus {
  level: ExpiryLevel;
  daysLeft: number | null;
  label: string;
  advice: string | null;
}

const DAY = 86_400_000;

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function localTodayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysUntil(expiryDate: string, todayIso: string): number {
  return Math.round((toUtcDay(expiryDate) - toUtcDay(todayIso)) / DAY);
}

/**
 * @param alertDays seuil "bientôt périmé" choisi par l'utilisateur (2 jours par défaut)
 */
export function getExpiryStatus(
  expiryDate: string | null,
  kind: 'dlc' | 'ddm' | null,
  todayIso: string,
  alertDays = 2,
): ExpiryStatus {
  if (!expiryDate) return { level: 'none', daysLeft: null, label: 'Date non renseignée', advice: null };

  const days = daysUntil(expiryDate, todayIso);
  const kindLabel = kind === 'ddm' ? 'DDM' : kind === 'dlc' ? 'DLC' : 'Date';

  if (days < 0) {
    const ago = -days;
    return {
      level: 'passed',
      daysLeft: days,
      label: `${kindLabel} dépassée de ${ago} jour${ago > 1 ? 's' : ''}`,
      advice:
        kind === 'ddm'
          ? "La date de durabilité minimale est passée. Le produit peut rester consommable s'il a été bien conservé et que l'emballage est intact : vérifiez son aspect, son odeur et son goût."
          : kind === 'dlc'
            ? "La date limite de consommation est passée. Par précaution, vérifiez attentivement le produit et les consignes de conservation indiquées sur l'emballage avant toute consommation."
            : "La date indiquée est passée. Vérifiez le produit et les consignes de conservation figurant sur l'emballage.",
    };
  }
  if (days === 0) return { level: 'urgent', daysLeft: 0, label: "À consommer aujourd'hui", advice: null };
  if (days === 1) return { level: 'urgent', daysLeft: 1, label: 'À consommer demain', advice: null };
  if (days <= alertDays) return { level: 'soon', daysLeft: days, label: `Dans ${days} jours`, advice: null };
  return { level: 'ok', daysLeft: days, label: formatDateFr(expiryDate), advice: null };
}

export function formatDateFr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d} ${months[m - 1]} ${y}`;
}

/** Parse une saisie utilisateur JJ/MM/AAAA (ou JJ/MM/AA) en ISO, null si invalide. */
export function parseFrDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isoToFrInput(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
