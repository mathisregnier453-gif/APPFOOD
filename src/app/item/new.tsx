import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { createItem, fetchLocations } from '@/features/inventory/api';
import { ItemForm, type ItemFormValue, parseQuantity, validateItemForm } from '@/features/inventory/ItemForm';
import { parseFrDate } from '@/lib/expiry';
import { CATEGORIES, UNITS } from '@/lib/catalog';
import type { CategoryId, FoodUnit, StorageKind, StorageLocation } from '@/lib/types';
import { typography } from '@/theme';
import { track } from '@/lib/observability';

export default function NewItemScreen() {
  const params = useLocalSearchParams<{ kind?: StorageKind; barcode?: string; name?: string; category?: CategoryId; quantity?: string; unit?: FoodUnit; notFound?: string }>();
  const { kind } = params;
  const { session, householdId } = useAuth();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [value, setValue] = useState<ItemFormValue>({
    name: params.name ?? '',
    category: params.category && CATEGORIES.some((c) => c.id === params.category) ? params.category : 'other',
    locationId: '',
    quantityInput: params.quantity ?? '1',
    unit: params.unit && UNITS.some((u) => u.id === params.unit) ? params.unit : 'piece',
    expiryInput: '',
    expiryKind: null,
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    void fetchLocations(householdId).then((locs) => {
      setLocations(locs);
      const preferred = locs.find((l) => l.kind === (kind ?? 'fridge')) ?? locs[0];
      setValue((v) => ({ ...v, locationId: preferred?.id ?? '' }));
    });
  }, [householdId, kind]);

  const errors = submitted ? validateItemForm(value) : {};

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(validateItemForm(value)).length > 0 || !session || !householdId) return;
    setSaving(true);
    try {
      const expiry = value.expiryInput.trim() ? parseFrDate(value.expiryInput) : null;
      await createItem(householdId, session.user.id, {
        name: value.name.trim(),
        category_id: value.category,
        storage_location_id: value.locationId,
        quantity: parseQuantity(value.quantityInput),
        unit: value.unit,
        expiry_date: expiry,
        expiry_kind: expiry ? value.expiryKind : null,
        barcode: params.barcode && /^\d{8,14}$/.test(params.barcode) ? params.barcode : null,
      });
      track('item_added_manually', { barcode: !!params.barcode });
      router.back();
    } catch {
      setError("L'ajout a échoué. Réessayez.");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Text style={typography.title}>Ajouter un aliment</Text>
        {params.barcode ? (
          <Banner tone="info">
            {params.notFound ? `Code ${params.barcode} inconnu d'Open Food Facts : complétez la fiche.` : 'Fiche pré-remplie depuis Open Food Facts : vérifiez-la et ajoutez la date de péremption.'}
          </Banner>
        ) : (
          <Button label="Scanner un code-barres" icon="barcode-outline" variant="secondary" size="md" onPress={() => router.replace({ pathname: '/item/barcode', params: { kind: kind ?? 'fridge' } })} />
        )}
        <ItemForm value={value} onChange={setValue} locations={locations} errors={errors} />
        {error && <Banner tone="danger">{error}</Banner>}
        <Button label="Ajouter au stock" icon="checkmark" onPress={save} loading={saving} />
        <Button label="Annuler" variant="ghost" onPress={() => router.back()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
