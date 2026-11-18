import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Banner, Card, Chip, EmptyState, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { openPaywall, useEntitlements } from '@/features/billing/EntitlementsProvider';
import { syncMealReminders } from '@/features/notifications/notifications';
import { addShoppingItems } from '@/features/planning/api';
import { buildShoppingNeeds } from '@/features/planning/shopping';
import { useMeals } from '@/features/planning/useWeek';
import { addDaysIso, dayLabel, mondayOf, weekDays, weekLabel } from '@/lib/dates';
import { localTodayIso } from '@/lib/expiry';
import type { MealPlanEntry, MealSlot } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Petit-déj.', lunch: 'Déjeuner', dinner: 'Dîner' };

export default function PlanningScreen() {
  const { householdId, profile } = useAuth();
  const { can, loaded } = useEntitlements();
  const today = localTodayIso();
  const [monday, setMonday] = useState(mondayOf(today));
  const [showBreakfast, setShowBreakfast] = useState(false);
  const [building, setBuilding] = useState(false);
  const { meals, items, missingFor, loading, error } = useMeals(monday);
  const days = weekDays(monday);
  const slots: MealSlot[] = showBreakfast ? ['breakfast', 'lunch', 'dinner'] : ['lunch', 'dinner'];

  const bySlot = useMemo(() => new Map(meals.map((m) => [`${m.plan_date}|${m.slot}`, m])), [meals]);
  const planned = meals.filter((m) => !m.is_cooked && m.plan_date >= today);

  // Rappels de repas / ingrédients manquants pour la semaine affichée.
  useEffect(() => {
    if (loading) return;
    void syncMealReminders(
      planned.map((m) => ({
        date: m.plan_date, slot: m.slot, title: m.recipes?.title ?? m.custom_title ?? 'Repas', isCooked: m.is_cooked, missing: missingFor(m),
      })),
      {
        mealReminder: can('smart_notifications') && (profile?.notification_prefs?.meal_reminder ?? true),
        missingIngredient: can('smart_notifications') && (profile?.notification_prefs?.missing_ingredient ?? true),
      },
    ).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, items, loading, profile?.notification_prefs]);

  const buildList = async () => {
    if (!householdId) return;
    const stock = new Map(items.map((i) => [i.id, { quantity: i.quantity, unit: i.unit }]));
    const needs = buildShoppingNeeds(
      planned.filter((m) => m.recipes).map((m) => ({
        recipeId: m.recipes!.id, recipeServings: m.recipes!.servings, servings: m.servings, ingredients: m.recipes!.recipe_ingredients,
      })),
      stock,
    );
    if (needs.length === 0) {
      Alert.alert('Rien à acheter', 'Votre stock couvre tous les repas prévus (pensez à vérifier les basiques).');
      return;
    }
    setBuilding(true);
    try {
      await addShoppingItems(householdId, needs, 'max');
      router.push('/courses');
    } catch {
      Alert.alert('Erreur', "La liste n'a pas pu être mise à jour. Réessayez.");
    } finally {
      setBuilding(false);
    }
  };

  if (loaded && !can('meal_plan')) {
    return (
      <Screen>
        <Text style={typography.title}>Planning</Text>
        <EmptyState
          icon="calendar-outline"
          title="Organisez votre semaine"
          message="Planifiez vos repas, laissez l'IA composer la semaine avec ce que vous avez, et obtenez la liste de courses en un geste."
        >
          <Button label="Découvrir Premium" icon="sparkles-outline" onPress={() => openPaywall('meal_plan')} />
        </EmptyState>
      </Screen>
    );
  }

  const openSlot = (date: string, slot: MealSlot, meal?: MealPlanEntry) =>
    router.push({ pathname: '/planning/slot', params: { date, slot, ...(meal ? { mealId: meal.id } : {}) } });

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Planning</Text>
        <Pressable onPress={() => router.push({ pathname: '/planning/generate', params: { start: monday < today ? today : monday } })} style={styles.aiBtn} accessibilityLabel="Générer la semaine avec l'IA">
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={styles.aiLabel}>Générer</Text>
        </Pressable>
      </View>

      <View style={styles.weekNav}>
        <Pressable accessibilityLabel="Semaine précédente" hitSlop={10} onPress={() => setMonday(addDaysIso(monday, -7))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setMonday(mondayOf(today))}>
          <Text style={typography.heading}>{weekLabel(monday)}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Semaine suivante" hitSlop={10} onPress={() => setMonday(addDaysIso(monday, 7))} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <Chip label="Petit-déjeuner" icon="cafe-outline" selected={showBreakfast} onPress={() => setShowBreakfast((v) => !v)} />
      </View>

      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <ActivityIndicator color={colors.sage} />
      ) : (
        <Animated.View entering={FadeIn} style={{ gap: spacing.md }}>
          {days.map((date) => {
            const isToday = date === today;
            const past = date < today;
            return (
              <Card key={date} style={[styles.day, isToday && { borderColor: colors.sage, borderWidth: 1.5 }, past && { opacity: 0.6 }]}>
                <Text style={[typography.micro, isToday && { color: colors.sageDark }]}>
                  {isToday ? "AUJOURD'HUI · " : ''}{dayLabel(date).toUpperCase()}
                </Text>
                {slots.map((slot) => {
                  const meal = bySlot.get(`${date}|${slot}`);
                  const missing = meal && !meal.is_cooked ? missingFor(meal).length : 0;
                  return (
                    <Pressable key={slot} onPress={() => openSlot(date, slot, meal)} style={styles.slot} accessibilityLabel={`${SLOT_LABEL[slot]} du ${dayLabel(date)}`}>
                      <Text style={styles.slotLabel}>{SLOT_LABEL[slot]}</Text>
                      {meal ? (
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[typography.body, meal.is_cooked && styles.done]} numberOfLines={1}>
                            {meal.recipes?.title ?? meal.custom_title}
                          </Text>
                          <Text style={typography.caption} numberOfLines={1}>
                            {meal.is_cooked ? 'Cuisiné ✓' : `${meal.servings} pers.${missing ? ` · ${missing} à acheter` : ''}`}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[typography.body, { flex: 1, color: colors.textFaint }]}>Ajouter un repas</Text>
                      )}
                      <Ionicons name={meal ? 'chevron-forward' : 'add'} size={18} color={colors.textFaint} />
                    </Pressable>
                  );
                })}
              </Card>
            );
          })}
        </Animated.View>
      )}

      <Button label="Liste de courses de la semaine" icon="cart-outline" variant="secondary" onPress={buildList} loading={building} disabled={planned.length === 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.sage, paddingHorizontal: 14, height: 38, borderRadius: radius.pill },
  aiLabel: { color: '#fff', fontWeight: '600', fontSize: 14 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  day: { gap: spacing.sm, paddingVertical: spacing.md },
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  slotLabel: { width: 74, fontSize: 13, fontWeight: '600', color: colors.textMuted },
  done: { textDecorationLine: 'line-through', color: colors.textMuted },
});
