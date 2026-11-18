import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Card, Screen } from '@/components/ui';
import { makeDraft } from '@/features/capture/drafts';
import { ocrAvailable, recognizeLines } from '@/features/capture/ocr';
import { ocrRows, parseReceipt } from '@/features/capture/receipt';
import { setCapture } from '@/features/capture/store';
import { colors, spacing, typography } from '@/theme';

const TIPS = [
  'Posez le ticket à plat, bien éclairé, sans pli.',
  'Cadrez la liste des articles ; un ticket long peut être pris en deux photos.',
  'Rien n\'est envoyé : la lecture se fait sur votre téléphone.',
];

export default function ReceiptCapture() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyse = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setBusy(true);
    setError(null);
    try {
      const rows: string[] = [];
      for (const a of assets) rows.push(...ocrRows((await recognizeLines({ uri: a.uri, width: a.width, height: a.height })).lines));
      const { items } = parseReceipt(rows);
      if (items.length === 0) {
        setError("Aucun article n'a pu être lu. Reprenez la photo plus nette et mieux éclairée, ou ajoutez vos produits à la main.");
        return;
      }
      setCapture('receipt', items.map((i) => makeDraft({ name: i.name, category: i.category, quantity: i.quantity, unit: i.unit, needsReview: i.confidence === 'low' })));
      router.replace('/scan/confirm');
    } catch {
      setError('La lecture du ticket a échoué. Réessayez avec une photo plus nette.');
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Appareil photo', "Autorisez l'accès à l'appareil photo dans les réglages.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (!res.canceled) await analyse(res.assets);
  };

  const importPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3, quality: 1, exif: false });
    if (!res.canceled) await analyse(res.assets);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Ticket de caisse</Text>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      {!ocrAvailable && <Banner tone="info">La lecture des tickets fonctionne dans l'application mobile (iOS et Android).</Banner>}

      <Card style={{ gap: spacing.md }}>
        {TIPS.map((t) => (
          <View key={t} style={styles.tip}>
            <Ionicons name="checkmark" size={16} color={colors.sageDark} />
            <Text style={[typography.body, { flex: 1, fontSize: 14 }]}>{t}</Text>
          </View>
        ))}
      </Card>

      {error && <Banner tone="warning">{error}</Banner>}

      <View style={{ gap: spacing.sm, marginTop: 'auto' }}>
        <Button label={busy ? 'Lecture du ticket…' : 'Photographier le ticket'} icon="camera-outline" onPress={takePhoto} loading={busy} disabled={!ocrAvailable} />
        <Button label="Importer une photo" variant="secondary" onPress={importPhotos} disabled={!ocrAvailable || busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
