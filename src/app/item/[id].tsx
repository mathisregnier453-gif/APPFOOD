import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Banner, Card, CategoryIcon, ExpiryBadge, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { openPaywall, useEntitlements } from '@/features/billing/EntitlementsProvider';
import {
  deleteItem, fetchItem, fetchItemHistory, fetchLocations, finishItem, setQuantity, updateItem,
} from '@/features/inventory/api';
import { ItemForm, type ItemFormValue, validateItemForm } from '@/features/inventory/ItemForm';
import { formatQuantity } from '@/lib/catalog';
import { getExpiryStatus, isoToFrInput, localTodayIso, parseFrDate } from '@/lib/expiry';
import type { ConsumptionLog, FoodItem, StorageLocation } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const REASON_LABEL: Record<ConsumptionLog['reason'], string> = {
  consumed: 'Consommé', finished: 'Terminé', discarded: 'Jeté', recipe: 'Recette', adjusted: 'Quantité corrigée', moved: 'Déplacé',
};

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { householdId, profile } = useAuth();
  const { can } = useEntitlements();
  const [item, setItem] = useState<FoodItem | null>(null);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [history, setHistory] = useState<ConsumptionLog[]>([]);
  const [form, setForm] = useState<ItemFormValue | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !householdId) return;
    const [it, locs, hist] = await Promise.all([fetchItem(id), fetchLocations(householdId), fetchItemHistory(id)]);
    setItem(it);
    setLocations(locs);
    setHistory(hist);
    if (it) {
      setForm({
        name: it.name, category: it.category_id, locationId: it.storage_location_id,
        quantityInput: it.quantity?.toString() ?? '', unit: it.unit,
        expiryInput: isoToFrInput(it.expiry_date), expiryKind: it.expiry_kind,
      });
    }
  }, [id, householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after ? after() : await load();
    } catch {
      setError("L'opération a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  if (!item || !form) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={colors.sage} style={{ marginTop: spacing.xxl * 2 }} />
      </Screen>
    );
  }

  const expiry = getExpiryStatus(item.expiry_date, item.expiry_kind, localTodayIso(), profile?.expiry_alert_days ?? 2);
  const location = locations.find((l) => l.id === item.storage_location_id);
  const errors = validateItemForm(form);

  const saveEdits = () => {
    if (Object.keys(errors).length > 0) return;
    const expiryDate = form.expiryInput.trim() ? parseFrDate(form.expiryInput) : null;
    void run(
      () => updateItem(item.id, {
        name: form.name.trim(), category_id: form.category, storage_location_id: form.locationId, unit: form.unit,
        expiry_date: expiryDate, expiry_kind: expiryDate ? form.expiryKind : null,
      }),
      () => {
        setEditing(false);
        void load();
      },
    );
  };

  const confirmDelete = () =>
    Alert.alert('Supprimer cet aliment ?', "Il sera retiré du stock sans être compté comme consommé (utile en cas d'erreur de saisie).", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void run(() => deleteItem(item.id), () => router.back()) },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.header}>
          <CategoryIcon categoryId={item.category_id} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={typography.title}>{item.name}</Text>
            <Text style={typography.caption}>{location?.name}</Text>
          </View>
        </View>

        {error && <Banner tone="danger">{error}</Banner>}

        {editing ? (
          <>
            <ItemForm value={form} onChange={setForm} locations={locations} errors={errors} showQuantity={false} />
            <Button label="Enregistrer" icon="checkmark" onPress={saveEdits} loading={busy} />
            <Button label="Annuler" variant="ghost" onPress={() => setEditing(false)} />
          </>
        ) : (
          <>
            <Card style={{ gap: spacing.md }}>
              <Text style={typography.caption}>Quantité</Text>
              <QuantityStepper
                quantity={item.quantity}
                unit={item.unit}
                isEstimate={item.quantity_is_estimate}
                onChange={(q) => void run(() => setQuantity(item.id, q, q !== null && item.quantity !== null && q < item.quantity ? 'consumed' : 'adjusted'))}
              />
              {item.quantity_is_estimate && <Text style={typography.caption}>Quantité estimée par le scan : ajustez-la si besoin.</Text>}
            </Card>

            <Card style={{ gap: spacing.sm }}>
              <Text style={typography.caption}>Péremption</Text>
              {expiry.level === 'none' ? (
                <Text style={typography.body}>Aucune date renseignée.</Text>
              ) : (
                <ExpiryBadge level={expiry.level} label={expiry.label} />
              )}
              {expiry.advice && <Text style={[typography.body, { color: colors.textMuted }]}>{expiry.advice}</Text>}
            </Card>

            <View style={{ gap: spacing.sm }}>
              <Button label="C'est terminé" icon="checkmark-done-outline" onPress={() => void run(() => finishItem(item.id, 'finished'), () => router.back())} loading={busy} />
              <Button label="Modifier / déplacer" icon="create-outline" variant="secondary" onPress={() => setEditing(true)} />
              <Button label="Jeté" icon="trash-bin-outline" variant="secondary" onPress={() => void run(() => finishItem(item.id, 'discarded'), () => router.back())} />
              <Button label="Supprimer (erreur de saisie)" variant="ghost" onPress={confirmDelete} />
            </View>

            {!can('consumption_history') && (
              <Card onPress={() => openPaywall('history')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Text style={[typography.body, { flex: 1 }]}>Historique de consommation</Text>
                <Text style={{ color: colors.sageDark, fontWeight: '600' }}>Premium</Text>
              </Card>
            )}
            {history.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <SectionTitle title="Historique" />
                {history.map((h) => (
                  <View key={h.id} style={styles.histRow}>
                    <Text style={typography.body}>{REASON_LABEL[h.reason]}</Text>
                    <Text style={typography.caption}>
                      {h.quantity_delta !== null && h.unit ? `${h.quantity_delta > 0 ? '+' : '−'}${formatQuantity(Math.abs(h.quantity_delta), h.unit)} · ` : ''}
                      {new Date(h.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
