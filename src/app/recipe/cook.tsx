import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Banner, Card, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchActiveItems } from '@/features/inventory/api';
import { cookRecipe } from '@/features/planning/api';
import { type DeductionSuggestion, suggestDeductions } from '@/features/planning/shopping';
import { fetchRecipe } from '@/features/recipes/api';
import { formatQuantity } from '@/lib/catalog';
import type { Recipe } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

// Recette cuisinée : on PROPOSE les quantités restantes, l'utilisateur valide.
export default function CookScreen() {
  const { id, mealPlanId, servings: servingsParam } = useLocalSearchParams<{ id: string; mealPlanId?: string; servings?: string }>();
  const { householdId } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState<number | null>(servingsParam ? Number(servingsParam) : null);
  const [deductions, setDeductions] = useState<DeductionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !householdId) return;
    void (async () => {
      const [r, items] = await Promise.all([fetchRecipe(id), fetchActiveItems(householdId)]);
      if (r) {
        const s = servings ?? r.servings;
        setServings(s);
        setRecipe(r);
        setDeductions(suggestDeductions(r.recipe_ingredients, r.servings, s, new Map(items.map((i) => [i.id, i]))));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, householdId]);

  const update = (foodItemId: string, patch: Partial<DeductionSuggestion>) =>
    setDeductions((prev) => prev.map((d) => (d.food_item_id === foodItemId ? { ...d, ...patch } : d)));

  const confirm = async () => {
    if (!recipe) return;
    setSaving(true);
    setError(null);
    try {
      await cookRecipe(recipe.id, deductions, mealPlanId ?? null);
      router.back();
    } catch {
      setError("La mise à jour du stock a échoué. Réessayez.");
      setSaving(false);
    }
  };

  if (loading || !recipe) {
    return <Screen scroll={false}><ActivityIndicator color={colors.sage} style={{ marginTop: spacing.xxl * 2 }} /></Screen>;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={typography.caption}>Bon appétit !</Text>
          <Text style={typography.title} numberOfLines={2}>{recipe.title}</Text>
        </View>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[typography.body, { color: colors.textMuted }]}>
        Voici ce qu'il devrait rester dans votre stock pour {servings} personne{servings && servings > 1 ? 's' : ''}. Corrigez si besoin.
      </Text>

      {deductions.length === 0 ? (
        <Banner tone="info">Aucun ingrédient de cette recette n'est lié à votre stock actuel : rien à déduire.</Banner>
      ) : (
        deductions.map((d) => (
          <Card key={d.food_item_id} style={{ gap: spacing.md }}>
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={typography.heading}>{d.name}</Text>
                <Text style={typography.caption}>Avant : {formatQuantity(d.current, d.unit)}</Text>
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Switch value={d.finish} onValueChange={(v) => update(d.food_item_id, { finish: v, suggested: v ? 0 : d.suggested || d.current })} trackColor={{ true: colors.sage, false: colors.border }} />
                <Text style={[typography.caption, { fontSize: 11 }]}>Terminé</Text>
              </View>
            </View>
            {!d.finish && (
              <View style={styles.between}>
                <Text style={typography.caption}>Reste</Text>
                <QuantityStepper quantity={d.suggested} unit={d.unit} onChange={(q) => update(d.food_item_id, { suggested: q, finish: q === 0 })} />
              </View>
            )}
            {d.current === null && !d.finish && (
              <Text style={[typography.caption, { color: colors.textFaint }]}>Quantité inconnue : indiquez ce qu'il reste ou laissez tel quel.</Text>
            )}
          </Card>
        ))
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      <Button label="Mettre à jour mon stock" icon="checkmark" onPress={confirm} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  close: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
