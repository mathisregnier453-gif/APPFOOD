import { StyleSheet, Text, View } from 'react-native';
import { Chip, Field } from '@/components/ui';
import { CATEGORIES, STORAGE, UNITS } from '@/lib/catalog';
import { ExpiryReader } from '@/components/ExpiryReader';
import { isoToFrInput, parseFrDate } from '@/lib/expiry';
import type { CategoryId, ExpiryKind, FoodUnit, StorageLocation } from '@/lib/types';
import { spacing, typography } from '@/theme';

export interface ItemFormValue {
  name: string;
  category: CategoryId;
  locationId: string;
  quantityInput: string;
  unit: FoodUnit;
  expiryInput: string;
  expiryKind: ExpiryKind | null;
}

export function validateItemForm(v: ItemFormValue): Partial<Record<'name' | 'quantity' | 'expiry', string>> {
  const errors: Partial<Record<'name' | 'quantity' | 'expiry', string>> = {};
  if (v.name.trim().length < 2) errors.name = 'Indiquez un nom (2 caractères minimum).';
  if (v.quantityInput.trim() && !(Number(v.quantityInput.replace(',', '.')) >= 0)) errors.quantity = 'Quantité invalide.';
  if (v.expiryInput.trim() && !parseFrDate(v.expiryInput)) errors.expiry = 'Format attendu : JJ/MM/AAAA.';
  return errors;
}

export function parseQuantity(input: string): number | null {
  if (!input.trim()) return null;
  const n = Number(input.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

interface Props {
  value: ItemFormValue;
  onChange: (next: ItemFormValue) => void;
  locations: StorageLocation[];
  errors: ReturnType<typeof validateItemForm>;
  showQuantity?: boolean;
}

export function ItemForm({ value, onChange, locations, errors, showQuantity = true }: Props) {
  const set = (patch: Partial<ItemFormValue>) => onChange({ ...value, ...patch });
  return (
    <View style={{ gap: spacing.lg }}>
      <Field label="Nom" value={value.name} onChangeText={(name) => set({ name })} placeholder="Ex. Tomates cerises" maxLength={80} error={errors.name} />

      <View style={styles.group}>
        <Text style={typography.caption}>Emplacement</Text>
        <View style={styles.wrap}>
          {locations.map((l) => (
            <Chip
              key={l.id}
              label={l.name}
              icon={STORAGE.find((s) => s.kind === l.kind)?.icon as never}
              selected={value.locationId === l.id}
              onPress={() => set({ locationId: l.id })}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={typography.caption}>Catégorie</Text>
        <View style={styles.wrap}>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} selected={value.category === c.id} onPress={() => set({ category: c.id })} />
          ))}
        </View>
      </View>

      {showQuantity && (
        <Field
          label="Quantité (laisser vide si inconnue)"
          value={value.quantityInput}
          onChangeText={(quantityInput) => set({ quantityInput })}
          keyboardType="decimal-pad"
          placeholder="Ex. 2"
          error={errors.quantity}
        />
      )}
      <View style={styles.group}>
        <Text style={typography.caption}>Unité</Text>
        <View style={styles.wrap}>
          {UNITS.map((u) => (
            <Chip key={u.id} label={u.label} selected={value.unit === u.id} onPress={() => set({ unit: u.id })} />
          ))}
        </View>
      </View>

      <Field
        label="Date de péremption (facultatif)"
        value={value.expiryInput}
        onChangeText={(expiryInput) => set({ expiryInput })}
        placeholder="JJ/MM/AAAA"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={errors.expiry}
      />
      <ExpiryReader onRead={(iso, kind) => set({ expiryInput: isoToFrInput(iso), expiryKind: kind ?? value.expiryKind })} />
      <View style={styles.wrap}>
        <Chip label="DLC · à consommer jusqu'au" selected={value.expiryKind === 'dlc'} onPress={() => set({ expiryKind: value.expiryKind === 'dlc' ? null : 'dlc' })} />
        <Chip label="DDM · de préférence avant" selected={value.expiryKind === 'ddm'} onPress={() => set({ expiryKind: value.expiryKind === 'ddm' ? null : 'ddm' })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
