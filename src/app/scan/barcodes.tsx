import Ionicons from '@expo/vector-icons/Ionicons';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { addScannedBarcode, type CaptureDraft } from '@/features/capture/drafts';
import { setCapture } from '@/features/capture/store';
import { lookupBarcode } from '@/features/planning/api';
import type { CategoryId } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

const SAME_CODE_DELAY_MS = 2500; // évite de compter deux fois le même passage

// Scan en rafale : un produit après l'autre, sans quitter la caméra.
export default function BarcodeBurst() {
  const [permission, requestPermission] = useCameraPermissions();
  const [drafts, setDrafts] = useState<CaptureDraft[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const seen = useRef(new Map<string, number>());

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    if (!/^\d{8,14}$/.test(data)) return;
    const now = Date.now();
    if (now - (seen.current.get(data) ?? 0) < SAME_CODE_DELAY_MS) return;
    seen.current.set(data, now);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPending((p) => p + 1);
    try {
      const p = await lookupBarcode(data);
      setDrafts((d) => addScannedBarcode(d, { barcode: data, name: p.found ? [p.name, p.brand].filter(Boolean).join(' – ').slice(0, 80) : null, category: (p.category_id as CategoryId | null) ?? null, quantity: p.quantity, unit: p.unit, found: p.found }));
      setLast(p.found ? p.name : `Produit ${data} inconnu : à compléter`);
    } catch {
      setDrafts((d) => addScannedBarcode(d, { barcode: data, name: null, category: null, quantity: null, unit: null, found: false }));
      setLast('Recherche indisponible : à compléter');
    } finally {
      setPending((p) => p - 1);
    }
  };

  const finish = () => {
    setCapture('barcode', drafts);
    router.replace('/scan/confirm');
  };

  if (!permission) return <View style={styles.dark} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.screen, { padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }]}>
        <Text style={typography.title}>Accès à l'appareil photo</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>Il sert uniquement à lire les codes-barres. Aucune image n'est enregistrée ni envoyée.</Text>
        {permission.canAskAgain
          ? <Button label="Autoriser" onPress={() => void requestPermission()} />
          : <Button label="Ouvrir les réglages" onPress={() => void Linking.openSettings()} />}
        <Button label="Annuler" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const count = drafts.reduce((n, d) => n + (d.unit === 'piece' && d.quantity ? d.quantity : 1), 0);

  return (
    <View style={styles.dark}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={(r) => void onScanned(r)}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top}>
          <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} style={styles.round}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.counter}><Text style={styles.counterText}>{count} produit{count > 1 ? 's' : ''}</Text></View>
        </View>
        <View style={styles.frame} />
        <View style={{ width: '100%', gap: spacing.sm }}>
          {last && (
            <Animated.View key={last + drafts.length} entering={FadeInUp} style={styles.toast}>
              <Ionicons name="checkmark-circle" size={18} color={colors.sage} />
              <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>{last}</Text>
            </Animated.View>
          )}
          <Button
            label={pending > 0 ? 'Recherche…' : drafts.length ? `Vérifier et ajouter (${drafts.length})` : 'Scannez un premier produit'}
            onPress={finish}
            disabled={drafts.length === 0 || pending > 0}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  dark: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, padding: spacing.xl, justifyContent: 'space-between', alignItems: 'center' },
  top: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  counter: { backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, justifyContent: 'center' },
  counterText: { fontWeight: '700', color: colors.text },
  frame: { width: '86%', aspectRatio: 1.8, borderRadius: radius.lg, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
});
