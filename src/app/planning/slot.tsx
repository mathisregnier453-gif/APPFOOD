import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Card, Chip, Field, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchMeals, removeMeal, setMeal } from '@/features/planning/api';
import { fetchFavoriteIds, fetchRecipes, generateRecipes } from '@/features/recipes/api';
import { dayLabel } from '@/lib/dates';
import { ApiError } from '@/lib/supabase';
import type { MealPlanEntry, MealSlot, Recipe } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner' };

// Choisir / remplacer / retirer le repas d'un créneau.
export default function SlotScreen() {
  const { date, slot, mealId, recipeId: preselected } = useLocalSearchParams<{ date: string; slot: MealSlot; mealId?: string; recipeId?: string }>();
  const { session, householdId, profile } = useAuth();
  const [meal, setMealEntry] = useState<MealPlanEntry | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const [servings, setServings] = useState(profile?.household_size ?? 2);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId || !session) return;
    void (async () => {
      const [r, f, m] = await Promise.all([
        fetchRecipes(householdId, 100),
        fetchFavoriteIds(session.user.id),
        mealId ? fetchMeals(householdId, date, date) : Promise.resolve([]),
      ]);
      setRecipes(r);
      setFavorites(f);
      const current = m.find((x) => x.id === mealId) ?? null;
      setMealEntry(current);
      if (current) setServings(current.servings);
      setLoading(false);
    })();
  }, [householdId, session, date, mealId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes
      .filter((r) => !q || r.title.toLowerCase().includes(q))
      .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || Number(b.meal_type === slot) - Number(a.meal_type === slot));
  }, [recipes, favorites, query, slot]);

  const save = async (value: { recipe_id: string | null; custom_title: string | null }) => {
    if (!householdId || !session) return;
    setBusy(true);
    setError(null);
    try {
      await setMeal(householdId, session.user.id, date, slot, { ...value, servings });
      router.back();
    } catch {
      setError("Le repas n'a pas pu être enregistré.");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (preselected && !loading && !meal) void save({ recipe_id: preselected, custom_title: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected, loading]);

  const newIdea = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await generateRecipes({ focus: ['anti_waste'], max_total_minutes: null, servings, budget: null, difficulty: null, meal_type: slot === 'breakfast' ? 'breakfast' : slot }, 1);
      await save({ recipe_id: res.recipe_ids[0], custom_title: null });
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'quota_exceeded'
        ? 'Quota de recettes du mois atteint : choisissez parmi vos recettes enregistrées.'
        : err instanceof ApiError && err.code === 'empty_inventory'
          ? "Ajoutez d'abord des aliments à votre stock."
          : "L'idée n'a pas pu être générée. Rien n'a été décompté.");
      setBusy(false);
    }
  };

  const remove = () => {
    if (!meal) return;
    Alert.alert('Retirer ce repas du planning ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => void removeMeal(meal.id).then(() => router.back()) },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ gap: 2 }}>
          <Text style={typography.caption}>{date ? dayLabel(date) : ''}</Text>
          <Text style={typography.title}>{SLOT_LABEL[slot]}</Text>
        </View>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      {meal && (
        <Card style={{ gap: spacing.md }}>
          <Text style={typography.caption}>Prévu</Text>
          <Text style={typography.heading}>{meal.recipes?.title ?? meal.custom_title}</Text>
          <View style={styles.row}>
            {meal.recipe_id && <Button label="Voir" size="md" variant="secondary" onPress={() => router.push(`/recipe/${meal.recipe_id}`)} />}
            {meal.recipe_id && !meal.is_cooked && (
              <Button label="Je l'ai cuisiné" size="md" icon="flame-outline" onPress={() => router.push({ pathname: '/recipe/cook', params: { id: meal.recipe_id!, mealPlanId: meal.id, servings: String(meal.servings) } })} />
            )}
            <Button label="Retirer" size="md" variant="danger" onPress={remove} />
          </View>
        </Card>
      )}

      <Card style={styles.servings}>
        <Text style={typography.heading}>Personnes</Text>
        <View style={styles.stepper}>
          <Pressable accessibilityLabel="Moins" onPress={() => setServings((s) => Math.max(1, s - 1))} style={styles.stepBtn}><Ionicons name="remove" size={18} color={colors.text} /></Pressable>
          <Text style={styles.stepValue}>{servings}</Text>
          <Pressable accessibilityLabel="Plus" onPress={() => setServings((s) => Math.min(20, s + 1))} style={styles.stepBtn}><Ionicons name="add" size={18} color={colors.text} /></Pressable>
        </View>
      </Card>

      {error && <Banner tone="warning">{error}</Banner>}

      <Button label={meal ? 'Remplacer par une nouvelle idée' : 'Nouvelle idée avec mon stock'} icon="sparkles-outline" onPress={newIdea} loading={busy} />

      <View style={{ gap: spacing.sm }}>
        <SectionTitle title={meal ? 'Ou remplacer par' : 'Mes recettes'} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Rechercher" placeholderTextColor={colors.textFaint} style={styles.search} />
        {loading ? (
          <ActivityIndicator color={colors.sage} />
        ) : filtered.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted }]}>Aucune recette enregistrée pour l'instant.</Text>
        ) : (
          filtered.slice(0, 30).map((r) => (
            <Pressable key={r.id} disabled={busy} onPress={() => void save({ recipe_id: r.id, custom_title: null })} style={styles.recipeRow}>
              {favorites.has(r.id) && <Ionicons name="heart" size={14} color={colors.danger} />}
              <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>{r.title}</Text>
              <Text style={typography.caption}>{(r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)} min</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Field label="Ou un repas libre" value={custom} onChangeText={setCustom} placeholder="Ex. Restes, restaurant, pizza maison" maxLength={60} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {['Restes', 'Repas dehors'].map((t) => <Chip key={t} label={t} onPress={() => setCustom(t)} />)}
        </View>
        <Button label="Enregistrer ce repas libre" variant="secondary" disabled={custom.trim().length < 2} onPress={() => void save({ recipe_id: null, custom_title: custom.trim() })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  servings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center', color: colors.text },
  search: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 16, backgroundColor: colors.surface, color: colors.text },
  recipeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
