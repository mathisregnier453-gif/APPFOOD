import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReceipt } from '../src/features/capture/receipt.ts';

// Transcriptions de vrais tickets (photos fournies par l'équipe), lignes telles que
// l'OCR les restitue après regroupement libellé + prix.
const show = (rows: string[]) => parseReceipt(rows).items.map((i) => `${i.name} | ${i.quantity ?? '-'} ${i.unit} | ${i.storage} | ${i.confidence}`);

test('Intermarché : quantité sur la ligne suivante, « EUR A », totaux ignorés', () => {
  const r = show([
    'Intermarché', 'ROUTE DE LANVOLLON', '22200 ST AGATHON', 'TEL : 02 96 44 99 33',
    '*TWIX XL X12 600G', '3 X 3.20 EUR       9.60 EUR A', 'KIWI BARQUETTE 1 KG    3,99 EUR A',
    'BAGUETTE 340G CRUE/2   0,35 EUR A', 'PAT FRUTIMAX PANACH    2,35 EUR A', 'MONTANT DU   16,29 EUR',
    'FRUITS ET LEGUMES      3,49 EUR A', 'MONTANT DU   19,78 EUR', 'CB EMV       19.78 EUR', "Nombre d'articles vendus= 7",
    'TOTAL ELIGIBLE TRD     10.18 EUR', 'A RENDRE    0.00 EUR', 'ESPECES   0.00 EUR', 'CODE TVA  MT. HT  MT. TVA  MT. TTC', '18.75  1.03  19.78',
  ]);
  assert.deepEqual(r, [
    'Twix xl | 36 piece | pantry | high',
    'Kiwis | 1 kg | pantry | high',
    'Pain | 340 g | pantry | high',
    'Pat frutimax panach | - piece | pantry | high',
    'Fruits et legumes | - piece | pantry | low',
  ]);
});

test('Carrefour : code TVA en tête, « 0,20x2 », non alimentaire et monnaie ignorés', () => {
  const r = show([
    'Bienvenue chez', 'Carrefour', '*** MONACO BIENVENUE ***', 'TEL 377.92.05.57.00', 'Du lundi au samedi de 8h00 à 21h00',
    'DESIGNATION   P.U x QTE   MONTANT', '4 CRISTALINE 1.5L   0,20x2   0,40', '4 MON CHERI CERISE T   7,25', '4 262G MON CHERI CER   7,65',
    '4 575G ASS PRESTIGE   15,49', 'Total Alimentaire   30,79', '6 SAC TOILE DE JUTE   4,90', 'Total Non Alimentaire   4,90',
    '6 ARTICLES   TOTAL A PAYER   35,69', '€ Espèces   50,00', '€ A RENDRE   14,31-', 'TVA 4: 5,50% €   29,18   1,61', 'TVA 6:20,00% €   4,08   0,82',
    '==== TOTAL TVA   €   2,42', '13.12.2023 13:14 0087 06 0132 220', 'MERCI A VOUS TOUS !',
  ]);
  assert.deepEqual(r, [
    'Eau | 3 l | pantry | high',
    'Mon cheri cerise t | - piece | pantry | high',
    'Mon cheri cer | 262 g | pantry | high',
    'Ass prestige | 575 g | pantry | high',
  ]);
});

test('Lidl : « P.U x Qté », rabais négatifs, non alimentaire', () => {
  const r = show([
    'Ticket de vente', 'LIDL', 'Article   P.U.EUR   Qté   EUR', 'Boulettes au boeuf V   6,49 x 1   6,49 A', 'Rabais 30%   -1,95',
    'Viande hachée 350g   5,39 x 1   5,39 A', 'Rabais 30%   -1,62', 'Pain de campagne   2,35 x 2   4,70 A', 'Rem Pain de campagne   -1,41',
    'Lait demi-écrémé   0,95 x 2   1,90 A', 'Nettoyant jaune   1,77 x 1   1,77 B', 'Concombre   0,79 x 1   0,79 A', 'Tortilla wraps XXL   2,59 x 1   2,59 A',
    'Pavé rustique   1,69 x 1   1,69 A', 'Nombre de lignes: 8', 'A payer   20,34', 'Carte   20,34', 'Total Promotion   4,98',
    'A   5,5%   18,57   0,97   17,60', 'B   20%   1,77   0,30   1,47',
  ]);
  assert.deepEqual(r, [
    'Boulettes de viande | - piece | fridge | high',
    'Viande hachée | 350 g | fridge | high',
    'Pain de campagne | 2 piece | pantry | high',
    'Lait demi-écrémé | 2 piece | pantry | high',
    'Concombre | - piece | fridge | high',
    'Tortillas | - piece | pantry | high',
    'Pain | - piece | pantry | high',
  ]);
});

test('Super U : rayons non alimentaires ignorés, rayons et abréviations', () => {
  const r = show([
    'SUPER U', 'SAS LERMAC', 'C.C. DES JARDINS DE LA BRETONNIERE', 'CHATEAUBOURG', 'Telephone : 0299003063', 'SIRET 39927128700027 - NAF 4711F',
    '>>>> LINGE DE MAISON', 'PROT.M 160X200CM U.MAI BLANC   22,90 € 13', 'PROT.MAT.140X190 UMAI BLANC   18,90 € 13', 'PROT.OREILLER 65X65 U.MAI BLC',
    '2 x   4,13 €   8,26 € 13', '>>>> VIENNOISERIE', 'BRIOCHE TRES.PB 400G+200G OFF.   2,80 € 11', '>>>> VIENNOISERIE INDUSTRIEL',
    'PAIN AU LAIT PASQUIER X20   2,35 € 11', '>>>> POISSON LS UVCI', 'F.LIMAND.MEUNIER.U 3+1 OF.400G   4,40 € 11', '>>>> SAUCES CHAUDES',
    'SCE TOMATE PROVENC.BIO JB 200G', '2 x   1,24 €   2,48 € 11', '>>>> TRAITEUR LS UVCI', 'GNOCCHI A POELER LUSTUCRU 515G   2,31 € 11',
    '>>>> FRUITS', 'BANANE CAVENDISH   1,84 € 11', '>>>> COTON', 'COTON TIGE BIO LOTUS ST X240   1,33 € 13', '>>>> CHARCUTERIE FRAICH EMBA',
    'JAMBON SUP DD VPF U 4TR   3,72 € 11', '>>>> BOUCH.LS (UVCI)', 'SH MAXI TDRE 5% MAT.GR BIO UX2   5,00 € 11', '>>>> PAIN DE MIE (LS)',
    'PAIN MIE BIO CPLT BOULANG.500G   1,83 € 11', '>>>> AIDE PATISSERIE', 'SUCRE VANILLE ALSA ST X12 90G   1,95 € 11', '>>>> PATES',
    'ORECCHIETTE ACADE.BARILLA 500G   1,59 € 11', '>>>> BEURRE', 'BEUR.MOUL.82% DX P.BRETON 250G   2,31 € 11', '>>>> ULTRA FRAIS',
    'VELOUTE FRUIX PANACHE X16   3,55 € 11', '>>>> LA TABLE', 'MUG ENJOY 35CL DECORS ASS.   2,69 € 13', 'MUG 340ML SLOW   2,10 € 13',
    'MUG GRE 30CL ROMANSK BEI   1,99 € 13', '>>>> LA CUISINE', 'SPATULE U MAI.TETE SILICONE   3,39 € 13', 'Durée de garantie : 24 mois',
    '>>>> BOULANGERIE', 'BAGUETTE MAIS TOURNESOL   0,90 € 11', 'BAGUETTE 250G', '3 x   0,42 €', '1,25 € 11',
    'TOTAL   27 Article(s)   99,95 €', 'CARTE BANCAIRE   99,95 €', 'TOTAL TVA   87,69 €   12,26 €   99,95 €',
  ]);
  assert.deepEqual(r, [
    'Brioche | 600 g | pantry | high',
    'Pains au lait | 20 piece | pantry | high',
    'Limande | 400 g | fridge | high',
    'Sauce tomate | 400 g | pantry | high',
    'Pâtes fraîches | 515 g | fridge | high',
    'Bananes | - piece | pantry | high',
    'Jambon blanc | - piece | fridge | high',
    'Steaks hachés | 2 piece | fridge | high',
    'Pain de mie | 500 g | pantry | high',
    'Sucre vanillé | 12 piece | pantry | high',
    'Pâtes | 500 g | pantry | high',
    'Beurre doux | 250 g | fridge | high',
    'Yaourts aux fruits | 16 piece | fridge | high',
    'Pain | - piece | pantry | high',
    'Pain | 750 g | pantry | high',
  ]);
});
