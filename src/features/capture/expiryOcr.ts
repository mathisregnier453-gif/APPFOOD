// Lecture d'une date de péremption dans le texte d'un emballage (module pur, testé).
// Gratuit et local : le texte vient de l'OCR du téléphone. Si la date n'est pas
// lisible sans ambiguïté, on ne renvoie rien (jamais de date inventée).

export interface ExpiryReading {
  date: string; // YYYY-MM-DD
  kind: 'dlc' | 'ddm' | null;
}

const DLC_WORDS = ['JUSQU', 'DLC', 'A CONSOMMER JUSQU', 'USE BY'];
const DDM_WORDS = ['DE PREFERENCE', 'PREFERENCE', 'DDM', 'DLUO', 'AVANT FIN', 'BEST BEFORE', 'A CONSOMMER DE PREF'];
const IGNORE_WORDS = ['FAB', 'EMB', 'PRODUIT LE', 'FABRIQUE', 'LOT', 'CONDITIONNE'];

function norm(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

/** Corrige les confusions OCR courantes à l'intérieur des groupes de chiffres (O->0, I/L->1, S->5). */
function fixDigits(s: string): string {
  return s.replace(/[0-9OILS]{1,4}(?=[/.\- ][0-9OILS])|(?<=[/.\- ])[0-9OILS]{1,4}/g, (m) =>
    m.replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5'));
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function plausible(dateIso: string, today: string): boolean {
  const t = Date.parse(today), d = Date.parse(dateIso), day = 86_400_000;
  return d >= t - 730 * day && d <= t + 3650 * day;
}

interface Candidate { date: string; index: number; monthOnly: boolean }

function candidates(text: string, today: string): Candidate[] {
  const out: Candidate[] = [];
  const full = /(?<!\d)(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4}|\d{2})(?!\d)/g;
  for (const m of text.matchAll(full)) {
    const date = iso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (date && plausible(date, today)) out.push({ date, index: m.index ?? 0, monthOnly: false });
  }
  // Mois/année seuls (DDM « fin 03/2027 ») => dernier jour du mois imprimé.
  const monthYear = /(?<![\d/.\-])(\d{1,2})[/.\-](\d{4})(?![\d/.\-])/g;
  for (const m of text.matchAll(monthYear)) {
    const month = Number(m[1]), year = Number(m[2]);
    if (month < 1 || month > 12) continue;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const date = iso(year, month, last);
    if (date && plausible(date, today)) out.push({ date, index: m.index ?? 0, monthOnly: true });
  }
  return out.sort((a, b) => a.index - b.index);
}

function kindNear(text: string, index: number): 'dlc' | 'ddm' | null {
  const before = text.slice(Math.max(0, index - 60), index);
  const ddm = Math.max(...DDM_WORDS.map((w) => before.lastIndexOf(w)));
  const dlc = Math.max(...DLC_WORDS.map((w) => before.lastIndexOf(w)));
  if (ddm < 0 && dlc < 0) return null;
  return ddm > dlc ? 'ddm' : 'dlc';
}

function ignoredNear(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 14), index);
  return IGNORE_WORDS.some((w) => before.includes(w));
}

export function extractExpiry(rawText: string, today: string): ExpiryReading | null {
  const text = fixDigits(norm(rawText));
  const found = candidates(text, today).filter((c) => !ignoredNear(text, c.index));
  if (found.length === 0) return null;

  // Date précédée d'une mention DLC/DDM : prioritaire.
  const labelled = found.filter((c) => kindNear(text, c.index) !== null);
  if (labelled.length >= 1) {
    const c = labelled[0];
    return { date: c.date, kind: c.monthOnly ? 'ddm' : kindNear(text, c.index) };
  }
  // Sinon, uniquement si une seule date distincte est lisible.
  const distinct = [...new Set(found.map((c) => c.date))];
  if (distinct.length === 1) return { date: distinct[0], kind: found[0].monthOnly ? 'ddm' : null };
  return null;
}
