// Base de recettes Sauge — volume 2 (contenu original). Quantités pour 2 personnes.
import { BEURRE_BASE, type CatalogIngredient, type CatalogRecipe, FROMAGE_RAPE, HUILE, PATES, POIVRE, SEL } from './recipes-fr.ts';

const OEUFS = (n: number): CatalogIngredient => ({ name: 'Oeufs', quantity: n, unit: 'piece', category: 'fresh', match: ['oeuf'] });
const OIGNON: CatalogIngredient = { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables', match: ['echalote', 'oignon rouge'] };
const AIL: CatalogIngredient = { name: 'Ail', quantity: 1, unit: 'piece', category: 'vegetables', match: ['gousse'], staple: true };
const CREME = (ml: number, optional = false): CatalogIngredient => ({ name: 'Crème fraîche', quantity: ml, unit: 'ml', category: 'dairy', match: ['creme'], optional });
const LAIT = (ml: number): CatalogIngredient => ({ name: 'Lait', quantity: ml, unit: 'ml', category: 'dairy' });
const FARINE = (g: number): CatalogIngredient => ({ name: 'Farine', quantity: g, unit: 'g', category: 'starches', staple: true });
const SUCRE = (g: number): CatalogIngredient => ({ name: 'Sucre', quantity: g, unit: 'g', category: 'other', staple: true });
const RAPE = (g: number, optional = false): CatalogIngredient => ({ name: 'Fromage râpé', quantity: g, unit: 'g', category: 'cheese', match: FROMAGE_RAPE, optional });
const BOUILLON = (text: string): CatalogIngredient => ({ name: 'Bouillon', text, category: 'other', staple: true, match: ['bouillon cube'] });
const TOMATES_BOITE: CatalogIngredient = { name: 'Tomates concassées', quantity: 1, unit: 'pack', category: 'canned', match: ['tomate', 'pulpe', 'coulis', 'sauce tomate'] };
const RIZ = (g: number, optional = false): CatalogIngredient => ({ name: 'Riz', quantity: g, unit: 'g', category: 'starches', match: ['riz basmati', 'riz long'], optional });
const CITRON: CatalogIngredient = { name: 'Citron', quantity: 1, unit: 'piece', category: 'fruits', match: ['citron vert'] };
const EPICES = (name: string, match: string[] = []): CatalogIngredient => ({ name, text: '1 c. à café', category: 'other', staple: true, match });

export const RECIPES_FR_2: CatalogRecipe[] = [
  // ---------------------------------------------------------------- Petits-déjeuners
  {
    id: 'crepes', title: 'Crêpes', summary: 'Fines et dorées, sucrées ou salées.', meals: ['breakfast', 'dessert', 'snack'],
    prep: 10, cook: 20, difficulty: 1, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [FARINE(125), LAIT(250), OEUFS(2), SUCRE(15), BEURRE_BASE],
    steps: ['Mélangez la farine et le sucre, ajoutez les oeufs puis le lait petit à petit en fouettant.', 'Laissez reposer 15 minutes si possible.', 'Faites cuire de fines louches dans une poêle beurrée, 1 minute par face.'],
  },
  {
    id: 'oeufs-brouilles', title: 'Oeufs brouillés crémeux', summary: 'Cuits doucement pour rester fondants.', meals: ['breakfast', 'lunch'],
    prep: 2, cook: 6, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien', 'riche en protéines'],
    ingredients: [OEUFS(4), BEURRE_BASE, { name: 'Pain', quantity: 2, unit: 'piece', category: 'starches', optional: true, match: ['baguette', 'pain de mie'] }, { name: 'Ciboulette', text: 'quelques brins', category: 'vegetables', optional: true }, SEL, POIVRE],
    steps: ['Battez les oeufs avec sel et poivre.', 'Faites-les cuire à feu doux dans le beurre en remuant sans arrêt.', 'Retirez du feu quand ils sont encore crémeux et servez sur du pain grillé.'],
  },
  {
    id: 'tartine-avocat-oeuf', title: 'Tartines avocat et oeuf', summary: 'Un petit-déjeuner salé et nourrissant.', meals: ['breakfast', 'lunch', 'snack'],
    prep: 8, cook: 6, difficulty: 1, budget: 2, tags: ['rapide', 'végétarien', 'équilibré'],
    ingredients: [{ name: 'Avocat', quantity: 1, unit: 'piece', category: 'fruits', match: ['avocats'] }, OEUFS(2), { name: 'Pain', quantity: 2, unit: 'piece', category: 'starches', match: ['pain de campagne', 'pain complet', 'baguette'] }, CITRON, SEL, POIVRE],
    steps: ['Faites cuire les oeufs 6 minutes dans l\'eau bouillante, puis écalez-les.', 'Écrasez l\'avocat avec un filet de citron, du sel et du poivre.', 'Tartinez le pain grillé et ajoutez l\'oeuf coupé en deux.'],
  },
  {
    id: 'smoothie-fruits', title: 'Smoothie aux fruits', summary: 'Pour les fruits bien mûrs.', meals: ['breakfast', 'snack'],
    prep: 5, cook: 0, difficulty: 1, budget: 1, tags: ['rapide', 'végétarien', 'anti-gaspi'],
    ingredients: [{ name: 'Fruits', quantity: 300, unit: 'g', category: 'fruits', match: ['banane', 'fraise', 'mangue', 'kiwi', 'peche', 'fruits rouges', 'pomme', 'poire'] }, { name: 'Yaourt nature', quantity: 1, unit: 'piece', category: 'dairy', match: ['yaourt', 'skyr', 'fromage blanc'] }, LAIT(150)],
    steps: ['Coupez les fruits en morceaux.', 'Mixez-les avec le yaourt et le lait jusqu\'à obtenir une texture lisse.'],
  },
  {
    id: 'oeufs-coque', title: 'Oeufs à la coque et mouillettes', summary: 'Le classique du dimanche matin.', meals: ['breakfast'],
    prep: 3, cook: 4, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien', 'riche en protéines'],
    ingredients: [OEUFS(4), { name: 'Pain', quantity: 4, unit: 'piece', category: 'starches', match: ['baguette', 'pain de mie'] }, BEURRE_BASE, SEL],
    steps: ['Plongez les oeufs dans l\'eau bouillante pendant 3 minutes 30.', 'Coupez le pain beurré en mouillettes.', 'Servez aussitôt dans des coquetiers.'],
  },

  // ---------------------------------------------------------------- Viandes
  {
    id: 'hachis-parmentier', title: 'Hachis parmentier', summary: 'Purée gratinée sur viande hachée.', meals: ['lunch', 'dinner'],
    prep: 25, cook: 25, difficulty: 2, budget: 1, tags: ['économique', 'anti-gaspi'],
    ingredients: [{ name: 'Boeuf haché', quantity: 300, unit: 'g', category: 'meat', match: ['viande hachee', 'steak hache', 'hache', 'reste de viande'] }, { name: 'Pommes de terre', quantity: 600, unit: 'g', category: 'vegetables', match: ['pomme de terre', 'patate'] }, OIGNON, LAIT(150), RAPE(50), BEURRE_BASE, SEL, POIVRE],
    steps: ['Faites cuire les pommes de terre à l\'eau et écrasez-les avec le lait et le beurre.', 'Faites revenir l\'oignon et la viande, salez, poivrez.', 'Disposez la viande dans un plat, couvrez de purée et de fromage, gratinez 20 minutes à 200 °C.'],
  },
  {
    id: 'spaghetti-bolognaise', title: 'Spaghetti bolognaise', summary: 'La sauce qui mijote, version semaine.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 30, difficulty: 1, budget: 1, tags: ['économique', 'riche en protéines'],
    ingredients: [{ name: 'Pâtes', quantity: 200, unit: 'g', category: 'starches', match: PATES }, { name: 'Boeuf haché', quantity: 250, unit: 'g', category: 'meat', match: ['viande hachee', 'steak hache', 'hache'] }, TOMATES_BOITE, OIGNON, { name: 'Carotte', quantity: 1, unit: 'piece', category: 'vegetables', match: ['carottes'], optional: true }, RAPE(30, true), HUILE, SEL],
    steps: ['Faites revenir l\'oignon et la carotte hachés, puis la viande.', 'Ajoutez les tomates et laissez mijoter 20 minutes.', 'Servez sur les pâtes avec le fromage.'],
  },
  {
    id: 'lasagnes', title: 'Lasagnes à la bolognaise', summary: 'Le plat du week-end, encore meilleur le lendemain.', meals: ['lunch', 'dinner'],
    prep: 30, cook: 40, difficulty: 2, budget: 2, tags: [],
    ingredients: [{ name: 'Feuilles de lasagne', quantity: 8, unit: 'piece', category: 'starches', match: ['lasagne', 'lasagnes'] }, { name: 'Boeuf haché', quantity: 300, unit: 'g', category: 'meat', match: ['viande hachee', 'hache'] }, TOMATES_BOITE, OIGNON, LAIT(500), FARINE(40), { name: 'Beurre', quantity: 40, unit: 'g', category: 'dairy' }, RAPE(80)],
    steps: ['Préparez une bolognaise : oignon, viande, tomates, 15 minutes de cuisson.', 'Préparez une béchamel : beurre fondu, farine, puis lait en fouettant jusqu\'à épaississement.', 'Alternez pâtes, bolognaise et béchamel dans un plat, finissez par le fromage.', 'Enfournez 40 minutes à 180 °C.'],
  },
  {
    id: 'boulettes-tomate', title: 'Boulettes à la sauce tomate', summary: 'Tendres et mijotées.', meals: ['lunch', 'dinner'],
    prep: 20, cook: 25, difficulty: 1, budget: 1, tags: ['économique', 'riche en protéines'],
    ingredients: [{ name: 'Boeuf haché', quantity: 300, unit: 'g', category: 'meat', match: ['viande hachee', 'hache', 'chair a saucisse'] }, OEUFS(1), { name: 'Chapelure', text: '3 c. à soupe', category: 'starches', staple: true, match: ['pain rassis'] }, TOMATES_BOITE, AIL, { name: 'Pâtes ou riz', quantity: 150, unit: 'g', category: 'starches', optional: true, match: [...PATES, 'riz'] }, HUILE, SEL, POIVRE],
    steps: ['Mélangez la viande, l\'oeuf, la chapelure, l\'ail, le sel et le poivre ; formez des boulettes.', 'Faites-les dorer dans l\'huile.', 'Ajoutez les tomates et laissez mijoter 15 minutes à couvert.'],
  },
  {
    id: 'poulet-curry-coco', title: 'Poulet au curry et lait de coco', summary: 'Doux et parfumé, avec du riz.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 20, difficulty: 1, budget: 2, tags: ['rapide', 'riche en protéines'],
    ingredients: [{ name: 'Blancs de poulet', quantity: 2, unit: 'piece', category: 'meat', match: ['poulet', 'filet de poulet', 'aiguillettes'] }, { name: 'Lait de coco', quantity: 200, unit: 'ml', category: 'canned', match: ['coco', 'creme de coco'] }, OIGNON, EPICES('Curry'), RIZ(150, true), HUILE, SEL],
    steps: ['Faites revenir l\'oignon et le poulet en morceaux avec le curry.', 'Ajoutez le lait de coco et laissez mijoter 15 minutes.', 'Servez avec du riz.'],
  },
  {
    id: 'poulet-basquaise', title: 'Poulet basquaise', summary: 'Poivrons et tomates, mijoté du Sud-Ouest.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 40, difficulty: 1, budget: 2, tags: ['équilibré', 'riche en protéines'],
    ingredients: [{ name: 'Cuisses de poulet', quantity: 2, unit: 'piece', category: 'meat', match: ['poulet', 'pilon', 'blanc de poulet'] }, { name: 'Poivrons', quantity: 2, unit: 'piece', category: 'vegetables', match: ['poivron'] }, TOMATES_BOITE, OIGNON, AIL, HUILE, SEL, POIVRE],
    steps: ['Faites dorer le poulet dans une cocotte, réservez.', 'Faites revenir l\'oignon, l\'ail et les poivrons en lanières.', 'Ajoutez les tomates et le poulet, couvrez et laissez mijoter 35 minutes.'],
  },
  {
    id: 'poulet-citron', title: 'Poulet au citron et aux herbes', summary: 'Frais et léger.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 20, difficulty: 1, budget: 2, tags: ['rapide', 'équilibré', 'riche en protéines'],
    ingredients: [{ name: 'Blancs de poulet', quantity: 2, unit: 'piece', category: 'meat', match: ['poulet', 'escalope de poulet'] }, CITRON, { name: 'Herbes', text: '1 c. à café', category: 'other', staple: true, match: ['thym', 'herbes de provence'] }, { name: 'Légumes', quantity: 300, unit: 'g', category: 'vegetables', optional: true, match: ['courgette', 'haricots verts', 'brocoli'] }, HUILE, SEL, POIVRE],
    steps: ['Faites mariner le poulet 10 minutes avec le jus de citron, l\'huile et les herbes.', 'Faites-le cuire à la poêle 6 à 7 minutes par face.', 'Servez avec les légumes sautés.'],
  },
  {
    id: 'endives-jambon', title: 'Endives au jambon', summary: 'Gratinées à la béchamel.', meals: ['lunch', 'dinner'],
    prep: 20, cook: 30, difficulty: 2, budget: 1, tags: ['économique'],
    ingredients: [{ name: 'Endives', quantity: 4, unit: 'piece', category: 'vegetables', match: ['endive', 'chicon'] }, { name: 'Jambon', quantity: 4, unit: 'piece', category: 'meat', match: ['jambon blanc'] }, LAIT(400), FARINE(30), { name: 'Beurre', quantity: 30, unit: 'g', category: 'dairy' }, RAPE(60)],
    steps: ['Faites cuire les endives 15 minutes à la poêle à couvert, égouttez-les bien.', 'Préparez une béchamel avec le beurre, la farine et le lait.', 'Roulez chaque endive dans une tranche de jambon, nappez de béchamel et de fromage, gratinez 20 minutes à 200 °C.'],
  },
  {
    id: 'tartiflette', title: 'Tartiflette', summary: 'Le réconfort savoyard.', meals: ['lunch', 'dinner'],
    prep: 20, cook: 30, difficulty: 1, budget: 2, tags: [],
    ingredients: [{ name: 'Pommes de terre', quantity: 600, unit: 'g', category: 'vegetables', match: ['pomme de terre', 'patate'] }, { name: 'Reblochon', quantity: 1, unit: 'piece', category: 'cheese', match: ['raclette', 'fromage a raclette', 'camembert'] }, { name: 'Lardons', quantity: 150, unit: 'g', category: 'meat', match: ['lardon', 'bacon'] }, OIGNON, CREME(100, true)],
    steps: ['Faites cuire les pommes de terre à l\'eau, coupez-les en rondelles.', 'Faites revenir les lardons et l\'oignon.', 'Mélangez dans un plat, couvrez du fromage coupé en deux dans l\'épaisseur, enfournez 25 minutes à 200 °C.'],
  },
  {
    id: 'cotes-porc-pommes', title: 'Côtes de porc aux pommes', summary: 'Le sucré-salé tout simple.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 20, difficulty: 1, budget: 1, tags: ['économique', 'riche en protéines'],
    ingredients: [{ name: 'Côtes de porc', quantity: 2, unit: 'piece', category: 'meat', match: ['cote de porc', 'porc', 'echine', 'filet mignon'] }, { name: 'Pommes', quantity: 2, unit: 'piece', category: 'fruits', match: ['pomme'] }, OIGNON, BEURRE_BASE, SEL, POIVRE],
    steps: ['Faites dorer les côtes au beurre 5 minutes par face, réservez.', 'Faites revenir l\'oignon et les pommes en quartiers dans la même poêle.', 'Remettez la viande, couvrez et laissez cuire 8 minutes.'],
  },
  {
    id: 'wraps-poulet', title: 'Wraps au poulet', summary: 'À emporter ou pour un dîner rapide.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 10, difficulty: 1, budget: 2, tags: ['rapide', 'équilibré'],
    ingredients: [{ name: 'Tortillas', quantity: 4, unit: 'piece', category: 'starches', match: ['wrap', 'galette de ble'] }, { name: 'Blanc de poulet', quantity: 2, unit: 'piece', category: 'meat', match: ['poulet', 'reste de poulet'] }, { name: 'Salade', quantity: 1, unit: 'piece', category: 'vegetables', match: ['laitue', 'roquette', 'mesclun'] }, { name: 'Tomate', quantity: 1, unit: 'piece', category: 'vegetables', match: ['tomates'] }, { name: 'Sauce (yaourt, mayonnaise)', text: '3 c. à soupe', category: 'dairy', staple: true, match: ['yaourt', 'mayonnaise', 'fromage blanc'] }, HUILE, SEL],
    steps: ['Faites cuire le poulet en lamelles à la poêle.', 'Garnissez les tortillas de salade, tomate, poulet et sauce.', 'Roulez bien serré et coupez en deux.'],
  },
  {
    id: 'burger-maison', title: 'Burgers maison', summary: 'Mieux qu\'au restaurant, en 20 minutes.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 10, difficulty: 1, budget: 2, tags: ['rapide'],
    ingredients: [{ name: 'Pains à burger', quantity: 2, unit: 'piece', category: 'starches', match: ['pain burger', 'bun'] }, { name: 'Steaks hachés', quantity: 2, unit: 'piece', category: 'meat', match: ['steak hache', 'steak'] }, { name: 'Cheddar', quantity: 2, unit: 'piece', category: 'cheese', match: ['fromage', 'emmental', 'tranche de fromage'] }, { name: 'Tomate', quantity: 1, unit: 'piece', category: 'vegetables', match: ['tomates'] }, { name: 'Salade', text: 'quelques feuilles', category: 'vegetables', optional: true, match: ['laitue'] }, { name: 'Ketchup ou moutarde', text: 'au goût', category: 'canned', staple: true }],
    steps: ['Faites cuire les steaks, posez le fromage dessus en fin de cuisson.', 'Toastez les pains.', 'Montez les burgers avec la sauce, la salade, la tomate et le steak.'],
  },
  {
    id: 'fajitas', title: 'Fajitas au boeuf et aux poivrons', summary: 'À garnir à table.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 10, difficulty: 1, budget: 2, tags: ['rapide', 'riche en protéines'],
    ingredients: [{ name: 'Boeuf en lamelles', quantity: 300, unit: 'g', category: 'meat', match: ['boeuf', 'steak', 'poulet'] }, { name: 'Poivrons', quantity: 2, unit: 'piece', category: 'vegetables', match: ['poivron'] }, OIGNON, { name: 'Tortillas', quantity: 4, unit: 'piece', category: 'starches', match: ['wrap'] }, EPICES('Épices mexicaines', ['paprika', 'cumin', 'chili']), HUILE, SEL],
    steps: ['Faites sauter la viande à feu vif 2 minutes, réservez.', 'Faites revenir les poivrons et l\'oignon en lanières avec les épices.', 'Remettez la viande et servez dans les tortillas chaudes.'],
  },
  {
    id: 'saute-porc-caramel', title: 'Porc au caramel', summary: 'Sucré-salé, avec du riz.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 25, difficulty: 2, budget: 2, tags: ['riche en protéines'],
    ingredients: [{ name: 'Porc en morceaux', quantity: 400, unit: 'g', category: 'meat', match: ['porc', 'echine', 'filet mignon', 'sauté de porc'] }, SUCRE(40), { name: 'Sauce soja', text: '3 c. à soupe', category: 'other', staple: true, match: ['soja'] }, OIGNON, RIZ(150, true)],
    steps: ['Faites un caramel blond avec le sucre et 2 cuillères d\'eau.', 'Ajoutez le porc et l\'oignon, faites dorer.', 'Ajoutez la sauce soja et un fond d\'eau, laissez mijoter 20 minutes. Servez avec du riz.'],
  },

  // ---------------------------------------------------------------- Poissons
  {
    id: 'crevettes-ail-riz', title: 'Crevettes sautées à l\'ail', summary: 'Prêtes en 15 minutes.', meals: ['lunch', 'dinner'],
    prep: 5, cook: 10, difficulty: 1, budget: 3, tags: ['rapide', 'riche en protéines'],
    ingredients: [{ name: 'Crevettes', quantity: 250, unit: 'g', category: 'fish', match: ['crevette', 'gambas'] }, AIL, RIZ(150), { name: 'Persil', text: 'quelques brins', category: 'vegetables', optional: true }, HUILE, SEL],
    steps: ['Faites cuire le riz.', 'Faites sauter les crevettes avec l\'ail émincé 3 à 4 minutes.', 'Ajoutez le persil et servez sur le riz.'],
  },
  {
    id: 'moules-marinieres', title: 'Moules marinières', summary: 'Avec des frites ou du pain.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 10, difficulty: 1, budget: 2, tags: ['rapide', 'riche en protéines'],
    ingredients: [{ name: 'Moules', quantity: 1.5, unit: 'kg', category: 'fish', match: ['moule'] }, { name: 'Échalotes', quantity: 2, unit: 'piece', category: 'vegetables', match: ['echalote', 'oignon'] }, { name: 'Vin blanc', quantity: 150, unit: 'ml', category: 'drinks', match: ['vin'] }, { name: 'Persil', text: '1 bouquet', category: 'vegetables', optional: true }, BEURRE_BASE],
    steps: ['Nettoyez les moules et jetez celles qui restent ouvertes.', 'Faites fondre les échalotes au beurre, ajoutez le vin et les moules.', 'Couvrez et laissez cuire 6 à 8 minutes en remuant, jusqu\'à ouverture. Ajoutez le persil.'],
  },
  {
    id: 'saumon-pates-creme', title: 'Pâtes au saumon et à la crème', summary: 'Un classique rapide.', meals: ['lunch', 'dinner'],
    prep: 5, cook: 12, difficulty: 1, budget: 2, tags: ['rapide', 'riche en protéines'],
    ingredients: [{ name: 'Pâtes', quantity: 200, unit: 'g', category: 'starches', match: PATES }, { name: 'Saumon', quantity: 150, unit: 'g', category: 'fish', match: ['saumon fume', 'pave de saumon'] }, CREME(150), CITRON, SEL, POIVRE],
    steps: ['Faites cuire les pâtes.', 'Faites chauffer la crème avec le saumon en morceaux et un filet de citron.', 'Mélangez avec les pâtes, poivrez.'],
  },
  {
    id: 'poisson-pane', title: 'Poisson pané maison', summary: 'Croustillant, avec une purée ou des légumes.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 10, difficulty: 1, budget: 2, tags: ['riche en protéines'],
    ingredients: [{ name: 'Filets de poisson blanc', quantity: 2, unit: 'piece', category: 'fish', match: ['cabillaud', 'colin', 'merlu', 'lieu', 'poisson'] }, OEUFS(1), FARINE(30), { name: 'Chapelure', quantity: 60, unit: 'g', category: 'starches', staple: true }, CITRON, HUILE, SEL],
    steps: ['Passez les filets dans la farine, l\'oeuf battu puis la chapelure.', 'Faites-les dorer 3 minutes par face dans l\'huile.', 'Servez avec du citron.'],
  },
  {
    id: 'cabillaud-poireaux', title: 'Cabillaud sur fondue de poireaux', summary: 'Doux et léger.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 20, difficulty: 1, budget: 2, tags: ['équilibré', 'riche en protéines'],
    ingredients: [{ name: 'Filets de cabillaud', quantity: 2, unit: 'piece', category: 'fish', match: ['cabillaud', 'colin', 'lieu', 'merlu'] }, { name: 'Poireaux', quantity: 2, unit: 'piece', category: 'vegetables', match: ['poireau'] }, CREME(100), BEURRE_BASE, SEL, POIVRE],
    steps: ['Émincez les poireaux et faites-les fondre au beurre 15 minutes.', 'Ajoutez la crème.', 'Posez le poisson dessus, couvrez et laissez cuire 8 minutes.'],
  },
  {
    id: 'rillettes-thon', title: 'Rillettes de thon', summary: 'Pour l\'apéritif ou une tartine.', meals: ['snack', 'lunch'],
    prep: 5, cook: 0, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'riche en protéines'],
    ingredients: [{ name: 'Thon en boîte', quantity: 1, unit: 'pack', category: 'canned', match: ['thon'] }, { name: 'Fromage frais', quantity: 100, unit: 'g', category: 'cheese', match: ['fromage blanc', 'saint moret', 'philadelphia', 'carre frais', 'ricotta'] }, CITRON, POIVRE],
    steps: ['Égouttez le thon.', 'Écrasez-le avec le fromage frais, un filet de citron et du poivre.', 'Servez frais avec du pain ou des légumes crus.'],
  },

  // ---------------------------------------------------------------- Végétarien, soupes, salades
  {
    id: 'gratin-chou-fleur', title: 'Gratin de chou-fleur', summary: 'Fondant sous la béchamel.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 30, difficulty: 1, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [{ name: 'Chou-fleur', quantity: 1, unit: 'piece', category: 'vegetables', match: ['chou fleur', 'brocoli'] }, LAIT(400), FARINE(30), { name: 'Beurre', quantity: 30, unit: 'g', category: 'dairy' }, RAPE(60), SEL],
    steps: ['Faites cuire le chou-fleur en bouquets 10 minutes à l\'eau salée.', 'Préparez une béchamel avec le beurre, la farine et le lait.', 'Nappez le chou-fleur, couvrez de fromage et gratinez 20 minutes à 200 °C.'],
  },
  {
    id: 'veloute-potiron', title: 'Velouté de potiron', summary: 'Doux et velouté.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 25, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'équilibré'],
    ingredients: [{ name: 'Potiron', quantity: 800, unit: 'g', category: 'vegetables', match: ['courge', 'butternut', 'potimarron'] }, { name: 'Pomme de terre', quantity: 1, unit: 'piece', category: 'vegetables', optional: true, match: ['pommes de terre'] }, OIGNON, BOUILLON('750 ml'), CREME(50, true), SEL, POIVRE],
    steps: ['Coupez le potiron, la pomme de terre et l\'oignon en morceaux.', 'Couvrez de bouillon et laissez cuire 25 minutes.', 'Mixez et ajoutez la crème.'],
  },
  {
    id: 'soupe-poireaux-pdt', title: 'Soupe poireaux-pommes de terre', summary: 'La soupe de toujours.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 25, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'anti-gaspi'],
    ingredients: [{ name: 'Poireaux', quantity: 2, unit: 'piece', category: 'vegetables', match: ['poireau'] }, { name: 'Pommes de terre', quantity: 3, unit: 'piece', category: 'vegetables', match: ['pomme de terre', 'patate'] }, BOUILLON('1 litre'), CREME(50, true), SEL, POIVRE],
    steps: ['Émincez les poireaux et coupez les pommes de terre en dés.', 'Faites cuire 25 minutes dans le bouillon.', 'Mixez ou servez tel quel, avec un peu de crème.'],
  },
  {
    id: 'dahl-lentilles-corail', title: 'Dahl de lentilles corail', summary: 'Épicé, rassasiant et économique.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 20, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'équilibré', 'riche en protéines'],
    ingredients: [{ name: 'Lentilles corail', quantity: 150, unit: 'g', category: 'starches', match: ['lentilles', 'lentille'] }, { name: 'Lait de coco', quantity: 200, unit: 'ml', category: 'canned', match: ['coco'] }, TOMATES_BOITE, OIGNON, EPICES('Curry', ['curcuma', 'garam masala']), RIZ(120, true), HUILE],
    steps: ['Faites revenir l\'oignon avec les épices.', 'Ajoutez les lentilles rincées, les tomates, le lait de coco et 300 ml d\'eau.', 'Laissez cuire 18 minutes en remuant. Servez avec du riz.'],
  },
  {
    id: 'tian-legumes', title: 'Tian de légumes', summary: 'Des rondelles colorées rôties au four.', meals: ['lunch', 'dinner'],
    prep: 20, cook: 45, difficulty: 1, budget: 1, tags: ['végétarien', 'équilibré'],
    ingredients: [{ name: 'Courgette', quantity: 1, unit: 'piece', category: 'vegetables', match: ['courgettes'] }, { name: 'Tomates', quantity: 3, unit: 'piece', category: 'vegetables', match: ['tomate'] }, { name: 'Aubergine', quantity: 1, unit: 'piece', category: 'vegetables', optional: true, match: ['aubergines'] }, OIGNON, { name: 'Herbes de Provence', text: '1 c. à café', category: 'other', staple: true, match: ['thym'] }, HUILE, SEL],
    steps: ['Préchauffez le four à 180 °C.', 'Coupez les légumes en rondelles et disposez-les en alternance dans un plat.', 'Arrosez d\'huile, ajoutez les herbes et le sel, enfournez 45 minutes.'],
  },
  {
    id: 'taboule', title: 'Taboulé', summary: 'Frais et prêt d\'avance.', meals: ['lunch', 'dinner'],
    prep: 20, cook: 0, difficulty: 1, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [{ name: 'Semoule', quantity: 150, unit: 'g', category: 'starches', match: ['couscous', 'boulgour'] }, { name: 'Tomates', quantity: 2, unit: 'piece', category: 'vegetables', match: ['tomate', 'tomates cerises'] }, { name: 'Concombre', quantity: 1, unit: 'piece', category: 'vegetables', optional: true }, { name: 'Menthe ou persil', text: '1 bouquet', category: 'vegetables', optional: true, match: ['menthe', 'persil'] }, CITRON, HUILE, SEL],
    steps: ['Versez 150 ml d\'eau bouillante salée sur la semoule, couvrez 5 minutes puis égrainez.', 'Ajoutez les légumes en petits dés et les herbes.', 'Assaisonnez de citron, d\'huile et de sel, réservez au frais.'],
  },
  {
    id: 'salade-pates', title: 'Salade de pâtes', summary: 'À emporter, avec ce qu\'il y a au frigo.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 10, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'anti-gaspi'],
    ingredients: [{ name: 'Pâtes', quantity: 150, unit: 'g', category: 'starches', match: PATES }, { name: 'Tomates cerises', quantity: 150, unit: 'g', category: 'vegetables', match: ['tomate', 'tomates'] }, { name: 'Mozzarella ou feta', quantity: 1, unit: 'piece', category: 'cheese', match: ['mozzarella', 'feta', 'emmental', 'comte'] }, { name: 'Maïs ou olives', quantity: 1, unit: 'pack', category: 'canned', optional: true, match: ['mais', 'olives'] }, { name: 'Vinaigrette', text: '3 c. à soupe', category: 'other', staple: true, match: ['vinaigre'] }],
    steps: ['Faites cuire les pâtes, rincez-les à l\'eau froide.', 'Ajoutez les tomates coupées, le fromage en dés et le reste.', 'Assaisonnez et réservez au frais.'],
  },
  {
    id: 'frittata', title: 'Frittata aux légumes', summary: 'Une omelette épaisse pour vider le frigo.', meals: ['breakfast', 'lunch', 'dinner'],
    prep: 10, cook: 15, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien', 'riche en protéines', 'anti-gaspi'],
    ingredients: [OEUFS(5), { name: 'Légumes', quantity: 250, unit: 'g', category: 'vegetables', match: ['courgette', 'poivron', 'epinard', 'champignon', 'pomme de terre', 'oignon', 'tomate', 'brocoli'] }, RAPE(40, true), HUILE, SEL, POIVRE],
    steps: ['Faites revenir les légumes coupés dans une poêle allant au four.', 'Versez les oeufs battus avec le fromage, sel et poivre.', 'Laissez prendre 5 minutes à feu doux puis 8 minutes au four à 180 °C.'],
  },
  {
    id: 'quiche-epinards-feta', title: 'Quiche épinards et feta', summary: 'Végétarienne et généreuse.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 35, difficulty: 2, budget: 2, tags: ['végétarien'],
    ingredients: [{ name: 'Pâte brisée', quantity: 1, unit: 'pack', category: 'fresh', match: ['pate brisee', 'pate feuilletee', 'pate a tarte'] }, { name: 'Épinards', quantity: 300, unit: 'g', category: 'vegetables', match: ['epinard', 'pousses d epinard'] }, { name: 'Feta', quantity: 100, unit: 'g', category: 'cheese', match: ['chevre'] }, OEUFS(3), CREME(200), SEL, POIVRE],
    steps: ['Préchauffez le four à 180 °C et foncez le moule avec la pâte.', 'Faites tomber les épinards à la poêle, égouttez-les bien.', 'Répartissez épinards et feta, versez les oeufs battus avec la crème, enfournez 35 minutes.'],
  },
  {
    id: 'poivrons-farcis', title: 'Poivrons farcis au riz et au fromage', summary: 'Végétariens et colorés.', meals: ['lunch', 'dinner'],
    prep: 20, cook: 35, difficulty: 2, budget: 1, tags: ['végétarien'],
    ingredients: [{ name: 'Poivrons', quantity: 2, unit: 'piece', category: 'vegetables', match: ['poivron'] }, RIZ(100), TOMATES_BOITE, RAPE(60), OIGNON, HUILE, SEL],
    steps: ['Faites cuire le riz.', 'Mélangez-le avec l\'oignon revenu, la moitié des tomates et du fromage.', 'Farcissez les poivrons coupés en deux, posez-les sur le reste de tomates, gratinez 35 minutes à 190 °C.'],
  },
  {
    id: 'bol-complet', title: 'Bol complet riz, légumes et oeuf', summary: 'Équilibré, avec les restes du frigo.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 15, difficulty: 1, budget: 1, tags: ['végétarien', 'équilibré', 'anti-gaspi'],
    ingredients: [RIZ(150), OEUFS(2), { name: 'Légumes', quantity: 300, unit: 'g', category: 'vegetables', match: ['carotte', 'avocat', 'concombre', 'brocoli', 'chou', 'radis', 'courgette', 'tomate', 'mais'] }, { name: 'Pois chiches', quantity: 1, unit: 'pack', category: 'canned', optional: true, match: ['pois chiche', 'haricots rouges', 'lentilles'] }, { name: 'Sauce soja ou vinaigrette', text: '2 c. à soupe', category: 'other', staple: true, match: ['soja'] }],
    steps: ['Faites cuire le riz et les oeufs mollets (6 minutes).', 'Préparez les légumes crus ou sautés.', 'Composez les bols et assaisonnez.'],
  },
  {
    id: 'pates-pesto', title: 'Pâtes au pesto', summary: 'Le plat de 10 minutes.', meals: ['lunch', 'dinner'],
    prep: 2, cook: 10, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien'],
    ingredients: [{ name: 'Pâtes', quantity: 200, unit: 'g', category: 'starches', match: PATES }, { name: 'Pesto', text: '3 c. à soupe', category: 'canned', match: ['pesto'] }, RAPE(30, true), { name: 'Tomates cerises', quantity: 100, unit: 'g', category: 'vegetables', optional: true, match: ['tomate'] }],
    steps: ['Faites cuire les pâtes.', 'Mélangez-les avec le pesto et un peu d\'eau de cuisson.', 'Ajoutez les tomates et le fromage.'],
  },
  {
    id: 'gnocchis-tomate-mozza', title: 'Gnocchis tomate et mozzarella au four', summary: 'Gratinés et fondants.', meals: ['lunch', 'dinner'],
    prep: 5, cook: 20, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien'],
    ingredients: [{ name: 'Gnocchis', quantity: 1, unit: 'pack', category: 'starches', match: ['gnocchi'] }, TOMATES_BOITE, { name: 'Mozzarella', quantity: 1, unit: 'piece', category: 'cheese', match: ['fromage rape', 'emmental'] }, { name: 'Basilic', text: 'quelques feuilles', category: 'vegetables', optional: true }, HUILE, SEL],
    steps: ['Préchauffez le four à 200 °C.', 'Mélangez les gnocchis crus avec les tomates, l\'huile et le sel dans un plat.', 'Ajoutez la mozzarella en morceaux et enfournez 20 minutes.'],
  },
  {
    id: 'tortilla-espagnole', title: 'Tortilla de pommes de terre', summary: 'L\'omelette épaisse espagnole.', meals: ['lunch', 'dinner', 'snack'],
    prep: 15, cook: 25, difficulty: 2, budget: 1, tags: ['économique', 'végétarien', 'riche en protéines'],
    ingredients: [{ name: 'Pommes de terre', quantity: 400, unit: 'g', category: 'vegetables', match: ['pomme de terre', 'patate'] }, OEUFS(5), OIGNON, HUILE, SEL],
    steps: ['Faites cuire les pommes de terre et l\'oignon émincés à feu doux dans l\'huile 15 minutes.', 'Mélangez-les aux oeufs battus salés.', 'Faites cuire dans la poêle 5 minutes de chaque côté en retournant à l\'aide d\'une assiette.'],
  },
  {
    id: 'champignons-farcis', title: 'Champignons farcis', summary: 'En entrée ou avec une salade.', meals: ['lunch', 'dinner', 'snack'],
    prep: 15, cook: 20, difficulty: 1, budget: 1, tags: ['végétarien'],
    ingredients: [{ name: 'Gros champignons', quantity: 8, unit: 'piece', category: 'vegetables', match: ['champignon', 'champignons'] }, { name: 'Fromage frais', quantity: 100, unit: 'g', category: 'cheese', match: ['chevre', 'carre frais', 'saint moret', 'ricotta'] }, AIL, { name: 'Persil', text: 'quelques brins', category: 'vegetables', optional: true }, SEL, POIVRE],
    steps: ['Retirez les pieds des champignons et hachez-les avec l\'ail.', 'Mélangez avec le fromage frais, le persil, sel et poivre.', 'Garnissez les chapeaux et enfournez 20 minutes à 190 °C.'],
  },
  {
    id: 'gaspacho', title: 'Gaspacho', summary: 'Soupe froide d\'été.', meals: ['lunch', 'dinner', 'snack'],
    prep: 15, cook: 0, difficulty: 1, budget: 1, tags: ['végétarien', 'équilibré', 'anti-gaspi'],
    ingredients: [{ name: 'Tomates', quantity: 6, unit: 'piece', category: 'vegetables', match: ['tomate'] }, { name: 'Concombre', quantity: 1, unit: 'piece', category: 'vegetables' }, { name: 'Poivron', quantity: 1, unit: 'piece', category: 'vegetables', optional: true, match: ['poivrons'] }, AIL, HUILE, { name: 'Vinaigre', text: '1 c. à soupe', category: 'other', staple: true }, SEL],
    steps: ['Coupez les légumes en morceaux.', 'Mixez-les avec l\'ail, l\'huile, le vinaigre et le sel.', 'Réservez au frais au moins 1 heure.'],
  },
  {
    id: 'salade-chevre-chaud', title: 'Salade de chèvre chaud', summary: 'Le bistrot à la maison.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 8, difficulty: 1, budget: 2, tags: ['rapide', 'végétarien'],
    ingredients: [{ name: 'Salade', quantity: 1, unit: 'piece', category: 'vegetables', match: ['laitue', 'mesclun', 'roquette', 'mache'] }, { name: 'Fromage de chèvre', quantity: 1, unit: 'piece', category: 'cheese', match: ['chevre', 'buche de chevre', 'crottin'] }, { name: 'Pain', quantity: 4, unit: 'piece', category: 'starches', match: ['baguette', 'pain de campagne'] }, { name: 'Miel', text: '1 c. à café', category: 'other', staple: true, optional: true }, { name: 'Vinaigrette', text: '2 c. à soupe', category: 'other', staple: true, match: ['vinaigre'] }],
    steps: ['Posez une rondelle de chèvre sur chaque tranche de pain, un filet de miel.', 'Passez 6 à 8 minutes sous le gril du four.', 'Servez sur la salade assaisonnée.'],
  },
  {
    id: 'pizza-maison', title: 'Pizza maison', summary: 'Pâte rapide sans repos.', meals: ['lunch', 'dinner'],
    prep: 20, cook: 15, difficulty: 2, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [{ name: 'Pâte à pizza', quantity: 1, unit: 'pack', category: 'fresh', match: ['pate a pizza', 'farine'] }, { name: 'Sauce tomate', quantity: 150, unit: 'ml', category: 'canned', match: ['coulis', 'tomate', 'pulpe'] }, { name: 'Mozzarella', quantity: 1, unit: 'piece', category: 'cheese', match: ['fromage rape', 'emmental'] }, { name: 'Garniture', quantity: 150, unit: 'g', category: 'vegetables', optional: true, match: ['champignon', 'poivron', 'olives', 'oignon', 'tomate'] }, { name: 'Origan', text: '1 pincée', category: 'other', staple: true, optional: true }],
    steps: ['Préchauffez le four à 240 °C.', 'Étalez la pâte, couvrez de sauce, de garniture et de mozzarella.', 'Enfournez 12 à 15 minutes.'],
  },
  {
    id: 'galettes-pois-chiches', title: 'Galettes de pois chiches', summary: 'Façon falafels, à la poêle.', meals: ['lunch', 'dinner', 'snack'],
    prep: 15, cook: 10, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'riche en protéines'],
    ingredients: [{ name: 'Pois chiches', quantity: 1, unit: 'pack', category: 'canned', match: ['pois chiche'] }, OIGNON, AIL, FARINE(30), EPICES('Cumin', ['cumin', 'coriandre']), { name: 'Yaourt', quantity: 1, unit: 'piece', category: 'dairy', optional: true, match: ['yaourt nature', 'fromage blanc'] }, HUILE, SEL],
    steps: ['Mixez les pois chiches égouttés avec l\'oignon, l\'ail, la farine, le cumin et le sel.', 'Formez des galettes.', 'Faites-les dorer 3 minutes par face. Servez avec une sauce au yaourt.'],
  },
  {
    id: 'courgettes-farcies-veg', title: 'Courgettes gratinées au fromage', summary: 'Simples et fondantes.', meals: ['lunch', 'dinner'],
    prep: 10, cook: 25, difficulty: 1, budget: 1, tags: ['végétarien', 'équilibré'],
    ingredients: [{ name: 'Courgettes', quantity: 2, unit: 'piece', category: 'vegetables', match: ['courgette'] }, { name: 'Fromage frais', quantity: 100, unit: 'g', category: 'cheese', match: ['ricotta', 'chevre', 'feta', 'carre frais'] }, RAPE(40), AIL, HUILE, SEL, POIVRE],
    steps: ['Coupez les courgettes en deux et creusez-les légèrement.', 'Mélangez la chair hachée avec le fromage frais et l\'ail, garnissez.', 'Couvrez de fromage râpé et enfournez 25 minutes à 190 °C.'],
  },
  {
    id: 'salade-pdt-oeufs', title: 'Salade de pommes de terre et oeufs', summary: 'Tiède ou froide.', meals: ['lunch', 'dinner'],
    prep: 15, cook: 20, difficulty: 1, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [{ name: 'Pommes de terre', quantity: 500, unit: 'g', category: 'vegetables', match: ['pomme de terre', 'patate'] }, OEUFS(2), { name: 'Échalote', quantity: 1, unit: 'piece', category: 'vegetables', match: ['oignon rouge', 'oignon'] }, { name: 'Cornichons', text: 'quelques-uns', category: 'canned', optional: true }, { name: 'Vinaigrette moutarde', text: '3 c. à soupe', category: 'other', staple: true, match: ['vinaigre', 'moutarde'] }],
    steps: ['Faites cuire les pommes de terre et les oeufs (9 minutes).', 'Coupez-les en morceaux avec l\'échalote et les cornichons.', 'Assaisonnez encore tiède.'],
  },

  // ---------------------------------------------------------------- Desserts & en-cas
  {
    id: 'mousse-chocolat', title: 'Mousse au chocolat', summary: 'Aérienne, sans cuisson.', meals: ['dessert'],
    prep: 20, cook: 0, difficulty: 2, budget: 1, tags: ['végétarien'],
    ingredients: [{ name: 'Chocolat noir', quantity: 100, unit: 'g', category: 'other', match: ['chocolat'] }, OEUFS(3), SUCRE(15)],
    steps: ['Faites fondre le chocolat et laissez tiédir.', 'Séparez les blancs des jaunes ; mélangez les jaunes au chocolat.', 'Montez les blancs en neige avec le sucre, incorporez délicatement, réservez 3 heures au frais.'],
  },
  {
    id: 'gateau-chocolat', title: 'Gâteau au chocolat fondant', summary: 'Le dessert préféré des enfants.', meals: ['dessert', 'snack'],
    prep: 15, cook: 25, difficulty: 1, budget: 2, tags: ['végétarien'],
    ingredients: [{ name: 'Chocolat noir', quantity: 150, unit: 'g', category: 'other', match: ['chocolat'] }, { name: 'Beurre', quantity: 100, unit: 'g', category: 'dairy' }, OEUFS(3), SUCRE(100), FARINE(50)],
    steps: ['Préchauffez le four à 180 °C ; faites fondre le chocolat avec le beurre.', 'Ajoutez le sucre, les oeufs un à un puis la farine.', 'Enfournez 20 à 25 minutes dans un moule beurré : le centre doit rester fondant.'],
  },
  {
    id: 'cookies', title: 'Cookies aux pépites de chocolat', summary: 'Croustillants autour, moelleux au centre.', meals: ['dessert', 'snack'],
    prep: 15, cook: 12, difficulty: 1, budget: 1, tags: ['végétarien'],
    ingredients: [FARINE(200), { name: 'Beurre', quantity: 100, unit: 'g', category: 'dairy' }, SUCRE(100), OEUFS(1), { name: 'Pépites de chocolat', quantity: 100, unit: 'g', category: 'other', match: ['chocolat'] }, { name: 'Levure chimique', text: '1/2 sachet', category: 'other', staple: true }],
    steps: ['Mélangez le beurre mou et le sucre, ajoutez l\'oeuf.', 'Incorporez la farine, la levure puis le chocolat.', 'Formez des boules espacées sur une plaque et enfournez 10 à 12 minutes à 180 °C.'],
  },
  {
    id: 'tarte-pommes', title: 'Tarte aux pommes', summary: 'Fine et dorée.', meals: ['dessert'],
    prep: 20, cook: 30, difficulty: 1, budget: 1, tags: ['végétarien', 'anti-gaspi'],
    ingredients: [{ name: 'Pâte brisée', quantity: 1, unit: 'pack', category: 'fresh', match: ['pate brisee', 'pate feuilletee', 'pate sablee', 'pate a tarte'] }, { name: 'Pommes', quantity: 4, unit: 'piece', category: 'fruits', match: ['pomme'] }, SUCRE(30), BEURRE_BASE],
    steps: ['Préchauffez le four à 200 °C et foncez le moule.', 'Disposez les pommes en fines lamelles en rosace.', 'Saupoudrez de sucre, parsemez de beurre et enfournez 30 minutes.'],
  },
  {
    id: 'salade-fruits', title: 'Salade de fruits frais', summary: 'Pour finir les fruits de la corbeille.', meals: ['dessert', 'breakfast', 'snack'],
    prep: 15, cook: 0, difficulty: 1, budget: 1, tags: ['rapide', 'végétarien', 'équilibré', 'anti-gaspi'],
    ingredients: [{ name: 'Fruits variés', quantity: 600, unit: 'g', category: 'fruits', match: ['pomme', 'poire', 'banane', 'orange', 'kiwi', 'fraise', 'raisin', 'mangue', 'ananas', 'peche', 'clementine'] }, CITRON, { name: 'Sucre', text: '1 c. à soupe', category: 'other', staple: true, optional: true }],
    steps: ['Coupez les fruits en morceaux.', 'Arrosez de jus de citron pour éviter qu\'ils noircissent.', 'Sucrez légèrement si besoin et servez frais.'],
  },
  {
    id: 'clafoutis', title: 'Clafoutis aux fruits', summary: 'Aux cerises, ou à tous les fruits.', meals: ['dessert'],
    prep: 15, cook: 35, difficulty: 1, budget: 1, tags: ['végétarien', 'anti-gaspi'],
    ingredients: [{ name: 'Fruits', quantity: 400, unit: 'g', category: 'fruits', match: ['cerise', 'abricot', 'prune', 'poire', 'pomme', 'fruits rouges'] }, OEUFS(3), LAIT(250), FARINE(60), SUCRE(60)],
    steps: ['Préchauffez le four à 180 °C ; disposez les fruits dans un plat beurré.', 'Fouettez les oeufs et le sucre, ajoutez la farine puis le lait.', 'Versez sur les fruits et enfournez 35 minutes.'],
  },
  {
    id: 'banana-bread', title: 'Cake à la banane', summary: 'La meilleure fin pour les bananes trop mûres.', meals: ['dessert', 'breakfast', 'snack'],
    prep: 15, cook: 45, difficulty: 1, budget: 1, tags: ['végétarien', 'anti-gaspi'],
    ingredients: [{ name: 'Bananes très mûres', quantity: 3, unit: 'piece', category: 'fruits', match: ['banane', 'bananes'] }, OEUFS(2), FARINE(200), SUCRE(80), { name: 'Beurre', quantity: 80, unit: 'g', category: 'dairy' }, { name: 'Levure chimique', text: '1 sachet', category: 'other', staple: true }],
    steps: ['Préchauffez le four à 180 °C ; écrasez les bananes.', 'Mélangez avec le beurre fondu, le sucre et les oeufs, puis la farine et la levure.', 'Versez dans un moule à cake et enfournez 45 minutes.'],
  },
  {
    id: 'muffins-fruits', title: 'Muffins aux fruits', summary: 'Pour le goûter ou le petit-déjeuner.', meals: ['snack', 'breakfast', 'dessert'],
    prep: 15, cook: 20, difficulty: 1, budget: 1, tags: ['végétarien'],
    ingredients: [FARINE(200), SUCRE(80), OEUFS(2), LAIT(120), { name: 'Beurre', quantity: 60, unit: 'g', category: 'dairy' }, { name: 'Fruits', quantity: 150, unit: 'g', category: 'fruits', match: ['myrtille', 'fruits rouges', 'pomme', 'banane', 'framboise'] }, { name: 'Levure chimique', text: '1 sachet', category: 'other', staple: true }],
    steps: ['Mélangez les ingrédients secs d\'un côté, les liquides de l\'autre.', 'Réunissez sans trop mélanger et ajoutez les fruits.', 'Remplissez des moules à muffins et enfournez 20 minutes à 180 °C.'],
  },
  {
    id: 'panna-cotta', title: 'Panna cotta aux fruits rouges', summary: 'Un dessert préparé la veille.', meals: ['dessert'],
    prep: 15, cook: 5, difficulty: 2, budget: 2, tags: ['végétarien'],
    ingredients: [CREME(400), SUCRE(50), { name: 'Gélatine', text: '3 feuilles', category: 'other', staple: true }, { name: 'Fruits rouges', quantity: 150, unit: 'g', category: 'fruits', match: ['fraise', 'framboise', 'myrtille', 'coulis'] }],
    steps: ['Faites ramollir la gélatine dans l\'eau froide.', 'Faites chauffer la crème avec le sucre, ajoutez la gélatine essorée.', 'Versez dans des verrines et laissez prendre 4 heures au frais. Servez avec les fruits.'],
  },
  {
    id: 'houmous', title: 'Houmous', summary: 'Pour l\'apéritif avec des légumes crus.', meals: ['snack'],
    prep: 10, cook: 0, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien'],
    ingredients: [{ name: 'Pois chiches', quantity: 1, unit: 'pack', category: 'canned', match: ['pois chiche'] }, CITRON, AIL, { name: 'Purée de sésame', text: '1 c. à soupe', category: 'canned', optional: true, match: ['tahini', 'tahin'] }, HUILE, SEL],
    steps: ['Mixez les pois chiches égouttés avec le citron, l\'ail, l\'huile et le sel.', 'Ajoutez un peu d\'eau pour une texture lisse.', 'Servez avec des légumes crus ou du pain.'],
  },
  {
    id: 'guacamole', title: 'Guacamole', summary: 'Frais et relevé.', meals: ['snack'],
    prep: 10, cook: 0, difficulty: 1, budget: 2, tags: ['rapide', 'végétarien'],
    ingredients: [{ name: 'Avocats', quantity: 2, unit: 'piece', category: 'fruits', match: ['avocat'] }, CITRON, { name: 'Tomate', quantity: 1, unit: 'piece', category: 'vegetables', optional: true, match: ['tomates'] }, { name: 'Oignon rouge', quantity: 0.5, unit: 'piece', category: 'vegetables', optional: true, match: ['oignon', 'echalote'] }, SEL],
    steps: ['Écrasez la chair des avocats avec le jus de citron.', 'Ajoutez la tomate et l\'oignon finement hachés.', 'Salez et servez aussitôt.'],
  },
  {
    id: 'compote-poires-chocolat', title: 'Poires pochées au chocolat', summary: 'Un dessert élégant et simple.', meals: ['dessert'],
    prep: 10, cook: 20, difficulty: 1, budget: 1, tags: ['végétarien', 'anti-gaspi'],
    ingredients: [{ name: 'Poires', quantity: 2, unit: 'piece', category: 'fruits', match: ['poire'] }, SUCRE(50), { name: 'Chocolat', quantity: 50, unit: 'g', category: 'other', match: ['chocolat noir', 'chocolat au lait'] }],
    steps: ['Épluchez les poires et faites-les pocher 20 minutes dans de l\'eau sucrée frémissante.', 'Faites fondre le chocolat.', 'Servez les poires nappées de chocolat chaud.'],
  },
];
