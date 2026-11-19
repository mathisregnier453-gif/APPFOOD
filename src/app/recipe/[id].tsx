import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RecipeCover, recipePhoto } from '@/components/RecipeCard';
import { Button } from '@/components/Button';
import { Banner, Card, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEntitlements } from '@/features/billing/EntitlementsProvider';
import { fetchActiveItems } from '@/features/inventory/api';
import { addShoppingItems } from '@/features/planning/api';
import { deleteRecipe, fetchFavoriteIds, fetchPreferences, fetchRecipe, setFavorite } from '@/features/recipes/api';
import { computeAvailability } from '@/features/recipes/availability';
import { BUDGET_LABEL, LEVEL_LABEL } from '@/features/recipes/catalog';
import { formatQuantity } from '@/lib/catalog';
import type { FoodItem, Recipe, RecipeIngredient } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

function amount(ing: RecipeIngredient): string {
  if (ing.quantity !== null && ing.unit) return formatQuantity(ing.quantity, ing.unit);
  return ing.quantity_text ?? '';
}

function IngredientLine({ ing, note, tone }: { ing: RecipeIngredient; note?: string; tone: 'ok' | 'missing' | 'muted' }) {
  const icon = tone === 'ok' ? 'checkmark-circle' : tone === 'missing' ? 'cart-outline' : 'ellipse-outline';
  const color = tone === 'ok' ? colors.sage : tone === 'missing' ? colors.warning : colors.textFaint;
  return (
    <View style={styles.ingRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[typography.body, { flex: 1 }]}>{ing.name}</Text>
      <Text style={typography.caption}>{[amount(ing), note].filter(Boolean).join(' · ')}</Text>
    </View>
  );
}

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, householdId } = useAuth();
  const { requireFeature } = useEntitlements();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [favorite, setFav] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!id || !householdId || !session) return;
    const [r, i, favs, prefs] = await Promise.all([
      fetchRecipe(id), fetchActiveItems(householdId), fetchFavoriteIds(session.user.id), fetchPreferences(session.user.id),
    ]);
    setRecipe(r);
    setItems(i);
    setFav(favs.has(id));
    setHasAllergies(prefs.allergies.length > 0);
    setLoading(false);
  }, [id, householdId, session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const availability = useMemo(
    () => (recipe ? computeAvailability(recipe.recipe_ingredients, { get: (k) => itemsById.get(k) }) : null),
    [recipe, itemsById],
  );

  if (loading || !recipe || !availability) {
    return (
      <Screen scroll={false}>
        {loading ? <ActivityIndicator color={colors.sage} style={{ marginTop: spacing.xxl * 2 }} /> : <Banner tone="info">Cette recette n'existe plus.</Banner>}
      </Screen>
    );
  }

  const toggleFavorite = async () => {
    if (!session || !householdId) return;
    const next = !favorite;
    setFav(next);
    void Haptics.selectionAsync();
    try {
      await setFavorite(session.user.id, householdId, recipe.id, next);
    } catch {
      setFav(!next);
    }
  };

  const addMissing = async () => {
    if (!householdId) return;
    setAdding(true);
    try {
      await addShoppingItems(householdId, availability.missing.map((i) => ({
        name: i.name, quantity: i.quantity, unit: i.unit, category_id: i.category_id ?? 'other', recipe_id: recipe.id,
      })));
      Alert.alert('Ajouté à la liste', 'Les ingrédients manquants sont dans vos courses.', [
        { text: 'OK' }, { text: 'Voir la liste', onPress: () => router.push('/courses') },
      ]);
    } catch {
      Alert.alert('Erreur', "La liste n'a pas pu être mise à jour.");
    } finally {
      setAdding(false);
    }
  };

  const remove = () =>
    Alert.alert('Retirer cette recette ?', 'Elle disparaîtra de vos idées et de vos favoris.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => void deleteRecipe(recipe.id).then(() => router.back()) },
    ]);

  return (
    <Screen padded={false}>
      <View>
        <RecipeCover recipe={recipe} height={recipePhoto(recipe) ? 260 : 220} rounded={false} />
        {recipePhoto(recipe) ? <Text style={styles.credit} numberOfLines={1}>Photo : {recipePhoto(recipe)!.credit}</Text> : null}
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Retour" onPress={() => router.back()} style={styles.roundBtn}>
            <Ionicons name="chevron-down" size={22} color={colors.text} />
          </Pressable>
          <Pressable accessibilityLabel={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onPress={() => (favorite ? void toggleFavorite() : requireFeature('favorites', 'favorites', () => void toggleFavorite()))} style={styles.roundBtn}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color={favorite ? colors.danger : colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.title}>{recipe.title}</Text>
          {recipe.summary ? <Text style={[typography.body, { color: colors.textMuted }]}>{recipe.summary}</Text> : null}
        </View>

        <Card style={styles.facts}>
          <Fact label="Préparation" value={`${recipe.prep_minutes ?? 0} min`} />
          <Fact label="Cuisson" value={`${recipe.cook_minutes ?? 0} min`} />
          <Fact label="Personnes" value={String(recipe.servings)} />
          <Fact label="Niveau" value={recipe.difficulty ? LEVEL_LABEL[recipe.difficulty] : '—'} />
          <Fact label="Budget" value={recipe.budget_level ? BUDGET_LABEL[recipe.budget_level] : '—'} />
        </Card>

        {availability.canCook ? (
          <Banner tone="info">Vous avez tout ce qu'il faut (pensez à vérifier les basiques).</Banner>
        ) : (
          <Banner tone="warning">{availability.missing.length} ingrédient{availability.missing.length > 1 ? 's' : ''} à acheter.</Banner>
        )}

        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="Ingrédients" />
          {availability.available.length > 0 && <Text style={typography.micro}>DANS VOTRE STOCK</Text>}
          {availability.available.map((ing) => {
            const stockItem = ing.food_item_id ? itemsById.get(ing.food_item_id) : undefined;
            return <IngredientLine key={ing.id} ing={ing} tone="ok" note={stockItem ? `stock : ${formatQuantity(stockItem.quantity, stockItem.unit, stockItem.quantity_is_estimate)}` : undefined} />;
          })}
          {availability.missing.length > 0 && <Text style={[typography.micro, styles.groupTitle]}>À ACHETER</Text>}
          {availability.missing.map((ing) => <IngredientLine key={ing.id} ing={ing} tone="missing" />)}
          {availability.staples.length > 0 && <Text style={[typography.micro, styles.groupTitle]}>BASIQUES À VÉRIFIER</Text>}
          {availability.staples.map((ing) => <IngredientLine key={ing.id} ing={ing} tone="muted" />)}
          {availability.optional.length > 0 && <Text style={[typography.micro, styles.groupTitle]}>FACULTATIF</Text>}
          {availability.optional.map((ing) => <IngredientLine key={ing.id} ing={ing} tone="muted" />)}
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Préparation" />
          {recipe.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={[typography.body, { flex: 1 }]}>{step}</Text>
            </View>
          ))}
        </View>

        {hasAllergies && (
          <Text style={[typography.caption, { color: colors.textFaint }]}>
            Recette filtrée selon vos allergies déclarées. Vérifiez toujours la composition sur les étiquettes des produits.
          </Text>
        )}
        <Text style={[typography.caption, { color: colors.textFaint }]}>Recette de la base Sauge, choisie selon votre stock : adaptez cuissons et assaisonnements à votre goût.</Text>

        <View style={{ gap: spacing.sm }}>
          <Button label="J'ai cuisiné cette recette" icon="flame-outline" onPress={() => router.push({ pathname: '/recipe/cook', params: { id: recipe.id } })} />
          {availability.missing.length > 0 && (
            <Button label={`Ajouter ${availability.missing.length} ingrédient${availability.missing.length > 1 ? 's' : ''} à la liste`} icon="cart-outline" variant="secondary" onPress={addMissing} loading={adding} />
          )}
          <Button label="Planifier" icon="calendar-outline" variant="secondary" onPress={() => requireFeature('meal_plan', 'meal_plan', () => router.push({ pathname: '/planning/assign', params: { recipeId: recipe.id } }))} />
          <Button label="Retirer de mes idées" variant="ghost" onPress={remove} />
        </View>
      </View>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
      <Text style={[typography.heading, { fontSize: 15 }]}>{value}</Text>
      <Text style={[typography.caption, { fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  credit: { position: 'absolute', right: 8, bottom: 6, maxWidth: '80%', fontSize: 10, color: '#fff', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 },
  topBar: { position: 'absolute', top: spacing.md, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.xl },
  facts: { flexDirection: 'row', paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  groupTitle: { marginTop: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontWeight: '700', color: colors.sageDark },
});
