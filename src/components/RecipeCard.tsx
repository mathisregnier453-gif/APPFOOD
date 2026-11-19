import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Availability } from '@/features/recipes/availability';
import { mealById } from '@/features/recipes/catalog';
import { categoryById } from '@/lib/catalog';
import { RECIPE_PHOTOS } from '@/features/recipes/photos';
import type { Recipe } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';
import { Card } from './ui';

/** Photo réelle d'une recette du catalogue (Unsplash, gardée en cache sur le téléphone), avec son crédit. */
export function recipePhoto(recipe: Pick<Recipe, 'title'>) {
  return RECIPE_PHOTOS[recipe.title] ?? null;
}

/**
 * Visuel du plat : vraie photo libre de droits quand la recette en a une (jamais
 * d'image générée), sinon une illustration sobre selon l'ingrédient principal.
 */
export function RecipeCover({ recipe, height = 120, rounded = true }: { recipe: Recipe; height?: number; rounded?: boolean }) {
  const photo = recipePhoto(recipe);
  const meal = mealById(recipe.meal_type);
  if (photo) {
    return (
      <View style={[styles.cover, { height, backgroundColor: colors.sageMist }, rounded && { borderRadius: radius.md }]}>
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" accessibilityLabel={`Photo : ${recipe.title}`} />
        {meal && (
          <View style={styles.mealPill}>
            <Ionicons name={meal.icon} size={12} color={colors.textMuted} />
            <Text style={styles.mealLabel}>{meal.label}</Text>
          </View>
        )}
      </View>
    );
  }
  const main = [...recipe.recipe_ingredients].sort((a, b) => a.position - b.position).find((i) => !i.is_staple && i.category_id);
  const cat = categoryById(main?.category_id ?? 'other');
  return (
    <View style={[styles.cover, { height, backgroundColor: cat.tint }, rounded && { borderRadius: radius.md }]}>
      <View style={[styles.blob, { width: height * 1.1, height: height * 1.1, borderRadius: height }]} />
      <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={height * 0.38} color={colors.text} style={{ opacity: 0.85 }} />
      {meal && (
        <View style={styles.mealPill}>
          <Ionicons name={meal.icon} size={12} color={colors.textMuted} />
          <Text style={styles.mealLabel}>{meal.label}</Text>
        </View>
      )}
    </View>
  );
}

export function RecipeMeta({ recipe }: { recipe: Recipe }) {
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return (
    <View style={styles.metaRow}>
      <View style={styles.meta}><Ionicons name="time-outline" size={14} color={colors.textMuted} /><Text style={typography.caption}>{total} min</Text></View>
      <View style={styles.meta}><Ionicons name="people-outline" size={14} color={colors.textMuted} /><Text style={typography.caption}>{recipe.servings}</Text></View>
    </View>
  );
}

export function RecipeCard({ recipe, availability, favorite, onPress, index = 0 }: {
  recipe: Recipe; availability: Availability; favorite?: boolean; onPress: () => void; index?: number;
}) {
  const missing = availability.missing.length;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(300)}>
      <Card onPress={onPress} style={styles.card}>
        <RecipeCover recipe={recipe} height={110} />
        <View style={{ gap: 6 }}>
          <View style={styles.titleRow}>
            <Text style={[typography.heading, { flex: 1 }]} numberOfLines={2}>{recipe.title}</Text>
            {favorite && <Ionicons name="heart" size={18} color={colors.danger} />}
          </View>
          <RecipeMeta recipe={recipe} />
          <View style={styles.badges}>
            {availability.canCook ? (
              <Text style={[styles.badge, { backgroundColor: colors.sageMist, color: colors.sageDark }]}>Réalisable maintenant</Text>
            ) : (
              <Text style={[styles.badge, { backgroundColor: colors.warningBg, color: colors.warning }]}>
                {missing} ingrédient{missing > 1 ? 's' : ''} à acheter
              </Text>
            )}
            {recipe.tags.includes('anti-gaspi') && (
              <Text style={[styles.badge, { backgroundColor: colors.infoBg, color: colors.info }]}>Anti-gaspi</Text>
            )}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', right: -30, top: -40, backgroundColor: 'rgba(255,255,255,0.35)' },
  mealPill: {
    position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  mealLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  card: { gap: spacing.md, padding: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
});
