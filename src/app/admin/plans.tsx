import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Card } from '@/components/ui';
import { type AdminPlan, fetchPlansAdmin, updatePlan } from '@/features/admin/api';
import { colors, radius, spacing, typography } from '@/theme';

const NUMBER_FIELDS: { key: keyof AdminPlan; label: string; nullable?: boolean }[] = [
  { key: 'monthly_scan_quota', label: 'Scans / mois' },
  { key: 'monthly_recipe_quota', label: 'Recettes / mois (vide = illimité)', nullable: true },
  { key: 'fair_use_recipe_cap', label: 'Plafond usage raisonnable' },
  { key: 'max_members', label: 'Membres max.' },
  { key: 'max_photos_per_scan', label: 'Photos par scan' },
  { key: 'price_monthly_cents', label: 'Prix mensuel de référence (centimes)' },
  { key: 'price_yearly_cents', label: 'Prix annuel de référence (centimes)', nullable: true },
];
const FEATURES: { key: string; label: string }[] = [
  { key: 'meal_plan', label: 'Planning' }, { key: 'favorites', label: 'Favoris' },
  { key: 'smart_notifications', label: 'Rappels intelligents' }, { key: 'consumption_history', label: 'Historique' },
  { key: 'shared_household', label: 'Foyer partagé' },
];

function PlanEditor({ plan, onSaved }: { plan: AdminPlan; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(NUMBER_FIELDS.map((f) => [f.key, plan[f.key] === null ? '' : String(plan[f.key])])),
  );
  const [features, setFeatures] = useState(plan.features);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  const save = async () => {
    const patch: Record<string, unknown> = { features };
    for (const f of NUMBER_FIELDS) {
      const raw = values[f.key].trim();
      if (raw === '' && f.nullable) patch[f.key] = null;
      else if (/^\d+$/.test(raw)) patch[f.key] = Number(raw);
      else {
        setMessage({ tone: 'danger', text: `Valeur invalide : ${f.label}` });
        return;
      }
    }
    setSaving(true);
    try {
      await updatePlan(plan.code, patch);
      setMessage({ tone: 'info', text: 'Enregistré (journalisé).' });
      onSaved();
    } catch {
      setMessage({ tone: 'danger', text: 'Refusé : valeurs hors limites ou droits insuffisants.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={typography.heading}>{plan.label}</Text>
      {NUMBER_FIELDS.map((f) => (
        <View key={f.key} style={styles.field}>
          <Text style={[typography.caption, { flex: 1 }]}>{f.label}</Text>
          <TextInput value={values[f.key]} onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))} keyboardType="number-pad" style={styles.input} />
        </View>
      ))}
      {FEATURES.map((f) => (
        <View key={f.key} style={styles.field}>
          <Text style={[typography.body, { flex: 1 }]}>{f.label}</Text>
          <Switch value={features[f.key] === true} onValueChange={(v) => setFeatures((x) => ({ ...x, [f.key]: v }))} trackColor={{ true: colors.sage, false: colors.border }} />
        </View>
      ))}
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
      <Button label="Enregistrer" size="md" onPress={save} loading={saving} />
    </Card>
  );
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const load = () => void fetchPlansAdmin().then(setPlans);
  useEffect(load, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Offres et quotas' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Banner tone="info">Les quotas et fonctions s'appliquent immédiatement à tous les foyers concernés. Les prix facturés se modifient dans App Store Connect et Google Play ; les prix ci-dessous servent aux calculs de marge.</Banner>
        {!plans ? <ActivityIndicator color={colors.sage} /> : plans.map((p) => <PlanEditor key={p.code} plan={p} onSaved={load} />)}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: { width: 96, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, textAlign: 'right', color: colors.text, backgroundColor: colors.background },
});
