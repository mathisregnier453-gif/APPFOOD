import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { RecipeCard } from '@/components/RecipeCard';
import { Banner, Card, Chip, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { openPaywall } from '@/features/billing/EntitlementsProvider';
import { fetchActiveItems, fetchQuota } from '@/features/inventory/api';
import { fetchPreferences, fetchRecipesByIds, generateRecipes } from '@/features/recipes/api';
import { computeAvailability } from '@/features/recipes/availability';
import { BUDGET_LABEL, FOCUS_OPTIONS, LEVEL_LABEL, MEAL_OPTIONS, TIME_OPTIONS } from '@/features/recipes/catalog';
import { ApiError } from '@/lib/supabase';
import type { DietaryPreferences, FoodItem, MealType, QuotaStatus, Recipe, RecipeFocus } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';
import { track } from '@/lib/observability';

function errorMessage(err: unknown, quota: QuotaStatus | null): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'quota_exceeded':
        return `Vous avez utilisé vos ${err.details.recipes_limit ?? quota?.recipes_limit ?? ''} recettes du mois. Elles se renouvellent le ${quota ? new Date(quota.period_end).toLocaleDateString('fr-FR') : 'mois prochain'}. L'offre Premium propose des recettes sans limite (usage raisonnable).`;
      case 'household_read_only':
        return "Ce foyer partagé n'a plus l'offre Famille : seul son propriétaire peut générer des recettes.";
      case 'empty_inventory':
        return "Votre stock est vide : scannez votre frigo ou ajoutez quelques aliments pour obtenir des recettes.";
      case 'generation_failed':
        return "La génération n'a pas abouti. Rien ne vous a été décompté : réessayez.";
      case 'network_error':
        return 'Connexion impossible. Vérifiez votre réseau.';
    }
  }
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

export default function GenerateRecipesScreen() {
  const params = useLocalSearchParams<{ focus?: RecipeFocus }>();
  const { session, profile, householdId } = useAuth();
  const [focus, setFocus] = useState<RecipeFocus[]>(params.focus ? [params.focus] : ['anti_waste']);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [servings, setServings] = useState(profile?.household_size ?? 2);
  const [budget, setBudget] = useState<1 | 2 | 3 | null>(null);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | null>(null);
  const [meal, setMeal] = useState<MealType | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [prefs, setPrefs] = useState<DietaryPreferences | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [results, setResults] = useState<Recipe[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId || !session) return;
    void Promise.all([fetchQuota(householdId), fetchPreferences(session.user.id), fetchActiveItems(householdId)])
      .then(([q, p, i]) => {
        setQuota(q);
        setPrefs(p);
        setItems(i);
      })
      .catch(() => undefined);
  }, [householdId, session]);

  const stock = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, { quantity: i.quantity, unit: i.unit, name: i.name }]));
    return { get: (id: string) => map.get(id) };
  }, [items]);

  const remaining = quota ? Math.max(0, quota.recipes_limit - quota.recipes_used) : null;

  const toggleFocus = (id: RecipeFocus) =>
    setFocus((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id].slice(-3)));

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await generateRecipes({
        focus, max_total_minutes: maxMinutes, servings, budget, difficulty, meal_type: meal,
      });
      track('recipes_generated', { count: res.recipe_ids.length, from_cache: res.from_cache });
      setResults(await fetchRecipesByIds(res.recipe_ids));
      if (res.quota) setQuota((q) => (q ? { ...q, recipes_used: res.quota!.recipes_used } : q));
    } catch (err) {
      setError(errorMessage(err, quota));
    } finally {
      setBusy(false);
    }
  };

  const prefSummary = prefs ? [...prefs.diets, ...prefs.allergies.map((a) => `sans ${a.toLowerCase()}`)].join(' · ') : '';

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Idées de recettes</Text>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      {results.length > 0 ? (
        <Animated.View entering={FadeIn} style={{ gap: spacing.md }}>
          <SectionTitle title="Vos idées" action={<Text style={styles.link} onPress={() => setResults([])}>Modifier les filtres</Text>} />
          {results.map((r, i) => (
            <RecipeCard key={r.id} index={i} recipe={r} availability={computeAvailability(r.recipe_ingredients, stock)} onPress={() => router.push(`/recipe/${r.id}`)} />
          ))}
          <Button label="Autres idées" icon="refresh" variant="secondary" onPress={generate} loading={busy} disabled={remaining === 0} />
        </Animated.View>
      ) : (
        <>
          <View style={styles.group}>
            <Text style={typography.caption}>Envies (3 max.)</Text>
            <View style={styles.wrap}>
              {FOCUS_OPTIONS.map((f) => (
                <Chip key={f.id} label={f.label} icon={f.icon} selected={focus.includes(f.id)} onPress={() => toggleFocus(f.id)} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={typography.caption}>Type de repas</Text>
            <View style={styles.wrap}>
              {MEAL_OPTIONS.map((m) => (
                <Chip key={m.id} label={m.label} icon={m.icon} selected={meal === m.id} onPress={() => setMeal((v) => (v === m.id ? null : m.id))} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={typography.caption}>Temps total maximum</Text>
            <View style={styles.wrap}>
              {TIME_OPTIONS.map((t) => (
                <Chip key={t} label={`${t} min`} selected={maxMinutes === t} onPress={() => setMaxMinutes((v) => (v === t ? null : t))} />
              ))}
            </View>
          </View>

          <Card style={styles.servings}>
            <Text style={typography.heading}>Personnes</Text>
            <View style={styles.stepper}>
              <Pressable accessibilityLabel="Moins de personnes" onPress={() => setServings((s) => Math.max(1, s - 1))} style={styles.stepBtn}>
                <Ionicons name="remove" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.stepValue}>{servings}</Text>
              <Pressable accessibilityLabel="Plus de personnes" onPress={() => setServings((s) => Math.min(12, s + 1))} style={styles.stepBtn}>
                <Ionicons name="add" size={18} color={colors.text} />
              </Pressable>
            </View>
          </Card>

          <View style={styles.row2}>
            <View style={[styles.group, { flex: 1 }]}>
              <Text style={typography.caption}>Budget</Text>
              <View style={styles.wrap}>
                {([1, 2, 3] as const).map((b) => (
                  <Chip key={b} label={BUDGET_LABEL[b]} selected={budget === b} onPress={() => setBudget((v) => (v === b ? null : b))} />
                ))}
              </View>
            </View>
          </View>
          <View style={styles.group}>
            <Text style={typography.caption}>Difficulté maximum</Text>
            <View style={styles.wrap}>
              {([1, 2, 3] as const).map((d) => (
                <Chip key={d} label={LEVEL_LABEL[d]} selected={difficulty === d} onPress={() => setDifficulty((v) => (v === d ? null : d))} />
              ))}
            </View>
          </View>

          <Card onPress={() => router.push('/preferences')} style={styles.prefCard}>
            <Ionicons name="options-outline" size={20} color={colors.sageDark} />
            <View style={{ flex: 1 }}>
              <Text style={typography.heading}>Préférences alimentaires</Text>
              <Text style={typography.caption} numberOfLines={2}>{prefSummary || 'Régimes, allergies, aliments à éviter'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Card>

          {error && <Banner tone={error.includes('recettes du mois') ? 'warning' : 'danger'}>{error}</Banner>}
          {error?.includes('recettes du mois') && quota?.plan === 'free' && (
            <Button label="Voir les offres" icon="sparkles-outline" variant="secondary" onPress={() => openPaywall('recipe_quota')} />
          )}

          <View style={{ gap: spacing.sm }}>
            {remaining !== null && (
              <Text style={[typography.caption, { textAlign: 'center' }]}>
                {remaining} recette{remaining > 1 ? 's' : ''} disponible{remaining > 1 ? 's' : ''} ce mois-ci · 3 idées par demande
              </Text>
            )}
            <Button label={busy ? 'Le chef réfléchit…' : 'Proposer des recettes'} icon="sparkles-outline" onPress={generate} loading={busy} disabled={remaining === 0} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row2: { flexDirection: 'row', gap: spacing.lg },
  servings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center', color: colors.text },
  prefCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  link: { color: colors.sageDark, fontWeight: '600' },
});
