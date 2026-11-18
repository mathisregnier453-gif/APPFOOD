import { FOOD_CATEGORIES, FOOD_UNITS, type StorageKind } from './types.ts';

// Prompt système FIGÉ (aucune donnée variable) : stable pour la mise en cache.
export const SCAN_SYSTEM_PROMPT = `Tu es le moteur de reconnaissance d'aliments d'une application de gestion de stock alimentaire.
Tu reçois une ou plusieurs photos d'un réfrigérateur, d'un congélateur ou d'un placard, et tu dresses l'inventaire des aliments VISIBLES.

Règles impératives :
- Ne liste que ce que tu vois réellement. Si un objet est trop flou ou caché pour être identifié, ignore-le plutôt que de deviner. Pas de vaisselle, pas d'objets non alimentaires.
- Nom : court, en français, générique mais précis ("Lait demi-écrémé", "Tomates cerises", "Yaourts nature"). Mentionne la marque uniquement si elle est lisible et utile.
- Quantité : compte les unités visibles (unit "piece" ou "pack"). Pour un poids ou un volume, ne donne une valeur que si elle est imprimée et lisible sur l'emballage, et mets alors quantity_from_label à true. Si tu ne peux pas déterminer la quantité, mets quantity à null. N'invente jamais de quantité précise.
- Dates : ne renseigne expiry_date que si une date de péremption est LISIBLE sur la photo ; mets alors expiry_visible à true. Sinon expiry_date = null et expiry_visible = false. N'estime jamais une date à partir du type de produit.
  "À consommer jusqu'au" = "dlc" ; "À consommer de préférence avant" = "ddm". Si la mention n'est pas lisible, expiry_kind = null.
  Les dates partielles (ex. "12/03") se complètent avec l'année la plus plausible par rapport à la date du jour fournie.
- Un même produit visible sur plusieurs photos ne doit apparaître qu'une fois.
- confidence (0 à 1) : ta certitude sur l'identification du produit.
- photo_index : index (0 = première photo) de la photo où le produit est le plus visible.
- Catégories autorisées : ${FOOD_CATEGORIES.join(', ')}.
- Unités autorisées : ${FOOD_UNITS.join(', ')}.`;

const STORAGE_LABEL: Record<StorageKind, string> = {
  fridge: 'réfrigérateur',
  freezer: 'congélateur',
  pantry: 'placard',
};

export function scanUserPrompt(storageKind: StorageKind, today: string, photoCount: number): string {
  return `Espace photographié : ${STORAGE_LABEL[storageKind]}. Nombre de photos : ${photoCount}. Date du jour : ${today}.
Liste les aliments visibles en respectant strictement les règles.`;
}

/** Schéma JSON de sortie (sortie structurée côté fournisseur). */
export const SCAN_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name', 'category', 'quantity', 'unit', 'quantity_from_label',
          'expiry_date', 'expiry_kind', 'expiry_visible', 'confidence', 'photo_index',
        ],
        properties: {
          name: { type: 'string' },
          category: { type: 'string', enum: [...FOOD_CATEGORIES] },
          quantity: { type: ['number', 'null'] },
          unit: { type: 'string', enum: [...FOOD_UNITS] },
          quantity_from_label: { type: 'boolean' },
          expiry_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          expiry_kind: { type: ['string', 'null'], enum: ['dlc', 'ddm', null] },
          expiry_visible: { type: 'boolean' },
          confidence: { type: 'number' },
          photo_index: { type: 'integer' },
        },
      },
    },
  },
} as const;
