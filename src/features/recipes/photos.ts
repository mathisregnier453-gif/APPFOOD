// Photos réelles des recettes du catalogue, choisies une à une sur Unsplash
// (licence Unsplash : usage commercial gratuit). Affichées depuis Unsplash
// (règle de l'API), puis gardées en cache sur le téléphone.
// Généré à partir de la sélection — ne pas éditer à la main.
export interface RecipePhoto { uri: string; author: string; authorUrl: string }

/** Lien vers Unsplash avec les paramètres de provenance demandés par Unsplash. */
export function unsplashLink(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=sauge&utm_medium=referral`;
}

export const RECIPE_PHOTOS: Record<string, RecipePhoto> = {};
