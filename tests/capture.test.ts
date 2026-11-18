import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addScannedBarcode, captureStats, makeDraft } from '../src/features/capture/drafts.ts';
import { extractExpiry } from '../src/features/capture/expiryOcr.ts';
import { ocrRows, parseReceipt } from '../src/features/capture/receipt.ts';

// Ticket type grande surface (libellés abrégés, prix à droite, lignes de service).
const TICKET = [
  'CARREFOUR MARKET',
  'TEL 01 23 45 67 89',
  'YAO NAT X4            1,89 A',
  'LAIT DEMI ECR 1L      0,99 A',
  '2 X 0,99',
  'STK HACHE 5% 2X125G   4,25 A',
  'TOMATES GRAPPE',
  '0,856 KG X 2,99 €/KG  2,56 A',
  'REMISE FIDELITE      -0,50',
  'SAC CABAS            0,15 B',
  'EMMENT RAPE 200G      2,15 A',
  'YAO NAT X4            1,89 A',
  'TOTAL                14,38',
  'CB                   14,38',
  'TVA 5,5%              0,66',
  'MERCI DE VOTRE VISITE',
];

test('ticket : produits extraits, lignes de service ignorées', () => {
  const { items, ignored } = parseReceipt(TICKET);
  const names = items.map((i) => i.name);
  assert.deepEqual(names, ['Yaourt nature', 'Lait demi écrémé', 'Steak haché', 'Tomates grappe', 'Emmental rape']);
  assert.ok(ignored >= 6, 'total, CB, TVA, remise, sac, en-tête ignorés');
});

test('ticket : quantités lues sur le ticket uniquement', () => {
  const { items } = parseReceipt(TICKET);
  const by = Object.fromEntries(items.map((i) => [i.name, i]));
  assert.deepEqual([by['Yaourt nature'].quantity, by['Yaourt nature'].unit], [8, 'piece'], '2 lots de 4');
  assert.deepEqual([by['Lait demi écrémé'].quantity, by['Lait demi écrémé'].unit], [2, 'l'], '« 2 X 0,99 » sous une bouteille de 1 L');
  const jus = parseReceipt(['JUS ORA 50CL  1,20 A', '3 X 1,20']).items[0];
  assert.deepEqual([jus.quantity, jus.unit], [1500, 'ml'], '3 × 50 cl');
  assert.deepEqual([by['Steak haché'].quantity, by['Steak haché'].unit], [2, 'piece']);
  assert.deepEqual([by['Tomates grappe'].quantity, by['Tomates grappe'].unit], [0.856, 'kg'], 'ligne de pesée');
  assert.deepEqual([by['Emmental rape'].quantity, by['Emmental rape'].unit], [200, 'g']);
});

test('ticket : catégories et confiance', () => {
  const { items } = parseReceipt(TICKET);
  const by = Object.fromEntries(items.map((i) => [i.name, i]));
  assert.equal(by['Yaourt nature'].category, 'dairy');
  assert.equal(by['Tomates grappe'].category, 'vegetables');
  assert.equal(by['Tomates grappe'].confidence, 'low', 'pas de prix sur la ligne => à vérifier');
});

test('ticket : aucun produit inventé sur un texte sans articles', () => {
  assert.equal(parseReceipt(['TOTAL 12,00', 'CB 12,00', '12/11/2026 18:42', '*****']).items.length, 0);
  assert.equal(parseReceipt([]).items.length, 0);
});

test('OCR : libellé et prix séparés regroupés par ligne', () => {
  const rows = ocrRows([
    { text: 'LAIT DEMI ECR 1L', frame: { top: 100, left: 10, height: 20, width: 200 } },
    { text: '0,99 A', frame: { top: 103, left: 300, height: 20, width: 60 } },
    { text: 'BEURRE DOUX 250G', frame: { top: 130, left: 10, height: 20, width: 200 } },
    { text: '2,35 A', frame: { top: 128, left: 300, height: 20, width: 60 } },
  ]);
  assert.deepEqual(rows, ['LAIT DEMI ECR 1L  0,99 A', 'BEURRE DOUX 250G  2,35 A']);
});

test('date : DLC et DDM reconnues', () => {
  const today = '2026-11-18';
  assert.deepEqual(extractExpiry('A consommer jusqu\'au 24/11/2026', today), { date: '2026-11-24', kind: 'dlc' });
  assert.deepEqual(extractExpiry('À consommer de préférence avant le 12.03.27  LOT 4521', today), { date: '2027-03-12', kind: 'ddm' });
  assert.deepEqual(extractExpiry('A consommer de preference avant fin 03/2027', today), { date: '2027-03-31', kind: 'ddm' });
  assert.deepEqual(extractExpiry('DLC 2O/11/26', today), { date: '2026-11-20', kind: 'dlc' }, 'O lu à la place de 0');
});

test('date : fabrication ignorée, ambiguïté => rien', () => {
  const today = '2026-11-18';
  assert.deepEqual(extractExpiry('EMB 01/11/2026  A consommer jusqu\'au 25/11/2026', today), { date: '2026-11-25', kind: 'dlc' });
  assert.equal(extractExpiry('12/12/2026 15/01/2027', today), null, 'deux dates sans mention : on demande');
  assert.equal(extractExpiry('Ingrédients : lait, ferments', today), null);
  assert.equal(extractExpiry('31/02/2027', today), null, 'date impossible');
  assert.equal(extractExpiry('01/01/1999', today), null, 'date implausible');
});

test('codes-barres : rafale, +1 sur un produit déjà scanné, inconnu à compléter', () => {
  let drafts = addScannedBarcode([], { barcode: '3017620422003', name: 'Pâte à tartiner', category: 'other', quantity: 400, unit: 'g', found: true });
  drafts = addScannedBarcode(drafts, { barcode: '3017620422003', name: 'Pâte à tartiner', category: 'other', quantity: 400, unit: 'g', found: true });
  drafts = addScannedBarcode(drafts, { barcode: '1234567890128', name: null, category: null, quantity: null, unit: null, found: false });
  assert.equal(drafts.length, 2);
  assert.equal(drafts.find((d) => d.barcode === '3017620422003')!.quantity, 2);
  const unknown = drafts.find((d) => d.barcode === '1234567890128')!;
  assert.equal(unknown.name, '', 'jamais de nom inventé');
  assert.equal(unknown.needsReview, true);
});

test('mesure des corrections', () => {
  const a = makeDraft({ name: 'Yaourt nature', category: 'dairy', quantity: 4, unit: 'piece' });
  const b = makeDraft({ name: 'Emmental rape', category: 'cheese', quantity: 200, unit: 'g' });
  const c = makeDraft({ name: 'Sac', category: 'other', quantity: null, unit: 'piece' });
  const stats = captureStats([a, b, c], [a, { ...b, name: 'Emmental râpé' }]);
  assert.deepEqual(stats, { detected: 3, confirmed: 2, corrected: 1, removed: 1 });
});

import { parseAuthRedirect } from '../src/features/auth/redirect.ts';

test('lien de confirmation : jetons, code PKCE, lien expiré, lien ordinaire', () => {
  assert.deepEqual(parseAuthRedirect('sauge://#access_token=aaa&expires_in=3600&refresh_token=bbb&type=signup'), { kind: 'tokens', accessToken: 'aaa', refreshToken: 'bbb' });
  assert.deepEqual(parseAuthRedirect('sauge://?code=xyz'), { kind: 'code', code: 'xyz' });
  assert.deepEqual(parseAuthRedirect('sauge://#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'), { kind: 'error', message: 'Email link is invalid or has expired' });
  assert.deepEqual(parseAuthRedirect('sauge://stock'), { kind: 'none' });
  assert.deepEqual(parseAuthRedirect(null), { kind: 'none' });
});
