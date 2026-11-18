import Ionicons from '@expo/vector-icons/Ionicons';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { lookupBarcode } from '@/features/planning/api';
import { colors, radius, spacing, typography } from '@/theme';

// Lecture d'un code-barres (EAN/UPC) puis recherche Open Food Facts via notre serveur.
export default function BarcodeScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const handled = useRef(false);

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    if (handled.current || !/^\d{8,14}$/.test(data)) return;
    handled.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBusy(true);
    try {
      const p = await lookupBarcode(data);
      router.replace({
        pathname: '/item/new',
        params: {
          kind: kind ?? 'fridge',
          barcode: data,
          ...(p.found ? {
            name: [p.name, p.brand].filter(Boolean).join(' – ').slice(0, 80),
            category: p.category_id ?? 'other',
            quantity: p.quantity !== null ? String(p.quantity) : '',
            unit: p.unit ?? 'piece',
          } : { notFound: '1' }),
        },
      });
    } catch {
      setMessage('Recherche impossible pour le moment. Vous pouvez saisir le produit à la main.');
      setBusy(false);
      handled.current = false;
    }
  };

  if (!permission) return <View style={styles.dark} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.screen, { padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }]}>
        <Text style={typography.title}>Accès à l'appareil photo</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>Il sert uniquement à lire le code-barres. Aucune image n'est enregistrée ni envoyée.</Text>
        {permission.canAskAgain ? (
          <Button label="Autoriser" onPress={() => void requestPermission()} />
        ) : (
          <Button label="Ouvrir les réglages" onPress={() => void Linking.openSettings()} />
        )}
        <Button label="Annuler" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.dark}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={busy ? undefined : (r) => void onScanned(r)}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.frame} />
        <View style={styles.hint}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.hintText}>{message ?? 'Placez le code-barres dans le cadre'}</Text>}
        </View>
        <Button label="Saisir à la main" variant="secondary" onPress={() => router.replace({ pathname: '/item/new', params: { kind: kind ?? 'fridge' } })} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  dark: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, padding: spacing.xl, justifyContent: 'space-between', alignItems: 'center' },
  close: { alignSelf: 'flex-end', width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  frame: { width: '86%', aspectRatio: 1.8, borderRadius: radius.lg, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  hint: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, minHeight: 36, justifyContent: 'center' },
  hintText: { color: '#fff', fontWeight: '600' },
});
