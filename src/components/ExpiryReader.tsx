import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import { extractExpiry } from '@/features/capture/expiryOcr';
import { ocrAvailable, recognizeLines } from '@/features/capture/ocr';
import { localTodayIso } from '@/lib/expiry';
import { colors, radius, spacing } from '@/theme';

/**
 * « Lire la date » : photo de la date sur l'emballage, lecture locale et gratuite.
 * Si la date n'est pas lisible sans ambiguïté, rien n'est rempli (jamais inventée).
 */
export function ExpiryReader({ onRead }: { onRead: (iso: string, kind: 'dlc' | 'ddm' | null) => void }) {
  const [busy, setBusy] = useState(false);
  if (!ocrAvailable) return null;

  const read = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (res.canceled) return;
    setBusy(true);
    try {
      const a = res.assets[0];
      const { text } = await recognizeLines({ uri: a.uri, width: a.width, height: a.height });
      const found = extractExpiry(text, localTodayIso());
      if (found) onRead(found.date, found.kind);
      else Alert.alert('Date non lue', 'Rapprochez-vous de la date, bien éclairée, ou saisissez-la à la main.');
    } catch {
      Alert.alert('Lecture impossible', 'Saisissez la date à la main.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={() => void read()} disabled={busy} style={styles.btn} accessibilityRole="button" accessibilityLabel="Lire la date sur l'emballage">
      {busy ? <ActivityIndicator size="small" color={colors.sageDark} /> : <Ionicons name="scan-outline" size={16} color={colors.sageDark} />}
      <Text style={styles.label}>Lire la date</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.sageMist, alignSelf: 'flex-start' },
  label: { color: colors.sageDark, fontWeight: '600', fontSize: 14 },
});
