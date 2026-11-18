import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Card, Chip, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { generateWeek } from '@/features/planning/api';
import { BUDGET_LABEL, TIME_OPTIONS } from '@/features/recipes/catalog';
import { dayLabel } from '@/lib/dates';
import { localTodayIso } from '@/lib/expiry';
import { ApiError } from '@/lib/supabase';
import type { MealSlot } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';
import { track } from '@/lib/observability';

const SLOT_OPTIONS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Petit-déjeuner' }, { id: 'lunch', label: 'Déjeuner' }, { id: 'dinner', label: 'Dîner' },
];

export default function GenerateWeekScreen() {
  const { start } = useLocalSearchParams<{ start?: string }>();
  const { profile } = useAuth();
  const startDate = start ?? localTodayIso();
  const [slots, setSlots] = useState<MealSlot[]>(['dinner']);
  const [days, setDays] = useState(7);
  const [servings, setServings] = useState(profile?.household_size ?? 2);
  const [budget, setBudget] = useState<1 | 2 | 3 | null>(null);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(45);
  const [vegetarian, setVegetarian] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = slots.length * days;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await generateWeek({ start_date: startDate, days, slots, servings, budget, max_total_minutes: maxMinutes, vegetarian, overwrite });
      if (res.message === 'already_planned') setError('Tous ces repas sont déjà planifiés. Activez « Remplacer » pour les régénérer.');
      else {
        track('meal_plan_generated', { meals: res.planned });
        router.back();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === 'quota_exceeded' ? 'Quota de recettes du mois atteint : complétez la semaine avec vos recettes enregistrées.'
            : err.code === 'empty_inventory' ? "Votre stock est vide : scannez votre frigo d'abord."
            : "La génération n'a pas abouti. Rien n'a été décompté : réessayez.",
        );
      } else setError('Connexion impossible.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Ma semaine</Text>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[typography.body, { color: colors.textMuted }]}>
        À partir du {dayLabel(startDate)}, avec votre stock (les produits à consommer vite en premier), vos préférences et votre budget. Les repas déjà prévus sont conservés.
      </Text>

      <View style={styles.group}>
        <Text style={typography.caption}>Repas à prévoir</Text>
        <View style={styles.wrap}>
          {SLOT_OPTIONS.map((s) => (
            <Chip key={s.id} label={s.label} selected={slots.includes(s.id)} onPress={() => setSlots((v) => (v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id]))} />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={typography.caption}>Nombre de jours</Text>
        <View style={styles.wrap}>
          {[3, 5, 7].map((d) => <Chip key={d} label={`${d} jours`} selected={days === d} onPress={() => setDays(d)} />)}
        </View>
      </View>

      <Card style={styles.between}>
        <Text style={typography.heading}>Personnes</Text>
        <View style={styles.stepper}>
          <Pressable accessibilityLabel="Moins" onPress={() => setServings((s) => Math.max(1, s - 1))} style={styles.stepBtn}><Ionicons name="remove" size={18} color={colors.text} /></Pressable>
          <Text style={styles.stepValue}>{servings}</Text>
          <Pressable accessibilityLabel="Plus" onPress={() => setServings((s) => Math.min(12, s + 1))} style={styles.stepBtn}><Ionicons name="add" size={18} color={colors.text} /></Pressable>
        </View>
      </Card>

      <View style={styles.group}>
        <Text style={typography.caption}>Temps de cuisine maximum par repas</Text>
        <View style={styles.wrap}>
          {TIME_OPTIONS.map((t) => <Chip key={t} label={`${t} min`} selected={maxMinutes === t} onPress={() => setMaxMinutes((v) => (v === t ? null : t))} />)}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={typography.caption}>Budget</Text>
        <View style={styles.wrap}>
          {([1, 2, 3] as const).map((b) => <Chip key={b} label={BUDGET_LABEL[b]} selected={budget === b} onPress={() => setBudget((v) => (v === b ? null : b))} />)}
        </View>
      </View>

      <Card style={{ gap: spacing.lg }}>
        <View style={styles.between}>
          <Text style={typography.body}>Uniquement végétarien</Text>
          <Switch value={vegetarian} onValueChange={setVegetarian} trackColor={{ true: colors.sage, false: colors.border }} />
        </View>
        <View style={styles.between}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={typography.body}>Remplacer les repas déjà prévus</Text>
            <Text style={typography.caption}>Désactivé : seuls les créneaux vides sont remplis.</Text>
          </View>
          <Switch value={overwrite} onValueChange={setOverwrite} trackColor={{ true: colors.sage, false: colors.border }} />
        </View>
      </Card>

      {error && <Banner tone="warning">{error}</Banner>}

      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.caption, { textAlign: 'center' }]}>Jusqu'à {count} recette{count > 1 ? 's' : ''} (décomptées de votre quota de recettes) · environ une minute</Text>
        <Button label={busy ? 'Préparation de la semaine…' : 'Générer le planning'} icon="sparkles-outline" onPress={run} loading={busy} disabled={slots.length === 0} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center', color: colors.text },
});
