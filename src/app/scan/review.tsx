import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Banner, Card, CategoryIcon, Chip, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchLocations } from '@/features/inventory/api';
import { cancelScan, type ConfirmItem, confirmScan } from '@/features/scan/api';
import { CATEGORIES, categoryById, storageByKind, UNITS } from '@/lib/catalog';
import { isoToFrInput, parseFrDate } from '@/lib/expiry';
import { supabase } from '@/lib/supabase';
import type { CategoryId, ExpiryKind, FoodUnit, ScanDetection, StorageKind, StorageLocation } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

interface Draft {
  key: string;
  detectionId: string | null;
  name: string;
  category: CategoryId;
  quantity: number | null;
  unit: FoodUnit;
  quantityIsEstimate: boolean;
  expiryInput: string;
  expiryKind: ExpiryKind | null;
  confidence: number | null;
}

const LOW_CONFIDENCE = 0.6;

function fromDetection(d: ScanDetection): Draft {
  return {
    key: d.id,
    detectionId: d.id,
    name: d.name,
    category: d.category_id,
    quantity: d.quantity,
    unit: d.unit,
    quantityIsEstimate: d.quantity_is_estimate,
    expiryInput: isoToFrInput(d.expiry_date),
    expiryKind: d.expiry_kind,
    confidence: d.confidence,
  };
}

export default function ScanReviewScreen() {
  const { sessionId, kind } = useLocalSearchParams<{ sessionId: string; kind: StorageKind }>();
  const { householdId } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [targetKind, setTargetKind] = useState<StorageKind>(kind ?? 'fridge');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId || !sessionId) return;
    void (async () => {
      const [{ data }, locs] = await Promise.all([
        supabase
          .from('scan_detections')
          .select('id, name, category_id, quantity, unit, quantity_is_estimate, expiry_date, expiry_kind, confidence, photo_index')
          .eq('session_id', sessionId)
          .order('confidence', { ascending: false }),
        fetchLocations(householdId),
      ]);
      setDrafts(((data ?? []) as ScanDetection[]).map(fromDetection));
      setLocations(locs);
      setLoading(false);
    })();
  }, [householdId, sessionId]);

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const remove = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const addManual = () => {
    const key = `manual-${Date.now()}`;
    setDrafts((prev) => [
      { key, detectionId: null, name: '', category: 'other', quantity: 1, unit: 'piece', quantityIsEstimate: false, expiryInput: '', expiryKind: null, confidence: null },
      ...prev,
    ]);
    setExpanded(key);
  };

  const invalid = useMemo(
    () => drafts.filter((d) => d.name.trim().length < 2 || (d.expiryInput.trim() !== '' && !parseFrDate(d.expiryInput))),
    [drafts],
  );
  const toCheck = drafts.filter((d) => d.confidence !== null && d.confidence < LOW_CONFIDENCE).length;

  const save = async () => {
    const location = locations.find((l) => l.kind === targetKind);
    if (!location || !sessionId) return;
    if (invalid.length > 0) {
      setExpanded(invalid[0].key);
      setError('Vérifiez les noms et les dates (format JJ/MM/AAAA).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const items: ConfirmItem[] = drafts.map((d) => {
        const expiry = d.expiryInput.trim() ? parseFrDate(d.expiryInput) : null;
        return {
          detection_id: d.detectionId,
          name: d.name.trim(),
          category_id: d.category,
          quantity: d.quantity,
          unit: d.unit,
          quantity_is_estimate: d.quantityIsEstimate,
          expiry_date: expiry,
          expiry_kind: expiry ? d.expiryKind : null,
          storage_location_id: location.id,
        };
      });
      await confirmScan(sessionId, items);
      router.dismissAll();
      router.replace({ pathname: '/stock', params: { kind: targetKind } });
    } catch {
      setError("L'enregistrement a échoué. Vos modifications sont conservées : réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    Alert.alert('Abandonner ce scan ?', 'Les aliments détectés ne seront pas ajoutés à votre stock.', [
      { text: 'Continuer la vérification', style: 'cancel' },
      {
        text: 'Abandonner',
        style: 'destructive',
        onPress: async () => {
          if (sessionId) await cancelScan(sessionId);
          router.dismissAll();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={colors.sage} style={{ marginTop: spacing.xxl * 2 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={typography.title}>{drafts.length} aliment{drafts.length > 1 ? 's' : ''} détecté{drafts.length > 1 ? 's' : ''}</Text>
          <Text style={typography.caption}>Vérifiez, corrigez puis validez.</Text>
        </View>
        <Pressable accessibilityLabel="Abandonner" onPress={discard} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      {toCheck > 0 && <Banner tone="warning">{toCheck} produit{toCheck > 1 ? 's' : ''} à vérifier : la reconnaissance est incertaine.</Banner>}
      {drafts.length === 0 && (
        <Banner tone="info">Aucun aliment n'a pu être identifié avec certitude. Essayez une photo plus nette et mieux éclairée, ou ajoutez vos produits à la main.</Banner>
      )}

      <View style={{ gap: spacing.sm }}>
        <Text style={typography.caption}>Ranger dans</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {(['fridge', 'freezer', 'pantry'] as StorageKind[]).map((k) => (
            <Chip key={k} label={storageByKind(k).label} selected={k === targetKind} onPress={() => setTargetKind(k)} />
          ))}
        </ScrollView>
      </View>

      <Button label="Ajouter un produit oublié" icon="add" variant="secondary" size="md" onPress={addManual} />

      <View style={{ gap: spacing.md }}>
        {drafts.map((d, index) => {
          const open = expanded === d.key;
          const uncertain = d.confidence !== null && d.confidence < LOW_CONFIDENCE;
          return (
            <Animated.View key={d.key} entering={FadeInDown.delay(Math.min(index, 8) * 40)} layout={LinearTransition}>
              <Card style={[styles.item, uncertain && { borderColor: colors.warning, borderWidth: 1 }]}>
                <Pressable style={styles.itemHead} onPress={() => setExpanded(open ? null : d.key)}>
                  <CategoryIcon categoryId={d.category} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={typography.heading} numberOfLines={1}>{d.name || 'Nouveau produit'}</Text>
                    <Text style={typography.caption} numberOfLines={1}>
                      {categoryById(d.category).label}
                      {d.expiryInput ? ` · ${d.expiryKind ? d.expiryKind.toUpperCase() + ' ' : ''}${d.expiryInput}` : ''}
                      {uncertain ? ' · à vérifier' : ''}
                    </Text>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'create-outline'} size={18} color={colors.textMuted} />
                </Pressable>

                <View style={styles.itemFoot}>
                  <QuantityStepper
                    quantity={d.quantity}
                    unit={d.unit}
                    isEstimate={d.quantityIsEstimate}
                    onChange={(q) => update(d.key, { quantity: q, quantityIsEstimate: false })}
                  />
                  <Pressable accessibilityLabel={`Retirer ${d.name}`} onPress={() => remove(d.key)} hitSlop={8} style={styles.trash}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>

                {open && (
                  <View style={styles.editor}>
                    <TextInput
                      value={d.name}
                      onChangeText={(name) => update(d.key, { name })}
                      placeholder="Nom du produit"
                      placeholderTextColor={colors.textFaint}
                      style={styles.input}
                      maxLength={80}
                    />
                    <Text style={typography.micro}>CATÉGORIE</Text>
                    <View style={styles.wrap}>
                      {CATEGORIES.map((c) => (
                        <Chip key={c.id} label={c.label} selected={d.category === c.id} onPress={() => update(d.key, { category: c.id })} />
                      ))}
                    </View>
                    <Text style={typography.micro}>UNITÉ</Text>
                    <View style={styles.wrap}>
                      {UNITS.map((u) => (
                        <Chip key={u.id} label={u.label} selected={d.unit === u.id} onPress={() => update(d.key, { unit: u.id })} />
                      ))}
                    </View>
                    <Text style={typography.micro}>DATE DE PÉREMPTION (facultatif)</Text>
                    <TextInput
                      value={d.expiryInput}
                      onChangeText={(expiryInput) => update(d.key, { expiryInput })}
                      placeholder="JJ/MM/AAAA"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="numbers-and-punctuation"
                      style={styles.input}
                      maxLength={10}
                    />
                    <View style={styles.wrap}>
                      <Chip label="DLC · à consommer jusqu'au" selected={d.expiryKind === 'dlc'} onPress={() => update(d.key, { expiryKind: d.expiryKind === 'dlc' ? null : 'dlc' })} />
                      <Chip label="DDM · de préférence avant" selected={d.expiryKind === 'ddm'} onPress={() => update(d.key, { expiryKind: d.expiryKind === 'ddm' ? null : 'ddm' })} />
                    </View>
                  </View>
                )}
              </Card>
            </Animated.View>
          );
        })}
      </View>

      {error && <Banner tone="danger">{error}</Banner>}

      <Button
        label={drafts.length === 0 ? 'Terminer' : `Ajouter ${drafts.length} aliment${drafts.length > 1 ? 's' : ''} au stock`}
        icon="checkmark"
        onPress={drafts.length === 0 ? () => void cancelScan(sessionId!).then(() => router.dismissAll()) : save}
        loading={saving}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  item: { gap: spacing.md },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trash: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' },
  editor: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    fontSize: 16, color: colors.text, backgroundColor: colors.background,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
