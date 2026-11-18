import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Banner, Card, EmptyState, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEntitlements } from '@/features/billing/EntitlementsProvider';
import { activeListId, addShoppingItems, deleteShoppingItems, fetchShoppingItems, setChecked } from '@/features/planning/api';
import { guessCategory } from '@/features/planning/shopping';
import { CATEGORIES, formatQuantity } from '@/lib/catalog';
import { supabase } from '@/lib/supabase';
import type { ShoppingItem } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

/** "2 kg pommes de terre", "6 oeufs", "lait" => nom + quantité + unité */
function parseEntry(text: string) {
  const t = text.trim().replace(',', '.');
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)?\s+(.+)$/i);
  if (!m) return { name: t, quantity: null, unit: null };
  const n = Number(m[1]);
  const u = m[2]?.toLowerCase();
  if (u === 'cl') return { name: m[3], quantity: n * 10, unit: 'ml' as const };
  return { name: m[3], quantity: n, unit: (u as 'kg' | 'g' | 'l' | 'ml' | undefined) ?? ('piece' as const) };
}

export default function ShoppingScreen() {
  const { householdId } = useAuth();
  const { canWrite } = useEntitlements();
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [entry, setEntry] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const instanceId = useId();

  const reload = useCallback(async () => {
    if (!householdId) return;
    try {
      setError(null);
      const id = listId ?? (await activeListId(householdId));
      setListId(id);
      setItems(await fetchShoppingItems(id));
    } catch {
      setError('Impossible de charger la liste. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [householdId, listId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Liste partagée : mise à jour en temps réel (utile dès qu'un foyer a plusieurs membres).
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`shopping:${householdId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list_items', filter: `household_id=eq.${householdId}` }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, reload, instanceId]);

  const toBuy = useMemo(() => items.filter((i) => !i.is_checked), [items]);
  const checked = useMemo(() => items.filter((i) => i.is_checked), [items]);
  const groups = useMemo(
    () => CATEGORIES.map((c) => ({ ...c, items: toBuy.filter((i) => i.category_id === c.id) })).filter((g) => g.items.length > 0),
    [toBuy],
  );

  const add = async () => {
    if (!householdId || entry.trim().length < 2) return;
    const parsed = parseEntry(entry);
    setEntry('');
    try {
      await addShoppingItems(householdId, [{ ...parsed, category_id: guessCategory(parsed.name) }]);
      await reload();
    } catch {
      setError("L'article n'a pas pu être ajouté.");
    }
  };

  const toggle = async (item: ShoppingItem) => {
    void Haptics.selectionAsync();
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)));
    try {
      await setChecked(item.id, !item.is_checked);
    } catch {
      void reload();
    }
  };

  const remove = async (item: ShoppingItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await deleteShoppingItems([item.id]).catch(() => reload());
  };

  const clearChecked = () =>
    Alert.alert('Retirer les articles cochés ?', "Ils seront supprimés de la liste sans être ajoutés au stock.", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => void deleteShoppingItems(checked.map((i) => i.id)).then(reload) },
    ]);

  const Row = ({ item }: { item: ShoppingItem }) => (
    <Animated.View layout={LinearTransition} entering={FadeIn} style={styles.row}>
      <Pressable onPress={() => void toggle(item)} style={styles.rowMain} accessibilityRole="checkbox" accessibilityState={{ checked: item.is_checked }}>
        <Ionicons name={item.is_checked ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={item.is_checked ? colors.sage : colors.textFaint} />
        <Text style={[typography.body, { flex: 1 }, item.is_checked && styles.done]} numberOfLines={1}>{item.name}</Text>
        {item.quantity !== null && item.unit && <Text style={typography.caption}>{formatQuantity(item.quantity, item.unit)}</Text>}
      </Pressable>
      <Pressable accessibilityLabel={`Supprimer ${item.name}`} onPress={() => void remove(item)} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textFaint} />
      </Pressable>
    </Animated.View>
  );

  return (
    <Screen>
      <Text style={typography.title}>Courses</Text>

      {!canWrite && <Banner tone="warning">Foyer en lecture seule : l'offre Famille n'est plus active.</Banner>}
      <View style={[styles.addBar, !canWrite && { display: 'none' }]}>
        <TextInput
          value={entry}
          onChangeText={setEntry}
          placeholder="Ajouter… (ex. 2 kg pommes de terre)"
          placeholderTextColor={colors.textFaint}
          style={styles.addInput}
          returnKeyType="done"
          onSubmitEditing={() => void add()}
        />
        <Pressable accessibilityLabel="Ajouter" onPress={() => void add()} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <ActivityIndicator color={colors.sage} />
      ) : items.length === 0 ? (
        <EmptyState icon="cart-outline" title="Liste vide" message="Ajoutez un article, ou générez la liste depuis le planning ou une recette : seul ce qui manque dans votre stock y est ajouté." />
      ) : (
        <>
          {groups.map((g) => (
            <View key={g.id} style={{ gap: spacing.xs }}>
              <Text style={typography.micro}>{g.label.toUpperCase()}</Text>
              <Card style={styles.group}>{g.items.map((i) => <Row key={i.id} item={i} />)}</Card>
            </View>
          ))}

          {checked.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.micro}>DANS LE CADDIE · {checked.length}</Text>
              <Card style={styles.group}>{checked.map((i) => <Row key={i.id} item={i} />)}</Card>
              <Button label={`Ranger ${checked.length} achat${checked.length > 1 ? 's' : ''} dans mon stock`} icon="archive-outline" onPress={() => router.push('/shopping/purchase')} />
              <Button label="Retirer les articles cochés" variant="ghost" onPress={clearChecked} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBar: { flexDirection: 'row', gap: spacing.sm },
  addInput: {
    flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: spacing.lg, fontSize: 16, color: colors.text,
  },
  addBtn: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  group: { paddingVertical: spacing.xs, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  done: { textDecorationLine: 'line-through', color: colors.textMuted },
});
