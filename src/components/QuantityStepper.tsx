import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatQuantity, unitById } from '@/lib/catalog';
import type { FoodUnit } from '@/lib/types';
import { colors, radius } from '@/theme';

interface Props {
  quantity: number | null;
  unit: FoodUnit;
  isEstimate?: boolean;
  onChange: (next: number | null) => void;
  compact?: boolean;
}

/** Correction rapide des quantités : un geste par unité, pas de clavier. */
export function QuantityStepper({ quantity, unit, isEstimate, onChange, compact }: Props) {
  const step = unitById(unit).step;
  const change = (dir: 1 | -1) => {
    void Haptics.selectionAsync();
    const base = quantity ?? 0;
    const next = Math.max(0, Math.round((base + dir * step) * 100) / 100);
    onChange(next);
  };
  return (
    <View style={styles.row}>
      <Pressable accessibilityLabel="Diminuer la quantité" hitSlop={8} onPress={() => change(-1)} style={styles.btn} disabled={!quantity}>
        <Ionicons name="remove" size={18} color={quantity ? colors.text : colors.textFaint} />
      </Pressable>
      <Text style={[styles.value, compact && { minWidth: 70 }]} numberOfLines={1}>
        {quantity === null ? '—' : formatQuantity(quantity, unit, isEstimate)}
      </Text>
      <Pressable accessibilityLabel="Augmenter la quantité" hitSlop={8} onPress={() => change(1)} style={styles.btn}>
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.sageMist,
    alignItems: 'center', justifyContent: 'center',
  },
  value: { minWidth: 90, textAlign: 'center', fontSize: 14, fontWeight: '600', color: colors.text },
});
