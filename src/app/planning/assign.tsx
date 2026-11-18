import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Chip, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { setMeal } from '@/features/planning/api';
import { addDaysIso, dayLabel } from '@/lib/dates';
import { localTodayIso } from '@/lib/expiry';
import type { MealSlot } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

// Planifier une recette depuis sa fiche : choix du jour et du repas.
export default function AssignScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { session, householdId, profile } = useAuth();
  const today = localTodayIso();
  const days = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!householdId || !session || !recipeId) return;
    setBusy(true);
    try {
      await setMeal(householdId, session.user.id, date, slot, { recipe_id: recipeId, custom_title: null, servings: profile?.household_size ?? 2 });
      router.back();
    } catch {
      setError("La recette n'a pas pu être planifiée.");
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Planifier</Text>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={typography.caption}>Jour</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {days.map((d) => <Chip key={d} label={d === today ? "Aujourd'hui" : dayLabel(d)} selected={date === d} onPress={() => setDate(d)} />)}
      </ScrollView>
      <Text style={typography.caption}>Repas</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {(['breakfast', 'lunch', 'dinner'] as MealSlot[]).map((s) => (
          <Chip key={s} label={{ breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner' }[s]} selected={slot === s} onPress={() => setSlot(s)} />
        ))}
      </View>
      <Text style={[typography.caption, { color: colors.textFaint }]}>Si un repas est déjà prévu sur ce créneau, il sera remplacé.</Text>
      {error && <Banner tone="danger">{error}</Banner>}
      <Button label="Ajouter au planning" icon="calendar-outline" onPress={save} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
