import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FoodItemRow } from '@/components/FoodItemRow';
import { Banner, Chip, EmptyState, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEntitlements } from '@/features/billing/EntitlementsProvider';
import { useInventory } from '@/features/inventory/useInventory';
import { CATEGORIES, STORAGE } from '@/lib/catalog';
import type { StorageKind } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

type SortMode = 'expiry' | 'category';

export default function StockScreen() {
  const params = useLocalSearchParams<{ kind?: StorageKind }>();
  const { profile } = useAuth();
  const { canWrite } = useEntitlements();
  const { items, locations, loading, error } = useInventory();
  const [kind, setKind] = useState<StorageKind>(params.kind ?? 'fridge');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('category');
  const alertDays = profile?.expiry_alert_days ?? 2;

  const locationIds = useMemo(() => new Set(locations.filter((l) => l.kind === kind).map((l) => l.id)), [locations, kind]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fr-FR');
    return items.filter((i) => locationIds.has(i.storage_location_id) && (!q || i.name.toLocaleLowerCase('fr-FR').includes(q)));
  }, [items, locationIds, query]);

  const sections = useMemo(() => {
    if (sort === 'expiry') return [{ id: 'all', label: '', items: visible }];
    return CATEGORIES.map((c) => ({ id: c.id, label: c.label, items: visible.filter((i) => i.category_id === c.id) })).filter((s) => s.items.length > 0);
  }, [visible, sort]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Mon stock</Text>
        {canWrite && (
          <Pressable accessibilityLabel="Ajouter un aliment" onPress={() => router.push({ pathname: '/item/new', params: { kind } })} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      <View style={styles.segment}>
        {STORAGE.map((s) => {
          const active = s.kind === kind;
          return (
            <Pressable key={s.kind} onPress={() => setKind(s.kind)} style={[styles.segmentItem, active && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Text style={[styles.segmentLabel, active && { color: colors.text }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un aliment" placeholderTextColor={colors.textFaint} style={styles.searchInput} returnKeyType="search" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="Par catégorie" selected={sort === 'category'} onPress={() => setSort('category')} icon="albums-outline" />
        <Chip label="Par date" selected={sort === 'expiry'} onPress={() => setSort('expiry')} icon="calendar-outline" />
      </ScrollView>

      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <ActivityIndicator color={colors.sage} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="file-tray-outline"
          title={query ? 'Aucun résultat' : 'Rien ici pour le moment'}
          message={query ? 'Essayez un autre mot.' : 'Scannez cet espace ou ajoutez un aliment avec le bouton +.'}
        />
      ) : (
        sections.map((section) => (
          <View key={section.id} style={{ gap: spacing.sm }}>
            {section.label ? <Text style={typography.micro}>{section.label.toUpperCase()} · {section.items.length}</Text> : null}
            {section.items.map((it) => (
              <FoodItemRow key={it.id} item={it} alertDays={alertDays} onPress={() => router.push(`/item/${it.id}`)} />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.sageMist, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentLabel: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 48, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text },
});
