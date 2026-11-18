import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { ExpiryReader } from '@/components/ExpiryReader';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Banner, Card, CategoryIcon, Chip, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { captureStats, type CaptureDraft, defaultStorage, makeDraft } from '@/features/capture/drafts';
import { clearCapture, takeCapture } from '@/features/capture/store';
import { fetchLocations } from '@/features/inventory/api';
import { CATEGORIES, categoryById, STORAGE, UNITS } from '@/lib/catalog';
import { isoToFrInput, parseFrDate } from '@/lib/expiry';
import { track } from '@/lib/observability';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme';

const METHOD_LABEL = { barcode: 'Codes-barres', receipt: 'Ticket de caisse', manual: 'Saisie' } as const;

export default function ConfirmCapture() {
  const { session, householdId } = useAuth();
  const captured = useRef(takeCapture());
  const method = captured.current?.method ?? 'manual';
  const initial = useRef<CaptureDraft[]>(captured.current?.drafts ?? []);
  const [drafts, setDrafts] = useState<CaptureDraft[]>(initial.current);
  const [open, setOpen] = useState<string | null>(initial.current.find((d) => d.needsReview)?.key ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<CaptureDraft>) => setDrafts((p) => p.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const toReview = drafts.filter((d) => d.needsReview).length;
  const invalid = useMemo(() => drafts.filter((d) => d.name.trim().length < 2 || (d.expiryInput.trim() && !parseFrDate(d.expiryInput))), [drafts]);

  const addLine = () => {
    const d = makeDraft({ name: '', category: 'other', quantity: 1, unit: 'piece' });
    setDrafts((p) => [d, ...p]);
    setOpen(d.key);
  };

  const save = async () => {
    if (!session || !householdId) return;
    if (invalid.length) {
      setOpen(invalid[0].key);
      setError('Complétez les noms manquants et vérifiez les dates (JJ/MM/AAAA).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const locations = await fetchLocations(householdId);
      const locFor = (kind: string) => locations.find((l) => l.kind === kind)?.id ?? locations[0].id;
      const rows = drafts.map((d) => {
        const expiry = d.expiryInput.trim() ? parseFrDate(d.expiryInput) : null;
        return {
          household_id: householdId, created_by: session.user.id, storage_location_id: locFor(d.storage),
          name: d.name.trim().slice(0, 80), category_id: d.category, quantity: d.quantity, unit: d.unit,
          quantity_is_estimate: false, expiry_date: expiry, expiry_kind: expiry ? d.expiryKind : null,
          barcode: d.barcode, source: method === 'barcode' ? 'barcode' : method === 'receipt' ? 'receipt' : 'manual',
        };
      });
      const { error: insertError } = await supabase.from('food_items').insert(rows);
      if (insertError) throw insertError;
      const stats = captureStats(initial.current, drafts);
      // Mesure de qualité (anonyme dans les statistiques) ; un échec ici ne bloque pas l'ajout.
      void supabase.from('capture_events').insert({ household_id: householdId, user_id: session.user.id, method, ...stats });
      track('scan_completed', { items: drafts.length, photos: 0, from_cache: false });
      clearCapture();
      router.dismissAll();
      router.replace('/stock');
    } catch {
      setError("L'ajout a échoué. Vos modifications sont conservées : réessayez.");
      setSaving(false);
    }
  };

  const discard = () =>
    Alert.alert('Abandonner ?', 'Ces produits ne seront pas ajoutés à votre stock.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Abandonner', style: 'destructive', onPress: () => { clearCapture(); router.dismissAll(); } },
    ]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={typography.title}>{drafts.length} produit{drafts.length > 1 ? 's' : ''}</Text>
          <Text style={typography.caption}>{METHOD_LABEL[method]} · vérifiez puis ajoutez</Text>
        </View>
        <Pressable accessibilityLabel="Abandonner" onPress={discard} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      {toReview > 0 && <Banner tone="warning">{toReview} ligne{toReview > 1 ? 's' : ''} à vérifier (lecture incertaine ou produit inconnu).</Banner>}

      <Button label="Ajouter un produit" icon="add" variant="secondary" size="md" onPress={addLine} />

      <View style={{ gap: spacing.md }}>
        {drafts.map((d, i) => {
          const isOpen = open === d.key;
          return (
            <Animated.View key={d.key} entering={FadeInDown.delay(Math.min(i, 8) * 30)} layout={LinearTransition}>
              <Card style={[{ gap: spacing.md }, d.needsReview && { borderWidth: 1, borderColor: colors.warning }]}>
                <Pressable style={styles.row} onPress={() => setOpen(isOpen ? null : d.key)}>
                  <CategoryIcon categoryId={d.category} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={typography.heading} numberOfLines={1}>{d.name || 'Nom à compléter'}</Text>
                    <Text style={typography.caption} numberOfLines={1}>
                      {categoryById(d.category).label} · {STORAGE.find((s) => s.kind === d.storage)?.label}
                      {d.expiryInput ? ` · ${d.expiryKind ? d.expiryKind.toUpperCase() + ' ' : ''}${d.expiryInput}` : ''}
                    </Text>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'create-outline'} size={18} color={colors.textMuted} />
                </Pressable>
                <View style={styles.row}>
                  <QuantityStepper quantity={d.quantity} unit={d.unit} onChange={(q) => update(d.key, { quantity: q })} />
                  <View style={{ flex: 1 }} />
                  <Pressable accessibilityLabel={`Retirer ${d.name}`} onPress={() => setDrafts((p) => p.filter((x) => x.key !== d.key))} hitSlop={8} style={styles.trash}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
                {isOpen && (
                  <View style={styles.editor}>
                    <TextInput value={d.name} onChangeText={(name) => update(d.key, { name, needsReview: false })} placeholder="Nom du produit" placeholderTextColor={colors.textFaint} style={styles.input} maxLength={80} />
                    <Text style={typography.micro}>RANGER DANS</Text>
                    <View style={styles.wrap}>
                      {STORAGE.map((s) => <Chip key={s.kind} label={s.label} selected={d.storage === s.kind} onPress={() => update(d.key, { storage: s.kind })} />)}
                    </View>
                    <Text style={typography.micro}>CATÉGORIE</Text>
                    <View style={styles.wrap}>
                      {CATEGORIES.map((c) => <Chip key={c.id} label={c.label} selected={d.category === c.id} onPress={() => update(d.key, { category: c.id, storage: d.storage === defaultStorage(d.category) ? defaultStorage(c.id) : d.storage })} />)}
                    </View>
                    <Text style={typography.micro}>UNITÉ</Text>
                    <View style={styles.wrap}>
                      {UNITS.map((u) => <Chip key={u.id} label={u.label} selected={d.unit === u.id} onPress={() => update(d.key, { unit: u.id })} />)}
                    </View>
                    <Text style={typography.micro}>DATE DE PÉREMPTION (facultatif)</Text>
                    <View style={[styles.row, { gap: spacing.sm }]}>
                      <TextInput value={d.expiryInput} onChangeText={(expiryInput) => update(d.key, { expiryInput })} placeholder="JJ/MM/AAAA" placeholderTextColor={colors.textFaint} keyboardType="numbers-and-punctuation" maxLength={10} style={[styles.input, { flex: 1 }]} />
                      <ExpiryReader onRead={(iso, kind) => update(d.key, { expiryInput: isoToFrInput(iso), expiryKind: kind ?? d.expiryKind })} />
                    </View>
                    <View style={styles.wrap}>
                      <Chip label="DLC" selected={d.expiryKind === 'dlc'} onPress={() => update(d.key, { expiryKind: d.expiryKind === 'dlc' ? null : 'dlc' })} />
                      <Chip label="DDM" selected={d.expiryKind === 'ddm'} onPress={() => update(d.key, { expiryKind: d.expiryKind === 'ddm' ? null : 'ddm' })} />
                    </View>
                  </View>
                )}
              </Card>
            </Animated.View>
          );
        })}
      </View>

      {error && <Banner tone="danger">{error}</Banner>}
      <Button label={`Ajouter ${drafts.length} produit${drafts.length > 1 ? 's' : ''} au stock`} icon="checkmark" onPress={save} loading={saving} disabled={drafts.length === 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trash: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' },
  editor: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  input: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.background },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
