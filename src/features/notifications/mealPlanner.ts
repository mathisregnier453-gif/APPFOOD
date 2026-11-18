// Rappels de repas et d'ingrédients manquants (module pur, testé).

export interface PlannedMealReminderInput {
  date: string; // YYYY-MM-DD
  slot: 'breakfast' | 'lunch' | 'dinner';
  title: string;
  isCooked: boolean;
  missing: string[]; // ingrédients obligatoires absents du stock
}

export interface MealReminder {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  url: string;
}

const SLOT_TIME: Record<PlannedMealReminderInput['slot'], [number, number]> = {
  breakfast: [7, 30], lunch: [11, 30], dinner: [18, 0],
};
const SLOT_LABEL = { breakfast: 'petit-déjeuner', lunch: 'déjeuner', dinner: 'dîner' } as const;
export const MISSING_CHECK_HOUR = 17;
export const MEAL_HORIZON_DAYS = 7;

function at(dateIso: string, h: number, m: number, dayShift = 0): Date {
  const [y, mo, d] = dateIso.split('-').map(Number);
  return new Date(y, mo - 1, d + dayShift, h, m, 0, 0);
}

export function planMealReminders(
  meals: PlannedMealReminderInput[],
  opts: { now: Date; mealReminder: boolean; missingIngredient: boolean },
): MealReminder[] {
  const out: MealReminder[] = [];
  const horizon = opts.now.getTime() + MEAL_HORIZON_DAYS * 86_400_000;

  for (const meal of meals) {
    if (meal.isCooked) continue;
    const [h, m] = SLOT_TIME[meal.slot];

    if (opts.mealReminder) {
      const fireAt = at(meal.date, h, m);
      if (fireAt.getTime() > opts.now.getTime() && fireAt.getTime() <= horizon) {
        out.push({
          id: `meal-${meal.date}-${meal.slot}`, fireAt,
          title: `C'est bientôt l'heure du ${SLOT_LABEL[meal.slot]}`,
          body: `Au menu : ${meal.title}.`,
          url: '/planning',
        });
      }
    }

    if (opts.missingIngredient && meal.missing.length > 0) {
      const fireAt = at(meal.date, MISSING_CHECK_HOUR, 0, -1); // la veille à 17 h
      if (fireAt.getTime() > opts.now.getTime() && fireAt.getTime() <= horizon) {
        const shown = meal.missing.slice(0, 3).join(', ');
        const more = meal.missing.length > 3 ? ` et ${meal.missing.length - 3} autre(s)` : '';
        out.push({
          id: `missing-${meal.date}-${meal.slot}`, fireAt,
          title: `Il manque ${meal.missing.length > 1 ? 'des ingrédients' : 'un ingrédient'} pour demain`,
          body: `${meal.title} (${SLOT_LABEL[meal.slot]}) : ${shown}${more}.`,
          url: '/courses',
        });
      }
    }
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, 25);
}
