import type Ionicons from '@expo/vector-icons/Ionicons';
import type { MealType, RecipeFocus } from '@/lib/types';

type IconName = keyof typeof Ionicons.glyphMap;

export const FOCUS_OPTIONS: { id: RecipeFocus; label: string; icon: IconName }[] = [
  { id: 'anti_waste', label: 'Anti-gaspi', icon: 'leaf-outline' },
  { id: 'stock', label: 'Avec mon stock', icon: 'grid-outline' },
  { id: 'quick', label: 'Rapide', icon: 'flash-outline' },
  { id: 'cheap', label: 'Économique', icon: 'wallet-outline' },
  { id: 'balanced', label: 'Équilibré', icon: 'nutrition-outline' },
  { id: 'protein', label: 'Riche en protéines', icon: 'barbell-outline' },
  { id: 'vegetarian', label: 'Végétarien', icon: 'flower-outline' },
];

export const MEAL_OPTIONS: { id: MealType; label: string; icon: IconName }[] = [
  { id: 'breakfast', label: 'Petit-déjeuner', icon: 'cafe-outline' },
  { id: 'lunch', label: 'Déjeuner', icon: 'sunny-outline' },
  { id: 'dinner', label: 'Dîner', icon: 'moon-outline' },
  { id: 'dessert', label: 'Dessert', icon: 'ice-cream-outline' },
  { id: 'snack', label: 'En-cas', icon: 'pizza-outline' },
];

export const TIME_OPTIONS = [15, 30, 45, 60];
export const LEVEL_LABEL = { 1: 'Facile', 2: 'Intermédiaire', 3: 'Avancé' } as const;
export const BUDGET_LABEL = { 1: '€', 2: '€€', 3: '€€€' } as const;

export const DIET_OPTIONS = ['Végétarien', 'Végétalien', 'Pescétarien', 'Sans porc', 'Sans alcool'];
// Les 14 allergènes à déclaration obligatoire (règlement UE INCO).
export const ALLERGEN_OPTIONS = [
  'Gluten', 'Lait', 'Oeuf', 'Arachide', 'Fruits à coque', 'Poisson', 'Crustacés', 'Mollusques',
  'Soja', 'Sésame', 'Moutarde', 'Céleri', 'Lupin', 'Sulfites',
];

export const mealById = (id: MealType | null) => MEAL_OPTIONS.find((m) => m.id === id);
