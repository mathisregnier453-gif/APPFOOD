import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Banner, Card, CategoryIcon, Chip, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchLocations } from '@/features/inventory/api';
import { activeListId, fetchShoppingItems, purchaseItems } from '@/features/planning/api';
import { defaultStorageFor } from '@/features/planning/shopping';
import { parseFrDate } from '@/lib/expiry';
import type { FoodUnit, ShoppingItem, StorageLocation } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

interface Draft {
  item: ShoppingItem;
  locationId: string;
  quantity: number | null;
  unit: FoodUnit;
  expiryInput: string;
}

// Les articles cochés sont ajoutés au stock (emplacement proposé selon la catégorie).
export default function PurchaseScreen() {
  const { householdId } = useAuth();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    void (async () => {
      const [locs, listId] = await Promise.all([fetchLocations(householdId), activeListId(householdId)]);
      const items = (await fetchShoppingItems(listId)).filter((i) => i.is_checked);
      setLocations(locs);
      setDrafts(items.map((item) => ({
        item,
        locationId: (locs.find((l) => l.kind === defaultStorageFor(item.category_id)) ?? locs[0]).id,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? 'piece',
        expiryInput: '',
      })));
      setLoading(false);
    })();
  }, [householdId]);

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.item.id === id ? { ...d, ...patch } : d)));

  const invalid = drafts.some((d) => d.expiryInput.trim() !== '' && !parseFrDate(d.expiryInput));

  const save = async () => {
    if (invalid) {
      setError('Vérifiez les dates (format JJ/MM/AAAA).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await purchaseItems(drafts.map((d) => ({
        item_id: d.item.id, storage_location_id: d.locationId, quantity: d.quantity, unit: d.unit,
        expiry_date: d.expiryInput.trim() ? parseFrDate(d.expiryInput) : null, expiry_kind: null,
      })));
      router.back();
    } catch {
      setError("L'ajout au stock a échoué. Réessayez.");
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Ranger mes achats</Text>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[typography.body, { color: colors.textMuted }]}>Ajustez si besoin, ajoutez la date de péremption des produits frais, puis validez.</Text>

      {loading ? (
        <ActivityIndicator color={colors.sage} />
      ) : (
        drafts.map((d) => (
          <Card key={d.item.id} style={{ gap: spacing.md }}>
            <View style={styles.row}>
              <CategoryIcon categoryId={d.item.category_id} size={38} />
              <Text style={[typography.heading, { flex: 1 }]} numberOfLines={1}>{d.item.name}</Text>
            </View>
            <QuantityStepper quantity={d.quantity} unit={d.unit} onChange={(q) => update(d.item.id, { quantity: q })} />
            <View style={styles.wrap}>
              {locations.map((l) => (
                <Chip key={l.id} label={l.name} selected={d.locationId === l.id} onPress={() => update(d.item.id, { locationId: l.id })} />
              ))}
            </View>
            <TextInput
              value={d.expiryInput}
              onChangeText={(expiryInput) => update(d.item.id, { expiryInput })}
              placeholder="Date de péremption (JJ/MM/AAAA, facultatif)"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              style={styles.input}
            />
          </Card>
        ))
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      <Button label={`Ajouter ${drafts.length} produit${drafts.length > 1 ? 's' : ''} au stock`} icon="checkmark" onPress={save} loading={saving} disabled={drafts.length === 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.background },
});
