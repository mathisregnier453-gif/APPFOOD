// Photos réelles des recettes du catalogue, choisies une à une sur Unsplash
// (licence Unsplash : usage commercial gratuit). Affichées depuis Unsplash
// (règle de l'API), puis gardées en cache sur le téléphone.
// Généré à partir de la sélection — ne pas éditer à la main.
export interface RecipePhoto { uri: string; author: string; authorUrl: string }

/** Lien vers Unsplash avec les paramètres de provenance demandés par Unsplash. */
export function unsplashLink(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=sauge&utm_medium=referral`;
}

export const RECIPE_PHOTOS: Record<string, RecipePhoto> = {
  'Omelette aux fines herbes': {
    uri: 'https://images.unsplash.com/photo-1668283653825-37b80f055b05?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8ZnJlbmNoJTIwb21lbGV0dGV8ZW58MXwwfHx8MTc5NTA5NDg1Nnww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Caroline Vass',
    authorUrl: 'https://unsplash.com/@bonbonrebel',
  },
  'Pancakes': {
    uri: 'https://images.unsplash.com/photo-1650134973809-d8c3a2da59ba?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8cGFuY2FrZXMlMjBzdGFja3xlbnwxfDB8fHwxNzk1MDk0ODU4fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Amber Fisher',
    authorUrl: 'https://unsplash.com/@lindsaysworld',
  },
  'Porridge à la banane': {
    uri: 'https://images.unsplash.com/photo-1642339800099-921df1a0a958?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8b2F0bWVhbCUyMGJhbmFuYSUyMGJvd2x8ZW58MXwwfHx8MTc5NTA5NDg1OXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Aasiya Khan',
    authorUrl: 'https://unsplash.com/@aasiyakhan',
  },
  'Pain perdu': {
    uri: 'https://images.unsplash.com/photo-1588484588657-0bbbee05132f?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8ZnJlbmNoJTIwdG9hc3R8ZW58MXwwfHx8MTc5NTA5NDg2MXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Omar Al-Ghosson',
    authorUrl: 'https://unsplash.com/@sci_fi_superfly',
  },
  'Bol yaourt, fruits et céréales': {
    uri: 'https://images.unsplash.com/photo-1633104060731-32143505bacc?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NHx8eW9ndXJ0JTIwZ3Jhbm9sYSUyMGJvd2x8ZW58MXwwfHx8MTc5NTA5NDg2Mnww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Shayna Douglas',
    authorUrl: 'https://unsplash.com/@itsmaemedia',
  },
  'Pâtes à la carbonara': {
    uri: 'https://images.unsplash.com/photo-1633337474564-1d9478ca4e2e?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8c3BhZ2hldHRpJTIwY2FyYm9uYXJhfGVufDF8MHx8fDE3OTUwOTQ4NjN8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Rob Wicks',
    authorUrl: 'https://unsplash.com/@robwicks',
  },
  'Pâtes à la tomate et au basilic': {
    uri: 'https://images.unsplash.com/photo-1727533688337-08bd8d78a03a?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8c3BhZ2hldHRpJTIwdG9tYXRvJTIwYmFzaWx8ZW58MXwwfHx8MTc5NTA5NDg2NHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Claudio Schwarz',
    authorUrl: 'https://unsplash.com/@purzlbaum',
  },
  'Gratin de pâtes au jambon': {
    uri: 'https://images.unsplash.com/photo-1654780105295-9227206f11ec?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8YmFrZWQlMjBwYXN0YSUyMGNoZWVzZXxlbnwxfDB8fHwxNzk1MDk0ODY2fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'David Trinks',
    authorUrl: 'https://unsplash.com/@dtrinksrph',
  },
  'Riz sauté aux légumes et à l\'oeuf': {
    uri: 'https://images.unsplash.com/photo-1609570324378-ec0c4c9b6ba8?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8ZnJpZWQlMjByaWNlJTIwZWdnfGVufDF8MHx8fDE3OTUwOTQ4Njd8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Jay Nlper',
    authorUrl: 'https://unsplash.com/@itworkonline',
  },
  'Risotto aux champignons': {
    uri: 'https://images.unsplash.com/photo-1662114757324-fb95be6dceaf?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NXx8bXVzaHJvb20lMjByaXNvdHRvfGVufDF8MHx8fDE3OTUwOTQ4Njh8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Yu Hosoi',
    authorUrl: 'https://unsplash.com/@yu_grino',
  },
  'Purée maison': {
    uri: 'https://images.unsplash.com/photo-1707616954324-99c89a78a20d?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8bWFzaGVkJTIwcG90YXRvZXN8ZW58MXwwfHx8MTc5NTA5NDg3MHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'You Le',
    authorUrl: 'https://unsplash.com/@le_y0u',
  },
  'Gratin dauphinois': {
    uri: 'https://images.unsplash.com/photo-1710024893533-3e3fc8bb6971?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NXx8cG90YXRvJTIwZ3JhdGlufGVufDF8MHx8fDE3OTUwOTQ4NzF8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Rafael Rodrigues',
    authorUrl: 'https://unsplash.com/@rrodriguesim',
  },
  'Croque-monsieur': {
    uri: 'https://images.unsplash.com/photo-1531664412848-9610afed156c?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8Y3JvcXVlJTIwbW9uc2lldXJ8ZW58MXwwfHx8MTc5NTA5NDg3Mnww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Jonathan Pielmayer',
    authorUrl: 'https://unsplash.com/@jonathanpielmayer',
  },
  'Poulet à la moutarde': {
    uri: 'https://images.unsplash.com/photo-1784902540622-10033f7047bc?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8Y2hpY2tlbiUyMG11c3RhcmQlMjBzYXVjZXxlbnwxfDB8fHwxNzk1MDk0ODczfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Zayed Ahmed Zadu',
    authorUrl: 'https://unsplash.com/@zayed_ahmed_zadu',
  },
  'Poulet rôti et légumes au four': {
    uri: 'https://images.unsplash.com/photo-1700956015209-4735e8bd9163?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NXx8cm9hc3QlMjBjaGlja2VuJTIwdmVnZXRhYmxlc3xlbnwxfDB8fHwxNzk1MDk0ODc0fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'MealPro',
    authorUrl: 'https://unsplash.com/@mealpro',
  },
  'Boeuf-carottes': {
    uri: 'https://images.unsplash.com/photo-1664339030060-191ccb53b5d2?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8YmVlZiUyMHN0ZXclMjBjYXJyb3RzfGVufDF8MHx8fDE3OTUwOTQ4NzV8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Holly Spangler',
    authorUrl: 'https://unsplash.com/@h_spangler',
  },
  'Steak haché et poêlée de légumes': {
    uri: 'https://images.unsplash.com/photo-1673646961402-df39d8c32448?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NHx8Z3JvdW5kJTIwYmVlZiUyMHBhdHR5JTIwcGxhdGUlMjB2ZWdldGFibGVzfGVufDF8MHx8fDE3OTUxMDIxMjZ8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Natalia Gusakova',
    authorUrl: 'https://unsplash.com/@nataliaraylenegusakova',
  },
  'Chili con carne': {
    uri: 'https://images.unsplash.com/photo-1658308766948-01c85ade2737?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8Y2hpbGklMjBjb24lMjBjYXJuZXxlbnwxfDB8fHwxNzk1MDk0ODc4fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Svitlana',
    authorUrl: 'https://unsplash.com/@kekse_und_ich',
  },
  'Saucisses aux lentilles': {
    uri: 'https://images.unsplash.com/photo-1664339031004-9cfdf88b8017?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8c2F1c2FnZSUyMGxlbnRpbCUyMHN0ZXd8ZW58MXwwfHx8MTc5NTEwMjEyN3ww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Holly Spangler',
    authorUrl: 'https://unsplash.com/@h_spangler',
  },
  'Escalopes à la crème et aux champignons': {
    uri: 'https://images.unsplash.com/photo-1784902540709-082442918309?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8Y2hpY2tlbiUyMG11c2hyb29tJTIwY3JlYW0lMjBzYXVjZXxlbnwxfDB8fHwxNzk1MDk0ODgyfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Zayed Ahmed Zadu',
    authorUrl: 'https://unsplash.com/@zayed_ahmed_zadu',
  },
  'Quiche lorraine': {
    uri: 'https://images.unsplash.com/photo-1456014673271-90b7fddf2eea?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8cXVpY2hlJTIwbG9ycmFpbmV8ZW58MXwwfHx8MTc5NTA5NDg4NXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Timothy Muza',
    authorUrl: 'https://unsplash.com/@timothymuza',
  },
  'Saumon en papillote': {
    uri: 'https://images.unsplash.com/photo-1649366095449-128ddc5ac76f?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8YmFrZWQlMjBzYWxtb24lMjBsZW1vbnxlbnwxfDB8fHwxNzk1MDk0ODg3fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Hyeonyoung Yang',
    authorUrl: 'https://unsplash.com/@daisylovesfilmgrain',
  },
  'Cabillaud au citron et riz': {
    uri: 'https://images.unsplash.com/photo-1614549099339-729737b3cfd9?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8Y29kJTIwZmlsbGV0JTIwcmljZXxlbnwxfDB8fHwxNzk1MDk0ODg4fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'David B Townsend',
    authorUrl: 'https://unsplash.com/@dbtownsend',
  },
  'Pâtes au thon et à la tomate': {
    uri: 'https://images.unsplash.com/photo-1695742434600-e0f59629d2bb?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8cGFzdGElMjB0dW5hJTIwdG9tYXRvfGVufDF8MHx8fDE3OTUwOTQ4OTF8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Jas Rolyn',
    authorUrl: 'https://unsplash.com/@jasrolyn',
  },
  'Salade niçoise': {
    uri: 'https://images.unsplash.com/photo-1621634892819-80f7874c96dd?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8bmljb2lzZSUyMHNhbGFkfGVufDF8MHx8fDE3OTUwOTQ4OTJ8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Kelly Visel',
    authorUrl: 'https://unsplash.com/@kellyvisel',
  },
  'Curry de pois chiches': {
    uri: 'https://images.unsplash.com/photo-1543338861-24992308962f?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8Y2hpY2twZWElMjBjdXJyeXxlbnwxfDB8fHwxNzk1MDk0ODk0fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Hermes Rivera',
    authorUrl: 'https://unsplash.com/@hermez777',
  },
  'Ratatouille': {
    uri: 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8cmF0YXRvdWlsbGV8ZW58MXwwfHx8MTc5NTA5NDg5NXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'amirali mirhashemian',
    authorUrl: 'https://unsplash.com/@amir_v_ali',
  },
  'Soupe de légumes': {
    uri: 'https://images.unsplash.com/photo-1643786661490-966f1877effa?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8dmVnZXRhYmxlJTIwc291cHxlbnwxfDB8fHwxNzk1MDk0ODk2fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Elena Leya',
    authorUrl: 'https://unsplash.com/@foodistika',
  },
  'Tarte aux légumes et au chèvre': {
    uri: 'https://images.unsplash.com/photo-1571507688058-9e99c451c516?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8dmVnZXRhYmxlJTIwdGFydCUyMGdvYXQlMjBjaGVlc2V8ZW58MXwwfHx8MTc5NTA5NDg5N3ww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Rafael Dios',
    authorUrl: 'https://unsplash.com/@rafadios',
  },
  'Oeufs pochés à la tomate (shakshuka)': {
    uri: 'https://images.unsplash.com/photo-1582492710145-d723e0a219f8?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8c2hha3NodWthfGVufDF8MHx8fDE3OTUwOTQ4OTl8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'amirali mirhashemian',
    authorUrl: 'https://unsplash.com/@amir_v_ali',
  },
  'Galettes de légumes râpés': {
    uri: 'https://images.unsplash.com/photo-1678684277720-8032257415bc?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8dmVnZXRhYmxlJTIwZnJpdHRlcnN8ZW58MXwwfHx8MTc5NTA5NDkwMHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Natalia Gusakova',
    authorUrl: 'https://unsplash.com/@nataliaraylenegusakova',
  },
  'Salade de lentilles': {
    uri: 'https://images.unsplash.com/photo-1676976198166-0d806df0d0ef?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8bGVudGlsJTIwc2FsYWQlMjBib3dsfGVufDF8MHx8fDE3OTUxMDIxMjl8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Kashish Lamba',
    authorUrl: 'https://unsplash.com/@drunkenchimp',
  },
  'Pizza express sur pain': {
    uri: 'https://images.unsplash.com/photo-1648711717590-7cbae3ed089e?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8b3BlbiUyMHNhbmR3aWNoJTIwbW96emFyZWxsYSUyMHRvYXN0fGVufDF8MHx8fDE3OTUwOTQ5MDN8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Pat Moin',
    authorUrl: 'https://unsplash.com/@patsn',
  },
  'Compote de pommes': {
    uri: 'https://images.unsplash.com/photo-1573729065599-a8d4bd3bad96?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NXx8YXBwbGVzYXVjZXxlbnwxfDB8fHwxNzk1MDk0OTA1fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Megumi Nachev',
    authorUrl: 'https://unsplash.com/@meguminachev',
  },
  'Gâteau au yaourt': {
    uri: 'https://images.unsplash.com/photo-1635341814284-c0d35d542211?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8eW9ndXJ0JTIwY2FrZXxlbnwxfDB8fHwxNzk1MDk0OTA2fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Tetiana Padurets',
    authorUrl: 'https://unsplash.com/@tetianapadurets',
  },
  'Crumble aux fruits': {
    uri: 'https://images.unsplash.com/photo-1769434128988-8e216eda17ea?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8ZnJ1aXQlMjBjcnVtYmxlfGVufDF8MHx8fDE3OTUwOTQ5MDh8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Mila',
    authorUrl: 'https://unsplash.com/@imoflow_me',
  },
  'Riz au lait': {
    uri: 'https://images.unsplash.com/photo-1590055619273-44b5b6ce52e8?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8cmljZSUyMHB1ZGRpbmd8ZW58MXwwfHx8MTc5NTA5NDkxMHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Rasmus Gundorff Sæderup',
    authorUrl: 'https://unsplash.com/@rasmusgs',
  },
  'Bananes poêlées au chocolat': {
    uri: 'https://images.unsplash.com/photo-1657047869582-591602f79a7a?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8Y2FyYW1lbGl6ZWQlMjBiYW5hbmElMjBjaG9jb2xhdGV8ZW58MXwwfHx8MTc5NTA5NDkxMXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Mikey Frost',
    authorUrl: 'https://unsplash.com/@frostyfilmsandphoto',
  },
  'Crêpes': {
    uri: 'https://images.unsplash.com/photo-1515467837915-15c4777ba46a?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8Y3JlcGVzfGVufDF8MHx8fDE3OTUwOTQ5MTN8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Todd Cravens',
    authorUrl: 'https://unsplash.com/@toddcravens',
  },
  'Oeufs brouillés crémeux': {
    uri: 'https://images.unsplash.com/photo-1733105666420-729679827ba1?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8c2NyYW1ibGVkJTIwZWdncyUyMHRvYXN0fGVufDF8MHx8fDE3OTUwOTQ5MTR8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Tadahiro Higuchi',
    authorUrl: 'https://unsplash.com/@tad_higuchi',
  },
  'Tartines avocat et oeuf': {
    uri: 'https://images.unsplash.com/photo-1613769049987-b31b641f25b1?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8YXZvY2FkbyUyMHRvYXN0JTIwZWdnfGVufDF8MHx8fDE3OTUwOTQ5MTV8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'David B Townsend',
    authorUrl: 'https://unsplash.com/@dbtownsend',
  },
  'Smoothie aux fruits': {
    uri: 'https://images.unsplash.com/photo-1622597468620-656aa1f981ea?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8ZnJ1aXQlMjBzbW9vdGhpZXxlbnwxfDB8fHwxNzk1MDk0OTE2fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Jugoslocos',
    authorUrl: 'https://unsplash.com/@jugoslocos',
  },
  'Oeufs à la coque et mouillettes': {
    uri: 'https://images.unsplash.com/photo-1627737662882-da8a46ac582e?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8c29mdCUyMGJvaWxlZCUyMGVnZ3xlbnwxfDB8fHwxNzk1MDk0OTE3fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Rasa Kasparaviciene',
    authorUrl: 'https://unsplash.com/@gervele',
  },
  'Hachis parmentier': {
    uri: 'https://images.unsplash.com/photo-1696935257293-9ec4f03074a1?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8c2hlcGhlcmRzJTIwcGllfGVufDF8MHx8fDE3OTUwOTQ5MTh8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'The Fry Family Food Co.',
    authorUrl: 'https://unsplash.com/@fryfamilyfoodco',
  },
  'Spaghetti bolognaise': {
    uri: 'https://images.unsplash.com/photo-1622973536968-3ead9e780960?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8c3BhZ2hldHRpJTIwYm9sb2duZXNlfGVufDF8MHx8fDE3OTUwOTQ5MTl8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Homescreenify',
    authorUrl: 'https://unsplash.com/@homescreenify',
  },
  'Lasagnes à la bolognaise': {
    uri: 'https://images.unsplash.com/photo-1709429790175-b02bb1b19207?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8bGFzYWduZXxlbnwxfDB8fHwxNzk1MDk0OTIwfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Emanuel Ekström',
    authorUrl: 'https://unsplash.com/@emanuelekstrom',
  },
  'Boulettes à la sauce tomate': {
    uri: 'https://images.unsplash.com/photo-1565086869529-8c7802cca7a0?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8bWVhdGJhbGxzJTIwdG9tYXRvJTIwc2F1Y2V8ZW58MXwwfHx8MTc5NTA5NDkyMXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Fidel Fernando',
    authorUrl: 'https://unsplash.com/@fifernando',
  },
  'Poulet au curry et lait de coco': {
    uri: 'https://images.unsplash.com/photo-1697155406127-76096502d69d?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NHx8Y2hpY2tlbiUyMGNvY29udXQlMjBjdXJyeXxlbnwxfDB8fHwxNzk1MDk4NjIzfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Rashpal Singh',
    authorUrl: 'https://unsplash.com/@rashpalsingh',
  },
  'Poulet basquaise': {
    uri: 'https://images.unsplash.com/photo-1612547945552-8782fa60a8e8?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8Y2hpY2tlbiUyMHBlcHBlcnMlMjBzdGV3fGVufDF8MHx8fDE3OTUwOTg2MjV8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'logan jeffrey',
    authorUrl: 'https://unsplash.com/@foodjetsexpress',
  },
  'Poulet au citron et aux herbes': {
    uri: 'https://images.unsplash.com/photo-1615557960916-5f4791effe9d?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8bGVtb24lMjBoZXJiJTIwY2hpY2tlbnxlbnwxfDB8fHwxNzk1MDk4NjI3fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Cisco Lin',
    authorUrl: 'https://unsplash.com/@cok3nosugar',
  },
  'Endives au jambon': {
    uri: 'https://images.unsplash.com/photo-1647713361418-d54e7d9fb295?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NHx8ZW5kaXZlJTIwZ3JhdGlufGVufDF8MHx8fDE3OTUwOTg2Mjh8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Belle Lee',
    authorUrl: 'https://unsplash.com/@belle_ell',
  },
  'Tartiflette': {
    uri: 'https://images.unsplash.com/photo-1723473623397-05a40f0329b3?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8cG90YXRvJTIwY2hlZXNlJTIwYmFrZXxlbnwxfDB8fHwxNzk1MTAyMTMwfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Emma Miller',
    authorUrl: 'https://unsplash.com/@littlegemstudio',
  },
  'Côtes de porc aux pommes': {
    uri: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8cG9yayUyMGNob3BzJTIwYXBwbGVzfGVufDF8MHx8fDE3OTUwOTg2MzF8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Alex Munsell',
    authorUrl: 'https://unsplash.com/@alexmunsell',
  },
  'Wraps au poulet': {
    uri: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8Y2hpY2tlbiUyMHdyYXB8ZW58MXwwfHx8MTc5NTA5ODYzNHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Alexander Mils',
    authorUrl: 'https://unsplash.com/@alexandermils',
  },
  'Burgers maison': {
    uri: 'https://images.unsplash.com/photo-1586816001966-79b736744398?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NXx8aG9tZW1hZGUlMjBidXJnZXJ8ZW58MXwwfHx8MTc5NTA5ODYzNXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'mafe estudio',
    authorUrl: 'https://unsplash.com/@mafe_estudio',
  },
  'Fajitas au boeuf et aux poivrons': {
    uri: 'https://images.unsplash.com/photo-1636552550485-d18a8ca38daf?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NXx8ZmFqaXRhc3xlbnwxfDB8fHwxNzk1MDk4NjM2fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'doo',
    authorUrl: 'https://unsplash.com/@designer_doo',
  },
  'Porc au caramel': {
    uri: 'https://images.unsplash.com/photo-1623130211838-f63fd3a67053?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8Y2FyYW1lbCUyMHBvcmslMjBiZWxseXxlbnwxfDB8fHwxNzk1MDk4NjM4fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Amanda Lim',
    authorUrl: 'https://unsplash.com/@mandimelanie',
  },
  'Crevettes sautées à l\'ail': {
    uri: 'https://images.unsplash.com/photo-1659951226926-a75791782250?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8Z2FybGljJTIwc2hyaW1wfGVufDF8MHx8fDE3OTUwOTg2Mzl8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Durenne Loris',
    authorUrl: 'https://unsplash.com/@abstra_be',
  },
  'Moules marinières': {
    uri: 'https://images.unsplash.com/photo-1600265721436-734abbfe2137?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8bXVzc2VscyUyMHBvdHxlbnwxfDB8fHwxNzk1MTAyMTMxfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Nikolay Smeh',
    authorUrl: 'https://unsplash.com/@nikolay_smeh',
  },
  'Pâtes au saumon et à la crème': {
    uri: 'https://images.unsplash.com/photo-1750396628434-ba9a3e1a265c?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8c2FsbW9uJTIwcGFzdGF8ZW58MXwwfHx8MTc5NTA5ODY0MXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Huy van',
    authorUrl: 'https://unsplash.com/@hvan01611',
  },
  'Poisson pané maison': {
    uri: 'https://images.unsplash.com/photo-1559423131-83a712a5603c?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NHx8YnJlYWRlZCUyMGZpc2glMjBmaWxsZXR8ZW58MXwwfHx8MTc5NTA5ODY0M3ww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Komal',
    authorUrl: 'https://unsplash.com/@foodmylifeline',
  },
  'Cabillaud sur fondue de poireaux': {
    uri: 'https://images.unsplash.com/photo-1785800930168-2aab343af264?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8d2hpdGUlMjBmaXNoJTIwZmlsbGV0JTIwcGxhdGV8ZW58MXwwfHx8MTc5NTEwMjEzNHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'David B Townsend',
    authorUrl: 'https://unsplash.com/@dbtownsend',
  },
  'Rillettes de thon': {
    uri: 'https://images.unsplash.com/photo-1730495116887-889d1c49336c?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8dHVuYSUyMGRpcCUyMHRvYXN0fGVufDF8MHx8fDE3OTUwOTg2NDZ8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Gennady Zakharin',
    authorUrl: 'https://unsplash.com/@gennady107',
  },
  'Gratin de chou-fleur': {
    uri: 'https://images.unsplash.com/photo-1613478223396-56dee75454ba?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8Y2F1bGlmbG93ZXIlMjBncmF0aW58ZW58MXwwfHx8MTc5NTA5ODY0N3ww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Mateusz Feliksik',
    authorUrl: 'https://unsplash.com/@mateusz_feliksik',
  },
  'Velouté de potiron': {
    uri: 'https://images.unsplash.com/photo-1530734575165-ce39d996fbaa?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NHx8cHVtcGtpbiUyMHNvdXB8ZW58MXwwfHx8MTc5NTA5ODY0OHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Jade Aucamp',
    authorUrl: 'https://unsplash.com/@jadeaucamp',
  },
  'Soupe poireaux-pommes de terre': {
    uri: 'https://images.unsplash.com/photo-1616501268826-ee9731c915d4?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8bGVlayUyMHBvdGF0byUyMHNvdXB8ZW58MXwwfHx8MTc5NTA5ODY1MHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Julia Kicova',
    authorUrl: 'https://unsplash.com/@justjullietta',
  },
  'Dahl de lentilles corail': {
    uri: 'https://images.unsplash.com/photo-1627366422957-3efa9c6df0fc?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8ZGFsJTIwY3VycnklMjBib3dsfGVufDF8MHx8fDE3OTUxMDIxMzR8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Yubraj Timsina',
    authorUrl: 'https://unsplash.com/@yubraj2055',
  },
  'Tian de légumes': {
    uri: 'https://images.unsplash.com/photo-1693940747465-423ec720f3e6?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8dmVnZXRhYmxlJTIwdGlhbnxlbnwxfDB8fHwxNzk1MDk4NjUxfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Jason Leung',
    authorUrl: 'https://unsplash.com/@ninjason',
  },
  'Taboulé': {
    uri: 'https://images.unsplash.com/photo-1594040815645-5442fb6d48f6?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8dGFiYm91bGVofGVufDF8MHx8fDE3OTUwOTg2NTN8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Hamza Zaidi',
    authorUrl: 'https://unsplash.com/@hamzazaidi',
  },
  'Salade de pâtes': {
    uri: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8cGFzdGElMjBzYWxhZHxlbnwxfDB8fHwxNzk1MDk4NjU0fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Eaters Collective',
    authorUrl: 'https://unsplash.com/@eaterscollective',
  },
  'Frittata aux légumes': {
    uri: 'https://images.unsplash.com/photo-1673960729830-76830e8b3db4?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8ZnJpdHRhdGF8ZW58MXwwfHx8MTc5NTA5ODY1NXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Sandie Clarke',
    authorUrl: 'https://unsplash.com/@honeypoppet',
  },
  'Quiche épinards et feta': {
    uri: 'https://images.unsplash.com/photo-1633205772834-c0b9943c5a54?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NXx8c3BpbmFjaCUyMHF1aWNoZXxlbnwxfDB8fHwxNzk1MDk4NjU3fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Emma Shappley',
    authorUrl: 'https://unsplash.com/@emmashapp',
  },
  'Poivrons farcis au riz et au fromage': {
    uri: 'https://images.unsplash.com/photo-1673646960062-9aeb2188335f?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8c3R1ZmZlZCUyMHBlcHBlcnMlMjByaWNlfGVufDF8MHx8fDE3OTUwOTg2NTh8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Natalia Gusakova',
    authorUrl: 'https://unsplash.com/@nataliaraylenegusakova',
  },
  'Bol complet riz, légumes et oeuf': {
    uri: 'https://images.unsplash.com/photo-1694111133960-73fde2d294e4?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8cmljZSUyMGJvd2wlMjB2ZWdldGFibGVzJTIwZnJpZWQlMjBlZ2d8ZW58MXwwfHx8MTc5NTEwMjEzNnww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Krisna Putra Pratama',
    authorUrl: 'https://unsplash.com/@krisnapepe',
  },
  'Pâtes au pesto': {
    uri: 'https://images.unsplash.com/photo-1605590955562-be1a5fda4161?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8cGFzdGElMjBwZXN0b3xlbnwxfDB8fHwxNzk1MDk4NjYwfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'amirali mirhashemian',
    authorUrl: 'https://unsplash.com/@amir_v_ali',
  },
  'Gnocchis tomate et mozzarella au four': {
    uri: 'https://images.unsplash.com/photo-1778837224436-82a8f1fa8bb1?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8Z25vY2NoaSUyMHRvbWF0byUyMG1venphcmVsbGF8ZW58MXwwfHx8MTc5NTA5ODY2Mnww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Eva Greenberg',
    authorUrl: 'https://unsplash.com/@evajosefina',
  },
  'Tortilla de pommes de terre': {
    uri: 'https://images.unsplash.com/photo-1639669794539-952631b44515?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8c3BhbmlzaCUyMHRvcnRpbGxhfGVufDF8MHx8fDE3OTUwOTg2NjR8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'blackieshoot',
    authorUrl: 'https://unsplash.com/@blackieshoot',
  },
  'Champignons farcis': {
    uri: 'https://images.unsplash.com/photo-1756478629551-2f5708638b23?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8c3R1ZmZlZCUyMG11c2hyb29tc3xlbnwxfDB8fHwxNzk1MDk4NjY2fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Murat Ts.',
    authorUrl: 'https://unsplash.com/@murtts',
  },
  'Gaspacho': {
    uri: 'https://images.unsplash.com/photo-1626200949817-4719bd60000b?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8Z2F6cGFjaG98ZW58MXwwfHx8MTc5NTA5ODY2OHww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Farhad Ibrahimzade',
    authorUrl: 'https://unsplash.com/@ferhadd',
  },
  'Salade de chèvre chaud': {
    uri: 'https://images.unsplash.com/photo-1608032077018-c9aad9565d29?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8Z29hdCUyMGNoZWVzZSUyMHNhbGFkfGVufDF8MHx8fDE3OTUwOTg2Njl8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Christine Isakzhanova',
    authorUrl: 'https://unsplash.com/@bulochka',
  },
  'Pizza maison': {
    uri: 'https://images.unsplash.com/photo-1598023696416-0193a0bcd302?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8aG9tZW1hZGUlMjBwaXp6YXxlbnwxfDB8fHwxNzk1MDk4NjcwfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'amirali mirhashemian',
    authorUrl: 'https://unsplash.com/@amir_v_ali',
  },
  'Galettes de pois chiches': {
    uri: 'https://images.unsplash.com/photo-1680990999782-ba7fe26e4d0b?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8ZmFsYWZlbHxlbnwxfDB8fHwxNzk1MDk4NjcyfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Zoshua Colah',
    authorUrl: 'https://unsplash.com/@zoshuacolah',
  },
  'Courgettes gratinées au fromage': {
    uri: 'https://images.unsplash.com/photo-1649434150059-13fee33e1de4?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8c3R1ZmZlZCUyMHp1Y2NoaW5pfGVufDF8MHx8fDE3OTUwOTg2NzN8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Joachim Lesne',
    authorUrl: 'https://unsplash.com/@joaching',
  },
  'Salade de pommes de terre et oeufs': {
    uri: 'https://images.unsplash.com/photo-1762631883355-0d1efe77032c?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8cG90YXRvJTIwc2FsYWQlMjBlZ2d8ZW58MXwwfHx8MTc5NTA5ODY3NXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'joe boshra',
    authorUrl: 'https://unsplash.com/@joestudios',
  },
  'Mousse au chocolat': {
    uri: 'https://images.unsplash.com/photo-1673551491291-5b17d2842988?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8NXx8Y2hvY29sYXRlJTIwbW91c3NlfGVufDF8MHx8fDE3OTUwOTg2Nzd8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'American Heritage Chocolate',
    authorUrl: 'https://unsplash.com/@americanheritagechocolate',
  },
  'Gâteau au chocolat fondant': {
    uri: 'https://images.unsplash.com/photo-1673551490812-eaee2e9bf0ef?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8Y2hvY29sYXRlJTIwZm9uZGFudHxlbnwxfDB8fHwxNzk1MDk4Njc4fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'American Heritage Chocolate',
    authorUrl: 'https://unsplash.com/@americanheritagechocolate',
  },
  'Cookies aux pépites de chocolat': {
    uri: 'https://images.unsplash.com/photo-1583743089695-4b816a340f82?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8Y2hvY29sYXRlJTIwY2hpcCUyMGNvb2tpZXN8ZW58MXwwfHx8MTc5NTA5ODY3OXww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'SJ 📸',
    authorUrl: 'https://unsplash.com/@uxsj_ph',
  },
  'Tarte aux pommes': {
    uri: 'https://images.unsplash.com/photo-1777157290722-053ab8f7b4b6?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Nnx8YXBwbGUlMjB0YXJ0fGVufDF8MHx8fDE3OTUwOTg2ODF8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Rob Wingate',
    authorUrl: 'https://unsplash.com/@robwingate',
  },
  'Salade de fruits frais': {
    uri: 'https://images.unsplash.com/photo-1641642400143-6be68f1a0918?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8ZnJ1aXQlMjBzYWxhZHxlbnwxfDB8fHwxNzk1MDk4NjgyfDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'VD Photography',
    authorUrl: 'https://unsplash.com/@vdphotography',
  },
  'Clafoutis aux fruits': {
    uri: 'https://images.unsplash.com/photo-1725770717141-482172dc596b?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8Y2hlcnJ5JTIwY2xhZm91dGlzfGVufDF8MHx8fDE3OTUxMDIxMzh8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Enrique Briseno',
    authorUrl: 'https://unsplash.com/@ytveb',
  },
  'Cake à la banane': {
    uri: 'https://images.unsplash.com/photo-1675712843856-ba2cb7d33f3c?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8YmFuYW5hJTIwYnJlYWR8ZW58MXwwfHx8MTc5NTA5ODY4M3ww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Wouter Supardi Salari',
    authorUrl: 'https://unsplash.com/@supardisign',
  },
  'Muffins aux fruits': {
    uri: 'https://images.unsplash.com/photo-1637087788449-222cf1da072a?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8M3x8Ymx1ZWJlcnJ5JTIwbXVmZmluc3xlbnwxfDB8fHwxNzk1MDk4Njg1fDA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Tayla Brand',
    authorUrl: 'https://unsplash.com/@taylabrandpics',
  },
  'Panna cotta aux fruits rouges': {
    uri: 'https://images.unsplash.com/photo-1787550275377-9f54a07c68c8?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8cGFubmElMjBjb3R0YSUyMGJlcnJpZXN8ZW58MXwwfHx8MTc5NTA5ODY4N3ww&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Mustafa akın',
    authorUrl: 'https://unsplash.com/@msaimakin',
  },
  'Houmous': {
    uri: 'https://images.unsplash.com/photo-1603133872497-f29809b750bf?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8aHVtbXVzfGVufDF8MHx8fDE3OTUwOTg2OTB8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Christopher Alvarenga',
    authorUrl: 'https://unsplash.com/@krizphoto',
  },
  'Guacamole': {
    uri: 'https://images.unsplash.com/photo-1595016111459-799a195e7452?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8MXx8Z3VhY2Ftb2xlfGVufDF8MHx8fDE3OTUwOTg2OTJ8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Tessa Rampersad',
    authorUrl: 'https://unsplash.com/@t_rampersad',
  },
  'Poires pochées au chocolat': {
    uri: 'https://images.unsplash.com/photo-1541950747932-b59b50dcc0d5?ixid=M3wxMTM4NjQ0fDB8MXxzZWFyY2h8Mnx8cG9hY2hlZCUyMHBlYXIlMjBkZXNzZXJ0fGVufDF8MHx8fDE3OTUxMDIxMzl8MA&ixlib=rb-4.1.0&w=900&h=675&fit=crop&q=75&auto=format',
    author: 'Miles Vanderlooven',
    authorUrl: 'https://unsplash.com/@mylesuk',
  },
};
