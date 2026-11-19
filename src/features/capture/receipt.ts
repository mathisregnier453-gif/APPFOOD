// Ticket de caisse -> produits (module pur, testé). Analyse 100 % locale et gratuite.
// Règle : on n'invente rien. Pas de date (un ticket n'en contient pas pour les
// produits) ; une quantité n'est proposée que si elle est écrite sur le ticket.
import { defaultStorageFor, guessCategory } from '../planning/shopping.ts';
import { BRANDS, fixOcrWord, GENERIC_ENTRIES, matchLexicon, storageHint } from './lexicon.ts';
import type { CategoryId, FoodUnit, StorageKind } from '@/lib/types';

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
  /** rangement proposé : habitudes du produit, ou indice écrit sur le ticket (SURG, UHT…) */
  storage: StorageKind;
  /** high : libellé + prix lus clairement ; low : à vérifier par l'utilisateur */
  confidence: 'high' | 'low';
  source: string;
}

const SKIP = [
  'TOTAL', 'SOUS-TOTAL', 'SOUS TOTAL', 'TVA', 'CARTE', 'CB ', 'ESPECES', 'RENDU', 'MONNAIE', 'REMISE', 'PROMO',
  'BON ', 'FIDELITE', 'POINTS', 'MERCI', 'TICKET', 'CAISSE', 'SIRET', 'TEL ', 'TEL.', 'MAGASIN', 'A REPORTER', 'A RENDRE', 'RENDRE', 'NOMBRE', 'ARTICLES', 'LIGNES', 'ELIGIBLE', 'TRD', 'RABAIS', 'REM ', 'EMV', 'ESPECES',
  'ARTICLE', 'PAIEMENT', 'DATE', 'HEURE', 'CAISSIER', 'HOTESSE', 'AVOIR', 'ECONOMIE', 'CAGNOTTE', 'SANS CONTACT',
  'NET A PAYER', 'A PAYER', 'REGLEMENT', 'CONSIGNE', 'MONTANT', 'HT ', 'TTC', 'CHEQUE', 'VISA', 'MASTERCARD', 'WWW', 'HTTP',
];

const NON_FOOD = ['SAC ', 'SACS', 'SOPALIN', 'ALU ', 'ALUMINIUM', 'FILM ', 'SAVON', 'COTON', 'RASOIR', 'BRIQUET', 'CHARBON', 'AMPOULE',
  'CROQ CHAT', 'CROQUETTES CHAT', 'CROQUETTES CHIEN', 'PATEE', 'CHAT ', 'CHIEN ', 'LINGETTE', 'SERVIETTE', 'PAPIER', 'BOUGIE', 'ADOUCISSANT',
  'LAIT CORPS', 'LAIT DEMAQ', 'CREME MAINS', 'CREME VISAGE', 'DEODORANT', 'TAMPON', 'PROTEGE', 'BROSSE', 'VAISSELLE', 'POUBELLE', 'LESSIVE', 'PAPIER TOIL', 'ESSUIE', 'SHAMP', 'DENTIF', 'EPONGE', 'PILES', 'LITIERE', 'COUCHES', 'MOUCHOIR', 'DEO ', 'GEL DOUCHE', 'LIQ VAISS', 'NETTOY', 'JAVEL', 'ASSOUP'];

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
  PATES: 'pâtes', RIZ: 'riz', FARIN: 'farine', SUC: 'sucre', HUIL: 'huile', VINAIG: 'vinaigre',
};

function normalize(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

const PRICE_AT_END = /^(.*?)\s+(-?\d{1,4}[.,]\d{2})\s*(?:€|EUR|E)?\s*(?:[A-D0-9]{1,2}|\*)?$/;
const MULTIPLIER_LINE = /^(\d{1,3})\s*[X*]\s*\d{1,4}[.,]\d{2}/;
const WEIGHT_LINE = /^(\d{1,3}[.,]\d{1,3})\s*KG\s*[X*]/;
const PACK = /(?:^|\s)U?X\s?(\d{1,2})(?=\s|$)|(?:^|\s)(\d{1,2})\s?X(?=\s|\d|$)/;
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
  // « 400G+200G OFFERTS » : contenance totale.
  const bonus = name.match(/(\d{1,4})\s?(G|ML)\s?\+\s?(\d{1,4})\s?(G|ML)(?=\s|\.|$)/);
  if (bonus && bonus[2] === bonus[4]) return { quantity: Number(bonus[1]) + Number(bonus[3]), unit: bonus[2] === 'G' ? 'g' : 'ml' };
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

// Rayons imprimés en titre sur certains tickets (Super U : « >>>> ULTRA FRAIS »).
const SECTION_LINE = /^[>»›]{2,}\s*(.+)$/;
const NON_FOOD_SECTIONS = ['LINGE', 'COTON', 'TABLE', 'CUISINE', 'HYGIENE', 'BEAUTE', 'ENTRETIEN', 'DROGUERIE', 'PARFUMERIE', 'BAZAR',
  'TEXTILE', 'PAPETERIE', 'ANIMAUX', 'ANIMALERIE', 'MAISON', 'JARDIN', 'BRICOLAGE', 'MULTIMEDIA', 'JOUET', 'LIBRAIRIE', 'BEBE HYG', 'NON ALIMENTAIRE'];
const SECTION_STORAGE: [string, StorageKind][] = [
  ['SURGEL', 'freezer'], ['GLACE', 'freezer'], ['ULTRA FRAIS', 'fridge'], ['CREMERIE', 'fridge'], ['FROMAGE', 'fridge'], ['CHARCUTERIE', 'fridge'],
  ['BOUCH', 'fridge'], ['VOLAILLE', 'fridge'], ['POISSON', 'fridge'], ['MAREE', 'fridge'], ['TRAITEUR', 'fridge'], ['BEURRE', 'fridge'], ['OEUF', 'fridge'],
  ['EPICERIE', 'pantry'], ['PATES', 'pantry'], ['CONSERVE', 'pantry'], ['BOULANGERIE', 'pantry'], ['VIENNOISERIE', 'pantry'], ['BOISSON', 'pantry'],
  ['PATISSERIE', 'pantry'], ['PETIT DEJEUNER', 'pantry'], ['BISCUIT', 'pantry'], ['CONFISERIE', 'pantry'], ['SAUCES', 'pantry'], ['LIQUIDE', 'pantry'],
];
// Prix unitaire × quantité écrit sur la ligne (Carrefour « 0,20x2 », Lidl « 0,95 x 2 »).
const INLINE_MULT = /\s(\d{1,4}\.\d{2})\s?(?:€|EUR)?\s?[X×*]\s?(\d{1,3})$/;

function expandName(label: string): string {
  // Libellé non reconnu : on garde les mots du ticket, sans marques ni codes.
  return cleanName(label.split(/\s+/).filter((w) => !BRANDS.has(w)).join(' '));
}

export function parseReceipt(rows: string[]): { items: ReceiptItem[]; ignored: number } {
  const items: ReceiptItem[] = [];
  let ignored = 0;
  let section: { skip: boolean; storage: StorageKind | null } = { skip: false, storage: null };
  // Le dernier article créé, s'il vient de la ligne précédente (multiplicateur / pesée).
  let lastItem: ReceiptItem | null = null;

  const prepared = rows.map((r) => normalize(r)
    .replace(/\b[O0](?=[.,]\d{2}\b)/g, '0')            // « O,99 » lu à la place de « 0,99 »
    .replace(/(\d)\s?[,.]\s?(\d{2})(?!\d)/g, '$1.$2')  // « 1, 99 » -> « 1.99 »
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(' ').map(fixOcrWord).join(' '));
  for (const [index, rawLine] of prepared.entries()) {
    const raw = rows[index];
    if (!rawLine) continue;
    const previousItem = lastItem;
    lastItem = null;

    const sectionMatch = rawLine.match(SECTION_LINE);
    if (sectionMatch) {
      const name = sectionMatch[1];
      section = {
        skip: NON_FOOD_SECTIONS.some((k) => name.includes(k)),
        storage: SECTION_STORAGE.find(([k]) => name.includes(k))?.[1] ?? null,
      };
      ignored++;
      continue;
    }

    // Ligne de multiplicateur / de poids : s'applique à l'article de la ligne juste au-dessus.
    const mult = rawLine.match(MULTIPLIER_LINE);
    if (mult) {
      // « 2 X 0,99 » : 2 exemplaires (2 × 500 ml = 1 000 ml, 2 lots de 4 = 8).
      if (previousItem) previousItem.quantity = (previousItem.quantity ?? 1) * Number(mult[1]);
      continue;
    }
    const weight = rawLine.match(WEIGHT_LINE);
    if (weight) {
      if (previousItem) { previousItem.quantity = Number(weight[1]); previousItem.unit = 'kg'; }
      continue;
    }

    // Code TVA en tête de ligne (Carrefour : « 4 CRISTALINE 1.5L »).
    const line = rawLine.replace(/^\d\s+(?=[A-Z*])/, '').replace(/^\*+\s*/, '');
    const padded = ` ${line} `;
    if (SKIP.some((k) => padded.includes(` ${k}`) || line.startsWith(k.trim()))) { ignored++; continue; }

    const priced = line.match(PRICE_AT_END);
    // Sans prix, une ligne n'est un article que si elle est suivie de sa pesée ou de
    // son multiplicateur (sinon : en-tête, adresse, slogan…).
    const next = prepared[index + 1] ?? '';
    if (!priced && !WEIGHT_LINE.test(next) && !MULTIPLIER_LINE.test(next)) { ignored++; continue; }
    if (priced && priced[2].startsWith('-')) { ignored++; continue; }            // remise
    let label = priced ? priced[1] : line;
    let count = 1;
    const inline = label.match(INLINE_MULT);
    if (inline) { count = Number(inline[2]) || 1; label = label.slice(0, inline.index).trim(); }
    if ((label.match(/[A-Z]/g) ?? []).length < 3) { ignored++; continue; }       // pas un libellé
    if (section.skip || NON_FOOD.some((k) => ` ${label} `.includes(` ${k.trim()}`))) { ignored++; continue; }

    // Produit connu du lexique : catégorie et rangement fiables. Le nom du lexique
    // n'est repris que si c'est bien le produit (« BOULETTES au boeuf » ≠ « Boeuf »).
    const known = matchLexicon(label);
    const name = known?.coversHead && !GENERIC_ENTRIES.has(known.entry.name) ? known.entry.name : expandName(label);
    if (name.length < 3) { ignored++; continue; }
    const read = readQuantity(label);
    const quantity = read.quantity !== null ? read.quantity * count : count > 1 ? count : null;
    const unit = read.unit;
    const category = known ? known.entry.category : guessCategory(name);
    const storage = storageHint(label) ?? (known ? known.entry.storage : section.storage ?? defaultStorageFor(category));

    // Doublon (même produit acheté deux fois) : on additionne les unités.
    const twin = items.find((i) => i.name.toLowerCase() === name.toLowerCase() && i.unit === unit);
    if (twin) {
      twin.quantity = twin.quantity !== null && quantity !== null ? twin.quantity + quantity : (twin.quantity ?? 1) + (quantity ?? 1);
      lastItem = twin;
      continue;
    }
    const item: ReceiptItem = {
      name, quantity, unit, category, storage,
      // Sûr seulement si le produit est reconnu ET que son prix a été lu.
      confidence: known?.coversHead && (priced || WEIGHT_LINE.test(next) || MULTIPLIER_LINE.test(next)) ? 'high' : 'low',
      source: raw.trim(),
    };
    items.push(item);
    lastItem = item;
  }
  return { items: items.slice(0, 80), ignored };
}
