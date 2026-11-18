// Ticket de caisse -> produits (module pur, testé). Analyse 100 % locale et gratuite.
// Règle : on n'invente rien. Pas de date (un ticket n'en contient pas pour les
// produits) ; une quantité n'est proposée que si elle est écrite sur le ticket.
import { guessCategory } from '../planning/shopping.ts';
import type { CategoryId, FoodUnit } from '@/lib/types';

// -----------------------------------------------------------------------------
// 1. Reconstitution des lignes : l'OCR rend souvent le libellé et le prix comme
//    deux blocs séparés ; on les regroupe par position verticale.
// -----------------------------------------------------------------------------
export interface OcrLine {
  text: string;
  frame?: { top: number; left: number; height: number; width: number };
}

export function ocrRows(lines: OcrLine[]): string[] {
  const framed = lines.filter((l) => l.frame && l.text.trim());
  if (framed.length < lines.filter((l) => l.text.trim()).length / 2) {
    return lines.map((l) => l.text.trim()).filter(Boolean); // pas de positions fiables : ordre d'origine
  }
  const sorted = [...framed].sort((a, b) => a.frame!.top - b.frame!.top);
  const rows: { center: number; height: number; parts: OcrLine[] }[] = [];
  for (const line of sorted) {
    const f = line.frame!;
    const center = f.top + f.height / 2;
    const row = rows.find((r) => Math.abs(r.center - center) < Math.max(r.height, f.height) * 0.6);
    if (row) {
      row.parts.push(line);
      row.center = (row.center * (row.parts.length - 1) + center) / row.parts.length;
    } else rows.push({ center, height: f.height, parts: [line] });
  }
  return rows.map((r) => r.parts.sort((a, b) => a.frame!.left - b.frame!.left).map((p) => p.text.trim()).join('  '));
}

// -----------------------------------------------------------------------------
// 2. Analyse des lignes
// -----------------------------------------------------------------------------
export interface ReceiptItem {
  name: string;
  quantity: number | null;
  unit: FoodUnit;
  category: CategoryId;
  /** high : libellé + prix lus clairement ; low : à vérifier par l'utilisateur */
  confidence: 'high' | 'low';
  source: string;
}

const SKIP = [
  'TOTAL', 'SOUS-TOTAL', 'SOUS TOTAL', 'TVA', 'CARTE', 'CB ', 'ESPECES', 'RENDU', 'MONNAIE', 'REMISE', 'PROMO',
  'BON ', 'FIDELITE', 'POINTS', 'MERCI', 'TICKET', 'CAISSE', 'SIRET', 'TEL ', 'TEL.', 'MAGASIN', 'A REPORTER',
  'ARTICLE', 'PAIEMENT', 'DATE', 'HEURE', 'CAISSIER', 'HOTESSE', 'AVOIR', 'ECONOMIE', 'CAGNOTTE', 'SANS CONTACT',
  'NET A PAYER', 'A PAYER', 'REGLEMENT', 'CONSIGNE', 'MONTANT', 'HT ', 'TTC', 'CHEQUE', 'VISA', 'MASTERCARD', 'WWW', 'HTTP',
];

const NON_FOOD = ['SAC ', 'SACS', 'LESSIVE', 'PAPIER TOIL', 'ESSUIE', 'SHAMP', 'DENTIF', 'EPONGE', 'PILES', 'LITIERE', 'COUCHES', 'MOUCHOIR', 'DEO ', 'GEL DOUCHE', 'LIQ VAISS', 'NETTOY', 'JAVEL', 'ASSOUP'];

// Abréviations courantes des tickets français.
const ABBREVIATIONS: Record<string, string> = {
  YAO: 'yaourt', YAOURTS: 'yaourts', NAT: 'nature', ECR: 'écrémé', 'DEMI-ECR': 'demi-écrémé', DEM: 'demi',
  FROM: 'fromage', FRO: 'fromage', JBN: 'jambon', JAMB: 'jambon', BLC: 'blanc', PDT: 'pommes de terre',
  PDTERRE: 'pommes de terre', SAUC: 'saucisses', STK: 'steak', STEAK: 'steak', HACH: 'haché', HACHE: 'haché', PLT: 'poulet',
  FIL: 'filet', FILT: 'filet', LEG: 'légumes', CREM: 'crème', CRM: 'crème', BEUR: 'beurre', BRE: 'beurre', MOZZA: 'mozzarella',
  EMMENT: 'emmental', EMM: 'emmental', CHOC: 'chocolat', CHOCO: 'chocolat', COMPOT: 'compote', CONF: 'confiture',
  OEUF: 'oeufs', OEUFS: 'oeufs', OEUF6: 'oeufs', SAUM: 'saumon', CAB: 'cabillaud', FRAIS: 'frais', FR: 'frais',
  BIO: 'bio', LT: 'lait', JUS: 'jus', ORA: 'orange', POM: 'pommes', BAN: 'bananes', CAROT: 'carottes', TOM: 'tomates',
  SALAD: 'salade', CHAMP: 'champignons', COURG: 'courgettes', POIV: 'poivrons', OIGN: 'oignons', SPAG: 'spaghetti',
  PAT: 'pâtes', PATES: 'pâtes', RIZ: 'riz', FARIN: 'farine', SUC: 'sucre', HUIL: 'huile', VINAIG: 'vinaigre',
};

function normalize(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

const PRICE_AT_END = /^(.*?)\s+(-?\d{1,4}[.,]\d{2})\s*(?:€|EUR|E)?\s*(?:[A-D0-9]|\*)?$/;
const MULTIPLIER_LINE = /^(\d{1,3})\s*[X*]\s*\d{1,4}[.,]\d{2}/;
const WEIGHT_LINE = /^(\d{1,3}[.,]\d{1,3})\s*KG\s*[X*]/;
const PACK = /(?:^|\s)X\s?(\d{1,2})(?=\s|$)|(?:^|\s)(\d{1,2})\s?X(?=\s|\d|$)/;
const SIZE = /(\d{1,4}(?:[.,]\d{1,3})?)\s?(KG|G|GR|L|CL|ML)(?=\s|$)/;

function cleanName(raw: string): string {
  const words = raw
    .replace(/\b\d{8,14}\b/g, ' ')            // codes EAN
    .replace(SIZE, ' ').replace(PACK, ' ')
    .replace(/[^A-Z0-9%' -]/g, ' ')
    .split(/\s+/).filter((w) => w && !/^\d+%?$/.test(w));
  const text = words.map((w) => ABBREVIATIONS[w] ?? w.toLowerCase()).join(' ').replace(/\s+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function readQuantity(name: string): { quantity: number | null; unit: FoodUnit } {
  const pack = name.match(PACK);
  if (pack) return { quantity: Number(pack[1] ?? pack[2]), unit: 'piece' };
  const size = name.match(SIZE);
  if (size) {
    const n = Number(size[1].replace(',', '.'));
    switch (size[2]) {
      case 'KG': return { quantity: n, unit: 'kg' };
      case 'G': case 'GR': return { quantity: n, unit: 'g' };
      case 'L': return { quantity: n, unit: 'l' };
      case 'CL': return { quantity: n * 10, unit: 'ml' };
      default: return { quantity: n, unit: 'ml' };
    }
  }
  return { quantity: null, unit: 'piece' };
}

export function parseReceipt(rows: string[]): { items: ReceiptItem[]; ignored: number } {
  const items: ReceiptItem[] = [];
  let ignored = 0;

  const prepared = rows.map((r) => normalize(r).replace(/(\d),(\d)/g, '$1.$2'));
  for (const [index, line] of prepared.entries()) {
    const raw = rows[index];
    if (!line) continue;

    // Ligne de multiplicateur / de poids : s'applique au produit précédent.
    const mult = line.match(MULTIPLIER_LINE);
    if (mult && items.length) {
      const prev = items[items.length - 1];
      // « 2 X 0,99 » : 2 exemplaires du produit précédent (2 × 500 ml = 1 000 ml, 2 lots de 4 = 8).
      prev.quantity = (prev.quantity ?? 1) * Number(mult[1]);
      continue;
    }
    const weight = line.match(WEIGHT_LINE);
    if (weight && items.length) {
      const prev = items[items.length - 1];
      prev.quantity = Number(weight[1]);
      prev.unit = 'kg';
      continue;
    }

    const padded = ` ${line} `;
    if (SKIP.some((k) => padded.includes(` ${k}`) || line.startsWith(k.trim()))) { ignored++; continue; }

    const priced = line.match(PRICE_AT_END);
    // Sans prix, une ligne n'est un article que si elle est suivie de sa pesée ou de
    // son multiplicateur (sinon : en-tête, adresse, slogan…).
    const next = prepared[index + 1] ?? '';
    if (!priced && !WEIGHT_LINE.test(next) && !MULTIPLIER_LINE.test(next)) { ignored++; continue; }
    const label = priced ? priced[1] : line;
    if (priced && priced[2].startsWith('-')) { ignored++; continue; }            // remise
    if ((label.match(/[A-Z]/g) ?? []).length < 3) { ignored++; continue; }       // pas un libellé
    if (NON_FOOD.some((k) => ` ${label} `.includes(` ${k.trim()}`))) { ignored++; continue; }

    const name = cleanName(label);
    if (name.length < 3) { ignored++; continue; }
    const { quantity, unit } = readQuantity(label);
    const category = guessCategory(name);

    // Doublon (même produit acheté deux fois) : on additionne les unités.
    const twin = items.find((i) => i.name.toLowerCase() === name.toLowerCase() && i.unit === unit);
    if (twin) {
      twin.quantity = twin.quantity !== null && quantity !== null ? twin.quantity + quantity : (twin.quantity ?? 1) + 1;
      continue;
    }
    items.push({
      name, quantity, unit, category,
      confidence: priced && category !== 'other' && name.length >= 4 ? 'high' : 'low',
      source: raw.trim(),
    });
  }
  return { items: items.slice(0, 80), ignored };
}
