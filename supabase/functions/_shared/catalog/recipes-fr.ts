// Base de recettes Sauge (contenu original, rédigé pour l'application).
// Quantités pour 2 personnes ; le moteur les adapte au nombre de personnes.
// `match` : autres noms sous lesquels l'ingrédient peut figurer dans le stock.
import type { FoodCategory, FoodUnit, MealType } from '../ai/types.ts';

export interface CatalogIngredient {
  name: string;
  quantity?: number;
  unit?: FoodUnit;
  text?: string;
  category: FoodCategory;
  match?: string[];
  staple?: boolean;
  optional?: boolean;
}

export interface CatalogRecipe {
  id: string;
  title: string;
  summary: string;
  meals: MealType[];
  prep: number;
  cook: number;
  difficulty: 1 | 2 | 3;
  budget: 1 | 2 | 3;
  tags: string[];
  ingredients: CatalogIngredient[];
  steps: string[];
}

export const SEL: CatalogIngredient = { name: 'Sel', text: '1 pincée', category: 'other', staple: true };
export const POIVRE: CatalogIngredient = { name: 'Poivre', text: '1 pincée', category: 'other', staple: true };
export const HUILE: CatalogIngredient = { name: "Huile d'olive", text: '1 c. à soupe', category: 'other', staple: true, match: ['huile'] };
export const BEURRE_BASE: CatalogIngredient = { name: 'Beurre', quantity: 20, unit: 'g', category: 'dairy', staple: true };
export const PATES = ['pates', 'spaghetti', 'penne', 'coquillette', 'tagliatelle', 'fusilli', 'macaroni', 'farfalle', 'linguine'];
export const FROMAGE_RAPE = ['emmental', 'gruyere', 'comte', 'fromage rape', 'parmesan'];

export const RECIPES_FR: CatalogRecipe[] = [
  // ---------------------------------------------------------------- Petits-déjeuners
  {
    id: 'omelette-fines-herbes', title: 'Omelette aux fines herbes', summary: 'Moelleuse et prête en 10 minutes.',
    meals: ['breakfast', 'lunch', 'dinner'], prep: 5, cook: 5, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien', 'riche en protéines'],
    ingredients: [
      { name: 'Oeufs', quantity: 4, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Ciboulette', text: 'quelques brins', category: 'vegetables', optional: true, match: ['persil', 'herbes'] },
      { name: 'Lait', quantity: 30, unit: 'ml', category: 'dairy', optional: true },
      BEURRE_BASE, SEL, POIVRE,
    ],
    steps: ['Battez les oeufs avec le lait, le sel, le poivre et les herbes ciselées.', 'Faites fondre le beurre dans une poêle à feu moyen.', 'Versez les oeufs, ramenez les bords vers le centre pendant 2 à 3 minutes.', 'Pliez l\'omelette en deux quand le centre est encore baveux et servez.'],
  },
  {
    id: 'pancakes', title: 'Pancakes', summary: 'Épais et moelleux, à garnir de fruits.',
    meals: ['breakfast', 'snack'], prep: 10, cook: 15, difficulty: 1, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [
      { name: 'Farine', quantity: 150, unit: 'g', category: 'starches', staple: true },
      { name: 'Lait', quantity: 200, unit: 'ml', category: 'dairy' },
      { name: 'Oeufs', quantity: 1, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Sucre', quantity: 20, unit: 'g', category: 'other', staple: true },
      { name: 'Levure chimique', text: '1 sachet', category: 'other', staple: true },
      { name: 'Fruits rouges ou banane', text: 'pour servir', category: 'fruits', optional: true, match: ['banane', 'fraise', 'myrtille', 'framboise'] },
    ],
    steps: ['Mélangez la farine, le sucre et la levure.', 'Ajoutez l\'oeuf puis le lait progressivement en fouettant jusqu\'à obtenir une pâte lisse.', 'Faites cuire de petites louches dans une poêle huilée, 1 à 2 minutes par face.', 'Servez avec les fruits.'],
  },
  {
    id: 'porridge-banane', title: 'Porridge à la banane', summary: 'Un petit-déjeuner chaud et rassasiant.',
    meals: ['breakfast'], prep: 2, cook: 6, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien', 'équilibré'],
    ingredients: [
      { name: "Flocons d'avoine", quantity: 80, unit: 'g', category: 'starches', match: ['avoine', 'flocons'] },
      { name: 'Lait', quantity: 400, unit: 'ml', category: 'dairy' },
      { name: 'Banane', quantity: 1, unit: 'piece', category: 'fruits', match: ['bananes'] },
      { name: 'Miel', text: '1 c. à café', category: 'other', staple: true, optional: true },
    ],
    steps: ['Portez le lait à frémissement avec les flocons.', 'Laissez cuire 5 minutes en remuant jusqu\'à épaississement.', 'Ajoutez la banane en rondelles et le miel.'],
  },
  {
    id: 'pain-perdu', title: 'Pain perdu', summary: 'La meilleure façon de sauver le pain rassis.',
    meals: ['breakfast', 'dessert', 'snack'], prep: 5, cook: 10, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'anti-gaspi'],
    ingredients: [
      { name: 'Pain', quantity: 4, unit: 'piece', category: 'starches', match: ['baguette', 'pain de mie', 'brioche'] },
      { name: 'Oeufs', quantity: 2, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Lait', quantity: 200, unit: 'ml', category: 'dairy' },
      { name: 'Sucre', quantity: 30, unit: 'g', category: 'other', staple: true },
      BEURRE_BASE,
    ],
    steps: ['Fouettez les oeufs, le lait et le sucre.', 'Trempez les tranches de pain quelques secondes de chaque côté.', 'Faites-les dorer au beurre 2 à 3 minutes par face.'],
  },
  {
    id: 'yaourt-granola-fruits', title: 'Bol yaourt, fruits et céréales', summary: 'Frais, sans cuisson.',
    meals: ['breakfast', 'snack'], prep: 5, cook: 0, difficulty: 1, budget: 1, tags: ['rapide', 'végétarien', 'équilibré'],
    ingredients: [
      { name: 'Yaourt nature', quantity: 2, unit: 'piece', category: 'dairy', match: ['yaourt', 'fromage blanc', 'skyr'] },
      { name: 'Fruits de saison', quantity: 2, unit: 'piece', category: 'fruits', match: ['pomme', 'poire', 'banane', 'fraise', 'kiwi', 'orange', 'peche', 'abricot'] },
      { name: 'Céréales ou granola', quantity: 60, unit: 'g', category: 'starches', match: ['granola', 'muesli', 'cereales', 'avoine'] },
    ],
    steps: ['Coupez les fruits en morceaux.', 'Répartissez le yaourt dans deux bols.', 'Ajoutez les fruits et les céréales au moment de servir.'],
  },

  // ---------------------------------------------------------------- Pâtes, riz, féculents
  {
    id: 'pates-carbonara', title: 'Pâtes à la carbonara', summary: 'La version crémeuse aux oeufs, sans crème.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 12, difficulty: 2, budget: 1, tags: ['rapide', 'économique', 'riche en protéines'],
    ingredients: [
      { name: 'Pâtes', quantity: 200, unit: 'g', category: 'starches', match: PATES },
      { name: 'Lardons', quantity: 150, unit: 'g', category: 'meat', match: ['lardon', 'bacon', 'pancetta'] },
      { name: 'Oeufs', quantity: 2, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Parmesan', quantity: 40, unit: 'g', category: 'cheese', match: FROMAGE_RAPE },
      SEL, POIVRE,
    ],
    steps: ['Faites cuire les pâtes dans une grande casserole d\'eau salée.', 'Faites dorer les lardons à sec dans une poêle.', 'Battez les oeufs avec le fromage râpé et beaucoup de poivre.', 'Hors du feu, mélangez les pâtes égouttées, les lardons et les oeufs avec un peu d\'eau de cuisson jusqu\'à obtenir une sauce crémeuse.'],
  },
  {
    id: 'pates-tomate-basilic', title: 'Pâtes à la tomate et au basilic', summary: 'Une sauce express aux tomates fraîches.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 15, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien'],
    ingredients: [
      { name: 'Pâtes', quantity: 200, unit: 'g', category: 'starches', match: PATES },
      { name: 'Tomates', quantity: 4, unit: 'piece', category: 'vegetables', match: ['tomate', 'tomates cerises', 'coulis', 'pulpe', 'tomates concassees'] },
      { name: 'Ail', quantity: 1, unit: 'piece', category: 'vegetables', match: ['gousse'] },
      { name: 'Basilic', text: 'quelques feuilles', category: 'vegetables', optional: true },
      HUILE, SEL, POIVRE,
    ],
    steps: ['Faites cuire les pâtes.', 'Faites revenir l\'ail émincé dans l\'huile, ajoutez les tomates coupées et laissez compoter 10 minutes.', 'Salez, poivrez, mélangez avec les pâtes et le basilic.'],
  },
  {
    id: 'gratin-pates-jambon', title: 'Gratin de pâtes au jambon', summary: 'Le plat réconfort qui plaît à tout le monde.',
    meals: ['lunch', 'dinner'], prep: 15, cook: 25, difficulty: 1, budget: 1, tags: ['économique', 'anti-gaspi'],
    ingredients: [
      { name: 'Pâtes', quantity: 200, unit: 'g', category: 'starches', match: PATES },
      { name: 'Jambon', quantity: 2, unit: 'piece', category: 'meat', match: ['jambon blanc'] },
      { name: 'Crème fraîche', quantity: 200, unit: 'ml', category: 'dairy', match: ['creme'] },
      { name: 'Fromage râpé', quantity: 80, unit: 'g', category: 'cheese', match: FROMAGE_RAPE },
      SEL, POIVRE,
    ],
    steps: ['Préchauffez le four à 200 °C et faites cuire les pâtes un peu fermes.', 'Mélangez-les avec la crème et le jambon en dés, salez, poivrez.', 'Versez dans un plat, couvrez de fromage râpé et enfournez 20 minutes.'],
  },
  {
    id: 'riz-saute-legumes-oeuf', title: 'Riz sauté aux légumes et à l\'oeuf', summary: 'Parfait pour finir le riz et les légumes du frigo.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 10, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien', 'anti-gaspi'],
    ingredients: [
      { name: 'Riz', quantity: 150, unit: 'g', category: 'starches', match: ['riz basmati', 'riz cuit'] },
      { name: 'Oeufs', quantity: 2, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Légumes', quantity: 250, unit: 'g', category: 'vegetables', match: ['carotte', 'petits pois', 'poivron', 'courgette', 'haricots verts', 'brocoli', 'champignon', 'oignon'] },
      { name: 'Sauce soja', text: '2 c. à soupe', category: 'other', staple: true, match: ['soja'] },
      HUILE,
    ],
    steps: ['Faites cuire le riz (ou utilisez un reste de riz cuit).', 'Faites sauter les légumes coupés finement 5 minutes à feu vif.', 'Poussez-les sur le côté, brouillez les oeufs puis mélangez.', 'Ajoutez le riz et la sauce soja, faites sauter 2 minutes.'],
  },
  {
    id: 'risotto-champignons', title: 'Risotto aux champignons', summary: 'Crémeux, sans crème.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 25, difficulty: 2, budget: 2, tags: ['végétarien'],
    ingredients: [
      { name: 'Riz', quantity: 160, unit: 'g', category: 'starches', match: ['riz arborio', 'riz rond'] },
      { name: 'Champignons', quantity: 250, unit: 'g', category: 'vegetables', match: ['champignon'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables', match: ['echalote'] },
      { name: 'Bouillon', text: '750 ml', category: 'other', staple: true, match: ['bouillon cube'] },
      { name: 'Parmesan', quantity: 40, unit: 'g', category: 'cheese', match: FROMAGE_RAPE, optional: true },
      BEURRE_BASE,
    ],
    steps: ['Faites revenir l\'oignon émincé au beurre, ajoutez le riz et remuez 1 minute.', 'Ajoutez le bouillon chaud louche par louche en remuant, pendant 18 minutes.', 'Faites sauter les champignons à part et incorporez-les en fin de cuisson avec le fromage.'],
  },
  {
    id: 'puree-maison', title: 'Purée maison', summary: 'Onctueuse, pour accompagner viande ou poisson.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 20, difficulty: 1, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [
      { name: 'Pommes de terre', quantity: 600, unit: 'g', category: 'vegetables', match: ['pomme de terre', 'patate'] },
      { name: 'Lait', quantity: 150, unit: 'ml', category: 'dairy' },
      { name: 'Beurre', quantity: 30, unit: 'g', category: 'dairy' },
      { name: 'Muscade', text: '1 pincée', category: 'other', staple: true, optional: true },
      SEL,
    ],
    steps: ['Épluchez les pommes de terre et faites-les cuire 20 minutes à l\'eau salée.', 'Écrasez-les avec le beurre puis le lait chaud.', 'Assaisonnez de sel et de muscade.'],
  },
  {
    id: 'gratin-dauphinois', title: 'Gratin dauphinois', summary: 'Le grand classique, fondant et doré.',
    meals: ['lunch', 'dinner'], prep: 20, cook: 60, difficulty: 2, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [
      { name: 'Pommes de terre', quantity: 700, unit: 'g', category: 'vegetables', match: ['pomme de terre', 'patate'] },
      { name: 'Crème fraîche', quantity: 200, unit: 'ml', category: 'dairy', match: ['creme'] },
      { name: 'Lait', quantity: 300, unit: 'ml', category: 'dairy' },
      { name: 'Ail', quantity: 1, unit: 'piece', category: 'vegetables', match: ['gousse'] },
      SEL, POIVRE,
    ],
    steps: ['Préchauffez le four à 170 °C et frottez un plat avec l\'ail.', 'Coupez les pommes de terre en fines rondelles.', 'Disposez-les dans le plat, couvrez du mélange lait-crème assaisonné.', 'Enfournez 1 heure jusqu\'à ce que le dessus soit doré.'],
  },
  {
    id: 'croque-monsieur', title: 'Croque-monsieur', summary: 'Doré et fondant, en 15 minutes.',
    meals: ['lunch', 'dinner', 'snack'], prep: 5, cook: 10, difficulty: 1, budget: 1, tags: ['rapide', 'économique'],
    ingredients: [
      { name: 'Pain de mie', quantity: 4, unit: 'piece', category: 'starches', match: ['pain'] },
      { name: 'Jambon', quantity: 2, unit: 'piece', category: 'meat', match: ['jambon blanc'] },
      { name: 'Fromage râpé', quantity: 60, unit: 'g', category: 'cheese', match: [...FROMAGE_RAPE, 'cheddar', 'fromage'] },
      BEURRE_BASE,
    ],
    steps: ['Beurrez les tranches de pain.', 'Garnissez de jambon et de fromage, refermez.', 'Faites dorer 4 à 5 minutes par face à la poêle ou 10 minutes au four à 200 °C.'],
  },

  // ---------------------------------------------------------------- Viandes
  {
    id: 'poulet-moutarde', title: 'Poulet à la moutarde', summary: 'Une sauce crémeuse et relevée.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 20, difficulty: 1, budget: 2, tags: ['riche en protéines'],
    ingredients: [
      { name: 'Blancs de poulet', quantity: 2, unit: 'piece', category: 'meat', match: ['poulet', 'escalope de poulet', 'filet de poulet'] },
      { name: 'Crème fraîche', quantity: 150, unit: 'ml', category: 'dairy', match: ['creme'] },
      { name: 'Moutarde', text: '2 c. à soupe', category: 'canned', staple: true },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables', match: ['echalote'], optional: true },
      HUILE, SEL, POIVRE,
    ],
    steps: ['Coupez le poulet en morceaux et faites-le dorer dans l\'huile.', 'Ajoutez l\'oignon émincé et laissez fondre 3 minutes.', 'Incorporez la crème et la moutarde, laissez mijoter 10 minutes.', 'Servez avec du riz, des pâtes ou des légumes.'],
  },
  {
    id: 'poulet-roti-legumes', title: 'Poulet rôti et légumes au four', summary: 'Tout cuit ensemble sur une plaque.',
    meals: ['lunch', 'dinner'], prep: 15, cook: 40, difficulty: 1, budget: 2, tags: ['équilibré', 'riche en protéines'],
    ingredients: [
      { name: 'Cuisses de poulet', quantity: 2, unit: 'piece', category: 'meat', match: ['poulet', 'pilon'] },
      { name: 'Pommes de terre', quantity: 400, unit: 'g', category: 'vegetables', match: ['pomme de terre', 'patate'] },
      { name: 'Carottes', quantity: 3, unit: 'piece', category: 'vegetables', match: ['carotte'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables', match: ['oignon rouge'] },
      { name: 'Herbes de Provence', text: '1 c. à café', category: 'other', staple: true, match: ['thym'] },
      HUILE, SEL, POIVRE,
    ],
    steps: ['Préchauffez le four à 200 °C.', 'Coupez les légumes en morceaux et étalez-les sur une plaque avec l\'huile et les herbes.', 'Posez le poulet dessus, salez, poivrez.', 'Enfournez 40 minutes en retournant à mi-cuisson.'],
  },
  {
    id: 'boeuf-carottes', title: 'Boeuf-carottes', summary: 'Mijoté tendre, encore meilleur réchauffé.',
    meals: ['lunch', 'dinner'], prep: 20, cook: 120, difficulty: 2, budget: 2, tags: ['riche en protéines'],
    ingredients: [
      { name: 'Boeuf à braiser', quantity: 500, unit: 'g', category: 'meat', match: ['boeuf', 'paleron', 'macreuse', 'joue de boeuf'] },
      { name: 'Carottes', quantity: 6, unit: 'piece', category: 'vegetables', match: ['carotte'] },
      { name: 'Oignons', quantity: 2, unit: 'piece', category: 'vegetables', match: ['oignon'] },
      { name: 'Bouillon', text: '500 ml', category: 'other', staple: true, match: ['bouillon cube'] },
      { name: 'Thym, laurier', text: '1 bouquet', category: 'other', staple: true },
      HUILE, SEL, POIVRE,
    ],
    steps: ['Faites dorer la viande en morceaux dans une cocotte avec l\'huile.', 'Ajoutez les oignons émincés puis les carottes en rondelles.', 'Couvrez de bouillon, ajoutez les herbes et laissez mijoter 2 heures à couvert, à feu doux.'],
  },
  {
    id: 'steak-hache-poelee', title: 'Steak haché et poêlée de légumes', summary: 'Un repas complet en 20 minutes.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 12, difficulty: 1, budget: 1, tags: ['rapide', 'riche en protéines', 'équilibré'],
    ingredients: [
      { name: 'Steaks hachés', quantity: 2, unit: 'piece', category: 'meat', match: ['steak hache', 'steak'] },
      { name: 'Légumes', quantity: 400, unit: 'g', category: 'vegetables', match: ['courgette', 'poivron', 'haricots verts', 'carotte', 'brocoli', 'champignon', 'aubergine'] },
      HUILE, SEL, POIVRE,
    ],
    steps: ['Faites sauter les légumes coupés 8 à 10 minutes à feu vif avec l\'huile.', 'Faites cuire les steaks 2 à 3 minutes par face selon la cuisson souhaitée.', 'Salez, poivrez et servez.'],
  },
  {
    id: 'chili-con-carne', title: 'Chili con carne', summary: 'Généreux, pour 2 ou à congeler.',
    meals: ['lunch', 'dinner'], prep: 15, cook: 40, difficulty: 1, budget: 1, tags: ['économique', 'riche en protéines'],
    ingredients: [
      { name: 'Boeuf haché', quantity: 300, unit: 'g', category: 'meat', match: ['viande hachee', 'steak hache', 'hache'] },
      { name: 'Haricots rouges', quantity: 1, unit: 'pack', category: 'canned', match: ['haricot rouge'] },
      { name: 'Tomates concassées', quantity: 1, unit: 'pack', category: 'canned', match: ['tomate', 'pulpe', 'coulis'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables' },
      { name: 'Épices (cumin, paprika)', text: '2 c. à café', category: 'other', staple: true, match: ['cumin', 'paprika', 'chili'] },
      { name: 'Riz', quantity: 150, unit: 'g', category: 'starches', optional: true },
      HUILE, SEL,
    ],
    steps: ['Faites revenir l\'oignon puis la viande dans l\'huile.', 'Ajoutez les épices, les tomates et les haricots égouttés.', 'Laissez mijoter 30 minutes à feu doux. Servez avec du riz.'],
  },
  {
    id: 'saucisses-lentilles', title: 'Saucisses aux lentilles', summary: 'Un plat d\'hiver complet et économique.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 35, difficulty: 1, budget: 1, tags: ['économique', 'riche en protéines'],
    ingredients: [
      { name: 'Saucisses', quantity: 4, unit: 'piece', category: 'meat', match: ['saucisse', 'saucisse de toulouse', 'diots'] },
      { name: 'Lentilles', quantity: 200, unit: 'g', category: 'starches', match: ['lentille', 'lentilles vertes'] },
      { name: 'Carottes', quantity: 2, unit: 'piece', category: 'vegetables', match: ['carotte'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables' },
      { name: 'Thym, laurier', text: '1 bouquet', category: 'other', staple: true },
    ],
    steps: ['Faites dorer les saucisses dans une cocotte, réservez.', 'Faites revenir l\'oignon et les carottes en dés.', 'Ajoutez les lentilles, couvrez d\'eau (2 fois leur volume), les herbes et les saucisses.', 'Laissez cuire 30 minutes à feu doux, salez en fin de cuisson.'],
  },
  {
    id: 'escalopes-creme-champignons', title: 'Escalopes à la crème et aux champignons', summary: 'Une sauce onctueuse, prête en 20 minutes.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 15, difficulty: 1, budget: 2, tags: ['rapide', 'riche en protéines'],
    ingredients: [
      { name: 'Escalopes', quantity: 2, unit: 'piece', category: 'meat', match: ['escalope', 'escalope de dinde', 'escalope de veau', 'poulet'] },
      { name: 'Champignons', quantity: 200, unit: 'g', category: 'vegetables', match: ['champignon'] },
      { name: 'Crème fraîche', quantity: 150, unit: 'ml', category: 'dairy', match: ['creme'] },
      BEURRE_BASE, SEL, POIVRE,
    ],
    steps: ['Faites dorer les escalopes au beurre 3 minutes par face, réservez.', 'Faites sauter les champignons émincés dans la même poêle.', 'Ajoutez la crème, remettez les escalopes et laissez mijoter 5 minutes.'],
  },
  {
    id: 'quiche-lorraine', title: 'Quiche lorraine', summary: 'Le classique pour un repas ou un pique-nique.',
    meals: ['lunch', 'dinner'], prep: 15, cook: 35, difficulty: 2, budget: 1, tags: ['économique'],
    ingredients: [
      { name: 'Pâte brisée', quantity: 1, unit: 'pack', category: 'fresh', match: ['pate brisee', 'pate feuilletee', 'pate a tarte'] },
      { name: 'Lardons', quantity: 200, unit: 'g', category: 'meat', match: ['lardon', 'bacon'] },
      { name: 'Oeufs', quantity: 3, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Crème fraîche', quantity: 200, unit: 'ml', category: 'dairy', match: ['creme'] },
      { name: 'Lait', quantity: 100, unit: 'ml', category: 'dairy' },
      SEL, POIVRE,
    ],
    steps: ['Préchauffez le four à 180 °C et étalez la pâte dans un moule.', 'Faites revenir les lardons et répartissez-les sur la pâte.', 'Fouettez les oeufs, la crème et le lait, assaisonnez et versez.', 'Enfournez 35 minutes.'],
  },

  // ---------------------------------------------------------------- Poissons
  {
    id: 'saumon-papillote', title: 'Saumon en papillote', summary: 'Léger et parfumé, sans surveillance.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 20, difficulty: 1, budget: 3, tags: ['équilibré', 'riche en protéines'],
    ingredients: [
      { name: 'Pavés de saumon', quantity: 2, unit: 'piece', category: 'fish', match: ['saumon'] },
      { name: 'Courgette', quantity: 1, unit: 'piece', category: 'vegetables', match: ['courgettes', 'poireau', 'tomate', 'carotte'] },
      { name: 'Citron', quantity: 1, unit: 'piece', category: 'fruits' },
      HUILE, SEL, POIVRE,
    ],
    steps: ['Préchauffez le four à 200 °C.', 'Déposez chaque pavé sur une feuille de papier cuisson avec la courgette en fines lamelles.', 'Ajoutez une rondelle de citron, un filet d\'huile, sel et poivre, puis fermez les papillotes.', 'Enfournez 18 à 20 minutes.'],
  },
  {
    id: 'cabillaud-riz-citron', title: 'Cabillaud au citron et riz', summary: 'Un poisson blanc tout simple.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 15, difficulty: 1, budget: 2, tags: ['rapide', 'équilibré', 'riche en protéines'],
    ingredients: [
      { name: 'Filets de cabillaud', quantity: 2, unit: 'piece', category: 'fish', match: ['cabillaud', 'colin', 'merlu', 'lieu', 'poisson blanc'] },
      { name: 'Riz', quantity: 150, unit: 'g', category: 'starches' },
      { name: 'Citron', quantity: 1, unit: 'piece', category: 'fruits' },
      BEURRE_BASE, SEL, POIVRE,
    ],
    steps: ['Faites cuire le riz.', 'Faites cuire le poisson au beurre 3 à 4 minutes par face.', 'Arrosez de jus de citron, salez, poivrez et servez avec le riz.'],
  },
  {
    id: 'pates-thon-tomate', title: 'Pâtes au thon et à la tomate', summary: 'Le dépanneur du placard.',
    meals: ['lunch', 'dinner'], prep: 5, cook: 12, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'riche en protéines'],
    ingredients: [
      { name: 'Pâtes', quantity: 200, unit: 'g', category: 'starches', match: PATES },
      { name: 'Thon en boîte', quantity: 1, unit: 'pack', category: 'canned', match: ['thon'] },
      { name: 'Coulis de tomate', quantity: 250, unit: 'ml', category: 'canned', match: ['tomate', 'pulpe', 'sauce tomate', 'tomates concassees'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables', optional: true },
      HUILE, SEL, POIVRE,
    ],
    steps: ['Faites cuire les pâtes.', 'Faites revenir l\'oignon, ajoutez le coulis et le thon émietté, laissez chauffer 5 minutes.', 'Mélangez avec les pâtes.'],
  },
  {
    id: 'salade-nicoise', title: 'Salade niçoise', summary: 'Fraîche et complète.',
    meals: ['lunch', 'dinner'], prep: 15, cook: 10, difficulty: 1, budget: 2, tags: ['équilibré', 'riche en protéines'],
    ingredients: [
      { name: 'Salade', quantity: 1, unit: 'piece', category: 'vegetables', match: ['laitue', 'mesclun', 'roquette'] },
      { name: 'Tomates', quantity: 2, unit: 'piece', category: 'vegetables', match: ['tomate'] },
      { name: 'Oeufs', quantity: 2, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Thon en boîte', quantity: 1, unit: 'pack', category: 'canned', match: ['thon'] },
      { name: 'Olives', text: 'une poignée', category: 'canned', optional: true },
      HUILE, SEL,
    ],
    steps: ['Faites cuire les oeufs 9 minutes, refroidissez-les et écalez-les.', 'Disposez la salade, les tomates en quartiers, le thon, les oeufs et les olives.', 'Assaisonnez d\'huile et de sel.'],
  },

  // ---------------------------------------------------------------- Végétarien
  {
    id: 'curry-pois-chiches', title: 'Curry de pois chiches', summary: 'Végétarien, doux et parfumé.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 20, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'équilibré'],
    ingredients: [
      { name: 'Pois chiches', quantity: 1, unit: 'pack', category: 'canned', match: ['pois chiche'] },
      { name: 'Lait de coco', quantity: 200, unit: 'ml', category: 'canned', match: ['coco', 'creme de coco'] },
      { name: 'Tomates concassées', quantity: 1, unit: 'pack', category: 'canned', match: ['tomate', 'pulpe', 'coulis'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables' },
      { name: 'Épinards', quantity: 100, unit: 'g', category: 'vegetables', optional: true, match: ['epinard', 'pousses d epinard'] },
      { name: 'Curry', text: '2 c. à café', category: 'other', staple: true },
      { name: 'Riz', quantity: 150, unit: 'g', category: 'starches', optional: true },
      HUILE,
    ],
    steps: ['Faites revenir l\'oignon avec le curry dans l\'huile.', 'Ajoutez les tomates, le lait de coco et les pois chiches égouttés.', 'Laissez mijoter 15 minutes, ajoutez les épinards en fin de cuisson.', 'Servez avec du riz.'],
  },
  {
    id: 'ratatouille', title: 'Ratatouille', summary: 'Les légumes du soleil, mijotés.',
    meals: ['lunch', 'dinner'], prep: 20, cook: 45, difficulty: 1, budget: 1, tags: ['végétarien', 'équilibré', 'anti-gaspi'],
    ingredients: [
      { name: 'Courgettes', quantity: 2, unit: 'piece', category: 'vegetables', match: ['courgette'] },
      { name: 'Aubergine', quantity: 1, unit: 'piece', category: 'vegetables', match: ['aubergines'] },
      { name: 'Poivron', quantity: 1, unit: 'piece', category: 'vegetables', match: ['poivrons'] },
      { name: 'Tomates', quantity: 3, unit: 'piece', category: 'vegetables', match: ['tomate'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables' },
      { name: 'Herbes de Provence', text: '1 c. à café', category: 'other', staple: true, match: ['thym'] },
      HUILE, SEL,
    ],
    steps: ['Coupez tous les légumes en dés.', 'Faites revenir l\'oignon, puis l\'aubergine, les poivrons et les courgettes 10 minutes.', 'Ajoutez les tomates et les herbes, couvrez et laissez mijoter 35 minutes.'],
  },
  {
    id: 'soupe-legumes', title: 'Soupe de légumes', summary: 'Idéale pour écouler les légumes fatigués.',
    meals: ['lunch', 'dinner'], prep: 15, cook: 30, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'équilibré', 'anti-gaspi'],
    ingredients: [
      { name: 'Légumes', quantity: 600, unit: 'g', category: 'vegetables', match: ['carotte', 'poireau', 'courgette', 'pomme de terre', 'potiron', 'butternut', 'navet', 'celeri', 'brocoli'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables' },
      { name: 'Bouillon', text: '1 litre', category: 'other', staple: true, match: ['bouillon cube'] },
      { name: 'Crème fraîche', text: '2 c. à soupe', category: 'dairy', optional: true, match: ['creme'] },
      SEL, POIVRE,
    ],
    steps: ['Coupez les légumes et l\'oignon en morceaux.', 'Couvrez-les de bouillon et laissez cuire 25 minutes.', 'Mixez, rectifiez l\'assaisonnement et ajoutez la crème.'],
  },
  {
    id: 'tarte-legumes-chevre', title: 'Tarte aux légumes et au chèvre', summary: 'Colorée, chaude ou froide.',
    meals: ['lunch', 'dinner'], prep: 15, cook: 30, difficulty: 2, budget: 2, tags: ['végétarien'],
    ingredients: [
      { name: 'Pâte feuilletée', quantity: 1, unit: 'pack', category: 'fresh', match: ['pate feuilletee', 'pate brisee', 'pate a tarte'] },
      { name: 'Courgette', quantity: 1, unit: 'piece', category: 'vegetables', match: ['courgettes', 'tomate', 'poivron', 'poireau'] },
      { name: 'Fromage de chèvre', quantity: 1, unit: 'piece', category: 'cheese', match: ['chevre', 'buche de chevre', 'feta'] },
      { name: 'Oeufs', quantity: 2, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Crème fraîche', quantity: 150, unit: 'ml', category: 'dairy', match: ['creme'] },
      SEL, POIVRE,
    ],
    steps: ['Préchauffez le four à 190 °C et étalez la pâte dans un moule.', 'Disposez les légumes en fines rondelles et le chèvre en tranches.', 'Versez le mélange oeufs-crème assaisonné.', 'Enfournez 30 minutes.'],
  },
  {
    id: 'shakshuka', title: 'Oeufs pochés à la tomate (shakshuka)', summary: 'Épicé et convivial, à saucer.',
    meals: ['breakfast', 'lunch', 'dinner'], prep: 10, cook: 20, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien', 'riche en protéines'],
    ingredients: [
      { name: 'Oeufs', quantity: 4, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Tomates concassées', quantity: 1, unit: 'pack', category: 'canned', match: ['tomate', 'pulpe', 'coulis'] },
      { name: 'Poivron', quantity: 1, unit: 'piece', category: 'vegetables', match: ['poivrons'] },
      { name: 'Oignon', quantity: 1, unit: 'piece', category: 'vegetables' },
      { name: 'Cumin, paprika', text: '1 c. à café', category: 'other', staple: true, match: ['cumin', 'paprika'] },
      HUILE, SEL,
    ],
    steps: ['Faites revenir l\'oignon et le poivron émincés avec les épices.', 'Ajoutez les tomates et laissez réduire 10 minutes.', 'Creusez 4 puits, cassez-y les oeufs, couvrez et laissez cuire 6 à 8 minutes.'],
  },
  {
    id: 'galettes-legumes', title: 'Galettes de légumes râpés', summary: 'Croustillantes, parfaites pour les restes.',
    meals: ['lunch', 'dinner', 'snack'], prep: 15, cook: 15, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'anti-gaspi'],
    ingredients: [
      { name: 'Légumes à râper', quantity: 400, unit: 'g', category: 'vegetables', match: ['courgette', 'carotte', 'pomme de terre', 'patate douce'] },
      { name: 'Oeufs', quantity: 2, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Farine', quantity: 40, unit: 'g', category: 'starches', staple: true },
      { name: 'Fromage râpé', quantity: 40, unit: 'g', category: 'cheese', match: FROMAGE_RAPE, optional: true },
      HUILE, SEL, POIVRE,
    ],
    steps: ['Râpez les légumes et pressez-les pour retirer l\'eau.', 'Mélangez avec les oeufs, la farine et le fromage, assaisonnez.', 'Formez des galettes et faites-les dorer 3 minutes par face dans l\'huile.'],
  },
  {
    id: 'salade-lentilles', title: 'Salade de lentilles', summary: 'Rassasiante et économique.',
    meals: ['lunch', 'dinner'], prep: 10, cook: 25, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'équilibré', 'riche en protéines'],
    ingredients: [
      { name: 'Lentilles', quantity: 150, unit: 'g', category: 'starches', match: ['lentille', 'lentilles vertes'] },
      { name: 'Carotte', quantity: 1, unit: 'piece', category: 'vegetables', match: ['carottes'] },
      { name: 'Échalote', quantity: 1, unit: 'piece', category: 'vegetables', match: ['oignon', 'oignon rouge'] },
      { name: 'Vinaigre', text: '1 c. à soupe', category: 'other', staple: true },
      { name: 'Persil', text: 'quelques brins', category: 'vegetables', optional: true },
      HUILE, SEL,
    ],
    steps: ['Faites cuire les lentilles 25 minutes dans l\'eau non salée, égouttez.', 'Ajoutez la carotte râpée et l\'échalote émincée.', 'Assaisonnez de vinaigre, d\'huile, de sel et de persil.'],
  },
  {
    id: 'croque-legumes-mozzarella', title: 'Pizza express sur pain', summary: 'Pour les envies de pizza en 15 minutes.',
    meals: ['lunch', 'dinner', 'snack'], prep: 5, cook: 10, difficulty: 1, budget: 1, tags: ['rapide', 'économique', 'végétarien', 'anti-gaspi'],
    ingredients: [
      { name: 'Pain', quantity: 4, unit: 'piece', category: 'starches', match: ['baguette', 'pain de campagne', 'pain de mie'] },
      { name: 'Sauce tomate', quantity: 100, unit: 'ml', category: 'canned', match: ['tomate', 'coulis', 'pulpe'] },
      { name: 'Mozzarella', quantity: 1, unit: 'piece', category: 'cheese', match: ['fromage rape', 'emmental'] },
      { name: 'Légumes', quantity: 100, unit: 'g', category: 'vegetables', optional: true, match: ['champignon', 'poivron', 'tomate', 'courgette'] },
      { name: 'Origan', text: '1 pincée', category: 'other', staple: true, optional: true },
    ],
    steps: ['Préchauffez le four à 220 °C.', 'Tartinez le pain de sauce tomate, ajoutez les légumes et la mozzarella.', 'Enfournez 8 à 10 minutes.'],
  },

  // ---------------------------------------------------------------- Desserts
  {
    id: 'compote-pommes', title: 'Compote de pommes', summary: 'Pour les pommes un peu fatiguées.',
    meals: ['dessert', 'snack', 'breakfast'], prep: 10, cook: 20, difficulty: 1, budget: 1, tags: ['économique', 'végétarien', 'anti-gaspi'],
    ingredients: [
      { name: 'Pommes', quantity: 4, unit: 'piece', category: 'fruits', match: ['pomme', 'poire'] },
      { name: 'Sucre', text: '1 c. à soupe', category: 'other', staple: true, optional: true },
      { name: 'Cannelle', text: '1 pincée', category: 'other', staple: true, optional: true },
    ],
    steps: ['Épluchez les pommes et coupez-les en morceaux.', 'Faites-les cuire à couvert avec un fond d\'eau 20 minutes.', 'Écrasez à la fourchette, sucrez et ajoutez la cannelle selon le goût.'],
  },
  {
    id: 'gateau-yaourt', title: 'Gâteau au yaourt', summary: 'La recette mesurée avec le pot de yaourt.',
    meals: ['dessert', 'snack'], prep: 10, cook: 35, difficulty: 1, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [
      { name: 'Yaourt nature', quantity: 1, unit: 'piece', category: 'dairy', match: ['yaourt'] },
      { name: 'Oeufs', quantity: 3, unit: 'piece', category: 'fresh', match: ['oeuf'] },
      { name: 'Farine', text: '3 pots', category: 'starches', staple: true },
      { name: 'Sucre', text: '2 pots', category: 'other', staple: true },
      { name: 'Huile', text: '1/2 pot', category: 'other', staple: true },
      { name: 'Levure chimique', text: '1 sachet', category: 'other', staple: true },
    ],
    steps: ['Préchauffez le four à 180 °C.', 'Mélangez le yaourt, les oeufs et le sucre, puis la farine, la levure et l\'huile.', 'Versez dans un moule beurré et enfournez 35 minutes.'],
  },
  {
    id: 'crumble-fruits', title: 'Crumble aux fruits', summary: 'Croustillant dessus, fondant dessous.',
    meals: ['dessert'], prep: 15, cook: 30, difficulty: 1, budget: 1, tags: ['végétarien', 'anti-gaspi'],
    ingredients: [
      { name: 'Fruits', quantity: 500, unit: 'g', category: 'fruits', match: ['pomme', 'poire', 'prune', 'abricot', 'peche', 'fruits rouges', 'rhubarbe'] },
      { name: 'Farine', quantity: 100, unit: 'g', category: 'starches', staple: true },
      { name: 'Beurre', quantity: 80, unit: 'g', category: 'dairy' },
      { name: 'Sucre', quantity: 80, unit: 'g', category: 'other', staple: true },
    ],
    steps: ['Préchauffez le four à 180 °C.', 'Coupez les fruits en morceaux dans un plat.', 'Sablez du bout des doigts la farine, le sucre et le beurre froid, puis répartissez sur les fruits.', 'Enfournez 30 minutes.'],
  },
  {
    id: 'riz-au-lait', title: 'Riz au lait', summary: 'Le dessert doux des grands-mères.',
    meals: ['dessert', 'snack'], prep: 5, cook: 40, difficulty: 1, budget: 1, tags: ['économique', 'végétarien'],
    ingredients: [
      { name: 'Riz rond', quantity: 80, unit: 'g', category: 'starches', match: ['riz'] },
      { name: 'Lait', quantity: 700, unit: 'ml', category: 'dairy' },
      { name: 'Sucre', quantity: 60, unit: 'g', category: 'other', staple: true },
      { name: 'Vanille', text: '1 gousse ou 1 sachet', category: 'other', staple: true, optional: true },
    ],
    steps: ['Portez le lait à ébullition avec la vanille.', 'Ajoutez le riz et laissez cuire 35 minutes à feu très doux en remuant souvent.', 'Sucrez en fin de cuisson et laissez tiédir.'],
  },
  {
    id: 'banane-chocolat-poelee', title: 'Bananes poêlées au chocolat', summary: 'Un dessert minute.',
    meals: ['dessert'], prep: 5, cook: 5, difficulty: 1, budget: 1, tags: ['rapide', 'végétarien', 'anti-gaspi'],
    ingredients: [
      { name: 'Bananes', quantity: 2, unit: 'piece', category: 'fruits', match: ['banane'] },
      { name: 'Chocolat', quantity: 40, unit: 'g', category: 'other', match: ['chocolat noir', 'chocolat au lait', 'pepites'] },
      BEURRE_BASE,
    ],
    steps: ['Coupez les bananes en deux dans la longueur.', 'Faites-les dorer 2 minutes par face au beurre.', 'Servez nappées de chocolat fondu.'],
  },
];
