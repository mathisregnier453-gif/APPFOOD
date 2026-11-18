import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RecipeCard } from '@/components/RecipeCard';
import { Banner, Chip, EmptyState, Screen } from '@/components/ui';
import { rankRecipes } from '@/features/recipes/availability';
import { FOCUS_OPTIONS, MEAL_OPTIONS } from '@/features/recipes/catalog';
import { useRecipes } from '@/features/recipes/useRecipes';
import type { MealType } from '@/lib/types';
import { colors, radius, shadow, spacing, typography } from '@/theme';

type Tab = 'suggestions' | 'favorites';

export default function RecipesScreen() {
  const { recipes, favorites, availability, loading, error, hasStock } = useRecipes();
  const [tab, setTab] = useState<Tab>('suggestions');
  const [onlyCookable, setOnlyCookable] = useState(false);
  const [meal, setMeal] = useState<MealType | null>(null);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);

  const visible = useMemo(() => {
    const filtered = recipes.filter((r) => {
      if (tab === 'favorites' && !favorites.has(r.id)) return false;
      if (onlyCookable && !availability(r).canCook) return false;
      if (meal && r.meal_type !== meal) return false;
      if (maxMinutes && (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) > maxMinutes) return false;
      return true;
    });
    return rankRecipes(filtered, availability);
  }, [recipes, favorites, availability, tab, onlyCookable, meal, maxMinutes]);

  return (
    <Screen>
      <Text style={typography.title}>Recettes</Text>

      <Pressable onPress={() => router.push('/recipe/generate')} style={({ pressed }) => [styles.hero, pressed && { opacity: 0.92 }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.heroTitle}>Que cuisiner ce soir ?</Text>
          <Text style={styles.heroText}>Des idées sur mesure avec ce que vous avez déjà.</Text>
        </View>
        <View style={styles.heroIcon}><Ionicons name="sparkles" size={24} color={colors.sageDark} /></View>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {FOCUS_OPTIONS.map((f) => (
          <Chip key={f.id} label={f.label} icon={f.icon} onPress={() => router.push({ pathname: '/recipe/generate', params: { focus: f.id } })} />
        ))}
      </ScrollView>

      <View style={styles.segment}>
        {(['suggestions', 'favorites'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentItem, tab === t && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
            <Text style={[styles.segmentLabel, tab === t && { color: colors.text }]}>{t === 'suggestions' ? 'Mes idées' : `Favoris${favorites.size ? ` · ${favorites.size}` : ''}`}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="Réalisables maintenant" icon="checkmark-circle-outline" selected={onlyCookable} onPress={() => setOnlyCookable((v) => !v)} />
        <Chip label="≤ 30 min" icon="time-outline" selected={maxMinutes === 30} onPress={() => setMaxMinutes((v) => (v === 30 ? null : 30))} />
        {MEAL_OPTIONS.map((m) => (
          <Chip key={m.id} label={m.label} selected={meal === m.id} onPress={() => setMeal((v) => (v === m.id ? null : m.id))} />
        ))}
      </ScrollView>

      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <ActivityIndicator color={colors.sage} />
      ) : visible.length === 0 ? (
        tab === 'favorites' && favorites.size === 0 ? (
          <EmptyState icon="heart-outline" title="Pas encore de favoris" message="Touchez le cœur d'une recette pour la retrouver ici." />
        ) : recipes.length === 0 ? (
          <EmptyState
            icon="restaurant-outline"
            title="Aucune recette pour l'instant"
            message={hasStock ? 'Générez vos premières idées à partir de votre stock.' : "Ajoutez d'abord quelques aliments (scan ou saisie) : les recettes partent de votre stock."}
          />
        ) : (
          <EmptyState icon="funnel-outline" title="Aucune recette ne correspond" message="Retirez un filtre ou générez de nouvelles idées." />
        )
      ) : (
        <View style={{ gap: spacing.md }}>
          {visible.map((r, i) => (
            <RecipeCard key={r.id} index={i} recipe={r} availability={availability(r)} favorite={favorites.has(r.id)} onPress={() => router.push(`/recipe/${r.id}`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.sage, borderRadius: radius.lg, padding: spacing.xl, ...shadow.floating },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  heroText: { fontSize: 14, color: 'rgba(255,255,255,0.88)', fontWeight: '500' },
  heroIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.sageMist, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentLabel: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});
