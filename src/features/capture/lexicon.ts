// Lexique des produits courants des tickets de caisse français (module pur, testé).
// Chaque entrée : nom propre affiché | formes rencontrées sur les tickets (abrégées,
// tronquées) | catégorie | rangement habituel. Les mots d'une forme doivent tous
// être présents dans le libellé (un mot du ticket peut être tronqué ou plus long).
import type { CategoryId, StorageKind } from '@/lib/types';

const F = 'fridge', Z = 'freezer', P = 'pantry';

const RAW = `
Lait demi-écrémé|LAIT 1/2 ECR;LAIT DEMI ECR;LAIT DEMI;LAIT 1/2;LT DEMI;LT 1/2;DEMI ECR;1/2 ECR|dairy|P
Lait entier|LAIT ENTIER;LT ENT;LAIT ENT|dairy|P
Lait écrémé|LAIT ECR;LT ECR|dairy|P
Lait|LAIT;LT|dairy|P
Lait frais|LAIT FRAIS;LAIT FRAIS ENTIER;LAIT FRAIS DEMI;LAIT FRAIS 1/2;LAIT MICROFILT|dairy|F
Lait de coco|LAIT COCO;LT COCO;CREME COCO|canned|P
Boisson végétale|BOISSON AVOINE;BOISSON SOJA;BOISSON AMANDE;BOISS VEG;LAIT SOJA;LAIT AMANDE;LAIT AVOINE|drinks|P
Yaourts nature|YAOURT NAT;YAO NAT;YAOURTS NAT;YT NAT|dairy|F
Yaourts aux fruits|YAOURT FRUIT;YAO FRUIT;YAO AUX FRUITS|dairy|F
Yaourts|YAOURT;YAO;YOGOURT;YOG|dairy|F
Skyr|SKYR|dairy|F
Fromage blanc|FROMAGE BLANC;FROM BLANC;FRO BLANC;FR BLANC;FROMAGE BL|dairy|F
Petits-suisses|PETIT SUISSE;PETITS SUISSES;PT SUISSE|dairy|F
Crème dessert|CREME DESSERT;CR DESSERT;LIEGEOIS;FLAN|dairy|F
Compote|COMPOTE;COMPOT;POM POTES;GOURDE|canned|P
Crème fraîche|CREME FRAICHE;CR FRAICHE;CREME EPAISSE;CR EPAISSE;CRM FRAICHE;FRAICHE EPAISSE|dairy|F
Crème liquide|CREME LIQUIDE;CR LIQ;CREME LIQ;CREME ENTIERE LIQ|dairy|F
Crème|CREME;CRM|dairy|F
Beurre doux|BEURRE DOUX;BEUR DOUX;BRE DOUX|dairy|F
Beurre demi-sel|BEURRE DEMI SEL;BEURRE 1/2 SEL;BEUR 1/2 SEL;BEURRE DS|dairy|F
Beurre|BEURRE;BEUR|dairy|F
Margarine|MARGARINE;MARG|dairy|F
Oeufs|OEUF;OEUFS;OEUFS PA;OEUFS PLEIN AIR;OEUF BIO;DOUZAINE OEUF|fresh|F
Emmental râpé|EMMENTAL RAPE;EMMENT RAPE;EMM RAPE;RAPE EMMENTAL|cheese|F
Fromage râpé|FROMAGE RAPE;FROM RAPE;RAPE;GRUYERE RAPE|cheese|F
Emmental|EMMENTAL;EMMENT;EMM|cheese|F
Comté|COMTE|cheese|F
Camembert|CAMEMBERT;CAMEMB;CAMEM|cheese|F
Brie|BRIE|cheese|F
Mozzarella|MOZZARELLA;MOZZA;MOZZ|cheese|F
Parmesan|PARMESAN;PARMIG;GRANA PADANO|cheese|F
Tomme|TOMME|cheese|F
Fromage de chèvre|CHEVRE;BUCHE CHEVRE;CROTTIN|cheese|F
Feta|FETA|cheese|F
Raclette|RACLETTE|cheese|F
Reblochon|REBLOCHON;REBLOCH|cheese|F
Roquefort|ROQUEFORT|cheese|F
Fromage frais|FROMAGE FRAIS;FROM FRAIS;CARRE FRAIS;ST MORET;SAINT MORET;PHILADELPHIA;KIRI;BOURSIN;RICOTTA;MASCARPONE|cheese|F
Fromage|FROMAGE;FROM;FRO|cheese|F
Jambon blanc|JAMBON BLANC;JBN BLC;JAMB BLANC;JAMBON SUP;JBN SUP;JAMBON DD;JAMB SUP;JBN|meat|F
Jambon cru|JAMBON CRU;JBN CRU;JAMB CRU;JAMBON SEC;JAMBON SERRANO;JAMBON BAYONNE|meat|F
Jambon|JAMBON;JAMB|meat|F
Lardons|LARDON;LARDONS;LARD FUME;ALLUMETTES|meat|F
Bacon|BACON|meat|F
Pâté|PATE CAMPAGNE;PATE DE CAMPAGNE;PATE FOIE;PATE HENAFF;TERRINE;RILLETTES;MOUSSE CANARD|meat|F
Saucisson|SAUCISSON;SAUCIS SEC;ROSETTE|meat|F
Chorizo|CHORIZO|meat|F
Saucisses|SAUCISSE;SAUCISSES;KNACKI;KNACK;CHIPOLATA;CHIPO;MERGUEZ;STRASBOURG;TOULOUSE;FRANCFORT|meat|F
Blancs de poulet|BLANC POULET;BLC POULET;FILET POULET;FIL POULET;ESCALOPE POULET;ESC POULET;BLC PLT;FILET PLT;AIGUILLETTE POULET;AIGUIL POULET|meat|F
Cuisses de poulet|CUISSE POULET;CUISSES POULET;PILON;HAUT CUISSE;CUISSE PLT|meat|F
Poulet entier|POULET ENTIER;POULET PAC;POULET FERMIER;POULET LR;POULET LABEL|meat|F
Poulet|POULET;PLT|meat|F
Dinde|DINDE;ESCALOPE DINDE;ESC DINDE;FILET DINDE|meat|F
Steaks hachés|STEAK HACHE;STK HACHE;STEAKS HACHES;STK HACH;HACHE 5;HACHE 15;HACHE 20;FACON BOUCHERE|meat|F
Viande hachée|VIANDE HACHEE;VDE HACHEE;HACHE BOEUF;BOEUF HACHE|meat|F
Boeuf|BOEUF;ROTI BOEUF;BAVETTE;ENTRECOTE;FAUX FILET;RUMSTECK;BOURGUIGNON;PAVE BOEUF;STEAK;STK|meat|F
Porc|PORC;ROTI PORC;ECHINE;COTE PORC;COTES PORC;FILET MIGNON;SAUTE PORC|meat|F
Veau|VEAU;ESCALOPE VEAU;BLANQUETTE|meat|F
Agneau|AGNEAU;GIGOT;COTELETTE|meat|F
Chair à saucisse|CHAIR SAUCISSE;CHAIR A SAUC|meat|F
Saumon fumé|SAUMON FUME;SAUM FUME;SAUMON FUM|fish|F
Pavés de saumon|PAVE SAUMON;PAVES SAUMON;SAUMON PAVE;FILET SAUMON;PAV SAUM|fish|F
Saumon|SAUMON;SAUM|fish|F
Cabillaud|CABILLAUD;CABILL;CAB|fish|F
Colin|COLIN;MERLU;LIEU|fish|F
Crevettes|CREVETTE;CREVETTES;CREV;GAMBAS|fish|F
Moules|MOULE;MOULES|fish|F
Surimi|SURIMI|fish|F
Thon en boîte|THON;THON NAT;THON ALBACORE;MIETTES THON|canned|P
Sardines|SARDINE;SARDINES|canned|P
Maquereaux|MAQUEREAU;MAQUEREAUX;MAQ|canned|P
Pommes|POMME;POMMES;POM GALA;GOLDEN;GALA;GRANNY;PINK LADY;BRAEBURN;JAZZ|fruits|P
Poires|POIRE;POIRES;CONFERENCE;WILLIAMS|fruits|P
Bananes|BANANE;BANANES;BAN|fruits|P
Oranges|ORANGE;ORANGES|fruits|P
Clémentines|CLEMENTINE;CLEMENTINES;MANDARINE;CLEMEN|fruits|P
Citrons|CITRON;CITRONS;CITRON VERT|fruits|P
Pamplemousse|PAMPLEMOUSSE;PAMPLE|fruits|P
Kiwis|KIWI;KIWIS|fruits|P
Raisin|RAISIN;RAISINS|fruits|F
Fraises|FRAISE;FRAISES|fruits|F
Framboises|FRAMBOISE;FRAMBOISES|fruits|F
Myrtilles|MYRTILLE;MYRTILLES|fruits|F
Cerises|CERISE;CERISES|fruits|F
Pêches|PECHE;PECHES;NECTARINE;BRUGNON|fruits|P
Abricots|ABRICOT;ABRICOTS|fruits|P
Prunes|PRUNE;PRUNES;MIRABELLE|fruits|P
Melon|MELON|fruits|P
Pastèque|PASTEQUE|fruits|P
Ananas|ANANAS|fruits|P
Mangue|MANGUE|fruits|P
Avocats|AVOCAT;AVOCATS|fruits|P
Pommes de terre|POMME DE TERRE;POMMES DE TERRE;PDT;P D TERRE;PDTERRE;POM DE TERRE;PATATE|vegetables|P
Patates douces|PATATE DOUCE;PATATES DOUCES|vegetables|P
Oignons|OIGNON;OIGNONS;OIGN|vegetables|P
Échalotes|ECHALOTE;ECHALOTES;ECHAL|vegetables|P
Ail|AIL;TETE AIL|vegetables|P
Tomates cerises|TOMATE CERISE;TOMATES CERISES;TOM CERISE;CERISE TOM|vegetables|P
Tomates|TOMATE;TOMATES;TOM;TOMATES GRAPPE|vegetables|P
Carottes|CAROTTE;CAROTTES;CAROT|vegetables|F
Courgettes|COURGETTE;COURGETTES;COURG|vegetables|F
Aubergines|AUBERGINE;AUBERGINES;AUBERG|vegetables|F
Poivrons|POIVRON;POIVRONS;POIV|vegetables|F
Concombre|CONCOMBRE;CONCOMB|vegetables|F
Salade|SALADE;LAITUE;BATAVIA;FEUILLE CHENE;ICEBERG;ROMAINE;LAITUE ICEBERG|vegetables|F
Mâche|MACHE|vegetables|F
Roquette|ROQUETTE|vegetables|F
Jeunes pousses|JEUNES POUSSES;POUSSES EPINARD;MESCLUN|vegetables|F
Épinards|EPINARD;EPINARDS|vegetables|F
Brocoli|BROCOLI;BROCOLIS|vegetables|F
Chou-fleur|CHOU FLEUR;CHOUFLEUR|vegetables|F
Chou|CHOU;CHOU BLANC;CHOU ROUGE;CHOU VERT|vegetables|F
Poireaux|POIREAU;POIREAUX|vegetables|F
Champignons|CHAMPIGNON;CHAMPIGNONS;CHAMP;CHAMP PARIS|vegetables|F
Haricots verts|HARICOT VERT;HARICOTS VERTS;HAR VERT;HARICOTS VRT|vegetables|F
Endives|ENDIVE;ENDIVES;CHICON|vegetables|F
Radis|RADIS|vegetables|F
Céleri|CELERI|vegetables|F
Fenouil|FENOUIL|vegetables|F
Betteraves|BETTERAVE;BETTERAVES|vegetables|F
Potiron|POTIRON;POTIMARRON;BUTTERNUT;COURGE|vegetables|P
Herbes fraîches|PERSIL;CIBOULETTE;CORIANDRE;BASILIC;MENTHE;ANETH|vegetables|F
Gingembre|GINGEMBRE|vegetables|P
Pâtes|PATES;SPAGHETTI;SPAG;PENNE;COQUILLETTE;COQUILLETTES;TORTI;FUSILLI;TAGLIATELLE;TAGLIA;FARFALLE;MACARONI;LINGUINE;NOUILLES|starches|P
Pâtes fraîches|PATES FRAICHES;RAVIOLI;RAVIOLIS;TORTELLINI;GNOCCHI;GNOCCHIS|starches|F
Lasagnes (feuilles)|LASAGNE;LASAGNES|starches|P
Riz|RIZ;RIZ BASMATI;RIZ LONG;RIZ THAI;RIZ ROND|starches|P
Semoule|SEMOULE;COUSCOUS|starches|P
Quinoa|QUINOA;BOULGOUR;BOULGHOUR|starches|P
Lentilles|LENTILLE;LENTILLES;LENTILLES CORAIL|starches|P
Pois chiches|POIS CHICHE;POIS CHICHES;PS CHICHES|canned|P
Haricots rouges|HARICOT ROUGE;HARICOTS ROUGES;FLAGEOLET;HARICOTS BLANCS|canned|P
Farine|FARINE;FARIN|starches|P
Sucre|SUCRE;SUC;SUCRE POUDRE;CASSONADE|other|P
Levure|LEVURE|other|P
Pain|PAIN;BAGUETTE;BAG TRADITION;BAGUETTE TRADI;PAIN COMPLET;PAIN CAMPAGNE;BOULE|starches|P
Pain de mie|PAIN DE MIE;PAIN MIE;HARRYS;AMERICAN SANDWICH|starches|P
Biscottes|BISCOTTE;BISCOTTES|starches|P
Tortillas|TORTILLA;TORTILLAS;WRAP;WRAPS;FAJITAS|starches|P
Pâte brisée|PATE BRISEE;PATE FEUILLETEE;PATE SABLEE;PATE A TARTE;PATE FEUIL|fresh|F
Pâte à pizza|PATE A PIZZA;PATE PIZZA|fresh|F
Céréales|CEREALE;CEREALES;MUESLI;GRANOLA;CORN FLAKES;FLOCONS AVOINE;FLOCON AVOINE|starches|P
Biscuits|BISCUIT;BISCUITS;GATEAU;GATEAUX;COOKIES;MADELEINE;MADELEINES;GALETTE;PETIT BEURRE;BN|other|P
Chocolat|CHOCOLAT;CHOC;CHOCO;TABLETTE CHOC|other|P
Pâte à tartiner|PATE A TARTINER;NUTELLA;PATE TARTINER|other|P
Confiture|CONFITURE;CONF|other|P
Miel|MIEL|other|P
Café|CAFE;CAFE MOULU;CAPSULE;CAPSULES;DOSETTE;DOSETTES|drinks|P
Thé|THE;INFUSION;TISANE|drinks|P
Huile d'olive|HUILE OLIVE;HUILE D OLIVE;HLE OLIVE|other|P
Huile|HUILE;HLE;HUIL|other|P
Vinaigre|VINAIGRE;VINAIG|other|P
Moutarde|MOUTARDE;MOUT|canned|P
Mayonnaise|MAYONNAISE;MAYO|canned|F
Ketchup|KETCHUP|canned|P
Sauce tomate|SAUCE TOMATE;SCE TOMATE;COULIS;PULPE TOMATE;TOMATES CONCASSEES;PASSATA;CONCENTRE TOMATE|canned|P
Pesto|PESTO|canned|P
Sauce soja|SAUCE SOJA;SCE SOJA|canned|P
Bouillon|BOUILLON;KUB;CUBE|other|P
Épices|EPICE;EPICES;POIVRE;CURRY;PAPRIKA;CUMIN;HERBES PROVENCE|other|P
Sel|SEL;SEL FIN;GROS SEL|other|P
Maïs|MAIS|canned|P
Petits pois|PETITS POIS;PETIT POIS;PTS POIS|canned|P
Conserve de légumes|HARICOTS VERTS BTE;LEGUMES BTE;MACEDOINE;RATATOUILLE BTE|canned|P
Olives|OLIVE;OLIVES|canned|P
Cornichons|CORNICHON;CORNICHONS|canned|P
Houmous|HOUMOUS;HUMMUS|fresh|F
Tofu|TOFU|fresh|F
Pizza|PIZZA|fresh|F
Quiche|QUICHE|fresh|F
Plat préparé|PLAT CUISINE;PLAT PREPARE;HACHIS;PARMENTIER;LASAGNES BOLO;TABOULE;SALADE PIEMONTAISE|fresh|F
Sandwich|SANDWICH|fresh|F
Eau|EAU;EAU MIN;EAU GAZ;CRISTALINE;EVIAN;VITTEL;VOLVIC;BADOIT;PERRIER;SAN PELLEGRINO|drinks|P
Jus d'orange|JUS ORANGE;JUS ORA;JUS D ORANGE;PUR JUS ORANGE|drinks|P
Jus de fruits|JUS;PUR JUS;NECTAR|drinks|P
Sodas|SODA;COCA;COLA;OASIS;ORANGINA;SCHWEPPES;LIMONADE;ICE TEA;FANTA;SPRITE|drinks|P
Bière|BIERE;BIERES|drinks|P
Vin|VIN;VIN ROUGE;VIN BLANC;VIN ROSE;BORDEAUX;COTES DU RHONE|drinks|P
Sirop|SIROP|drinks|P
Glaces|GLACE;GLACES;CONE;CONES;BATONNET;SORBET;MAGNUM|frozen|Z
Frites surgelées|FRITES|frozen|Z
Légumes surgelés|LEGUMES SURG;POELEE SURG;POELEE|frozen|Z
Poisson pané|POISSON PANE;PANES;FISH STICK;BATONNETS POISSON|frozen|Z
Nuggets|NUGGETS;NUGGET|frozen|Z
`;

export interface LexiconEntry {
  name: string;
  keys: string[][];
  category: CategoryId;
  storage: StorageKind;
}

export const LEXICON: LexiconEntry[] = RAW.trim().split('\n').map((line) => {
  const [name, keys, category, storage] = line.split('|');
  return {
    name,
    keys: keys.split(';').map((k) => k.trim().split(/[\s.'/-]+/)),
    category: category as CategoryId,
    storage: (storage === 'F' ? F : storage === 'Z' ? Z : P) as StorageKind,
  };
});

// Erreurs de lecture fréquentes dans un mot : chiffres pris pour des lettres.
const OCR_LETTERS: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '4': 'A', '@': 'A', '|': 'I' };

/** Corrige les mots « surtout alphabétiques » (YA0URT -> YAOURT), sans toucher aux nombres. */
export function fixOcrWord(word: string): string {
  // Contenances et lots (« 50CL », « 2X125G », « X4 ») : ce sont de vrais chiffres.
  if (/^\d+([.,]\d+)?(KG|G|GR|L|CL|ML|%)$/.test(word) || /^\d*X\d+/.test(word) || /^\d+X$/.test(word)) return word;
  const letters = (word.match(/[A-Z]/g) ?? []).length;
  if (letters < 2 || letters < word.length / 2) return word;
  return word.replace(/[0158@4|]/g, (c) => OCR_LETTERS[c] ?? c);
}

function distance1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Un mot du ticket correspond-il à un mot du lexique ? (tronqué, pluriel, une faute de lecture) */
function wordMatches(ticket: string, key: string): boolean {
  if (ticket === key) return true;
  if (key.length <= 2) return false; // « LT », « FR » : uniquement à l'identique
  if (ticket.length >= 3 && key.startsWith(ticket) && ticket.length >= Math.min(4, key.length - 1)) return true; // tronqué sur le ticket
  if (ticket.startsWith(key) && /^(S|X|E|ES|EE|EES)$/.test(ticket.slice(key.length))) return true; // pluriel, féminin
  return key.length >= 5 && distance1(ticket, key);
}

export interface LexiconMatch {
  entry: LexiconEntry;
  score: number;
}

/** Meilleure entrée du lexique pour un libellé normalisé (majuscules, sans accents). */
export function matchLexicon(label: string): LexiconMatch | null {
  const words = label.split(/[\s.'/-]+/).filter(Boolean).map(fixOcrWord);
  let best: LexiconMatch | null = null;
  for (const entry of LEXICON) {
    for (const key of entry.keys) {
      const used = new Set<number>();
      let score = 0;
      for (const k of key) {
        const idx = words.findIndex((w, i) => !used.has(i) && wordMatches(w, k));
        if (idx < 0) { score = -1; break; }
        used.add(idx);
        score += k.length + (words[idx] === k ? 1 : 0);
      }
      // À score égal, la forme la plus longue (la plus précise) l'emporte.
      if (score > 0 && (!best || score > best.score)) best = { entry, score };
    }
  }
  // Un seul mot très court reconnu (« LT », « CAB ») : trop peu sûr si le libellé est long.
  if (best && best.score < 4 && words.length > 2) return null;
  return best;
}

const FREEZER_HINTS = ['SURG', 'SURGELE', 'SURGELES', 'SURGELEE', 'SURGELEES', 'CONGELE', 'CONGELES', 'GLACE', 'GLACES', 'SURGEL'];
const SHELF_HINTS = ['UHT', 'STERILISE', 'BTE', 'BOITE', 'CONSERVE', 'BOCAL'];

/** Indices écrits sur le ticket qui priment sur le rangement habituel. */
export function storageHint(label: string): StorageKind | null {
  const words = label.split(/[\s.'/-]+/);
  if (words.some((w) => FREEZER_HINTS.includes(w))) return 'freezer';
  if (words.some((w) => SHELF_HINTS.includes(w))) return 'pantry';
  return null;
}
