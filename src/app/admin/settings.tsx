import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Card } from '@/components/ui';
import { fetchFinance, type FinanceSettings, updateFinance } from '@/features/admin/api';
import { colors, radius, spacing, typography } from '@/theme';

const FIELDS: { key: keyof FinanceSettings; label: string; hint: string }[] = [
  { key: 'vat_rate', label: 'Taux de TVA', hint: '0.20 = 20 %' },
  { key: 'store_commission_rate', label: 'Commission des stores', hint: '0.15 = 15 % (Small Business Program)' },
  { key: 'eur_per_usd', label: 'Taux de change EUR / USD', hint: 'coûts IA facturés en dollars' },
  { key: 'hosting_cost_monthly_cents', label: 'Hébergement mensuel (centimes)', hint: 'facture Supabase + services' },
  { key: 'target_margin_per_premium_cents', label: 'Objectif de marge par abonné (centimes)', hint: '300 = 3 €' },
];

export default function AdminSettings() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    void fetchFinance().then((f) => setValues(Object.fromEntries(FIELDS.map((x) => [x.key, String(f[x.key])]))));
  }, []);

  const save = async () => {
    if (!values) return;
    const patch: Record<string, number> = {};
    for (const f of FIELDS) {
      const n = Number(values[f.key].replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        setMessage({ tone: 'danger', text: `Valeur invalide : ${f.label}` });
        return;
      }
      patch[f.key] = n;
    }
    setSaving(true);
    try {
      await updateFinance(patch);
      setMessage({ tone: 'info', text: 'Enregistré (journalisé).' });
    } catch {
      setMessage({ tone: 'danger', text: 'Refusé : valeurs hors limites.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Paramètres financiers' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!values ? <ActivityIndicator color={colors.sage} /> : (
          <Card style={{ gap: spacing.lg }}>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.field}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body}>{f.label}</Text>
                  <Text style={typography.caption}>{f.hint}</Text>
                </View>
                <TextInput value={values[f.key]} onChangeText={(t) => setValues((v) => ({ ...v!, [f.key]: t }))} keyboardType="decimal-pad" style={styles.input} />
              </View>
            ))}
            {message && <Banner tone={message.tone}>{message.text}</Banner>}
            <Button label="Enregistrer" size="md" onPress={save} loading={saving} />
          </Card>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: { width: 100, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, textAlign: 'right', color: colors.text, backgroundColor: colors.background },
});
