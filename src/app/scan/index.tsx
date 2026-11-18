import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/components/ui';
import { ocrAvailable } from '@/features/capture/ocr';
import { AI_PHOTO_SCAN_ENABLED } from '@/features/capture/store';
import { colors, radius, shadow, spacing, typography } from '@/theme';

type Option = { href: string; icon: keyof typeof Ionicons.glyphMap; title: string; text: string; available: boolean; note?: string };

// Ajout d'aliments 100 % gratuit : rien n'est envoyé à une IA payante.
export default function AddFoodHub() {
  const options: Option[] = [
    { href: '/scan/barcodes', icon: 'barcode-outline', title: 'Scanner des codes-barres', text: 'Passez vos produits devant l\'appareil photo, à la suite. Idéal au retour des courses.', available: true },
    { href: '/scan/receipt', icon: 'receipt-outline', title: 'Photographier le ticket de caisse', text: 'Tous vos achats en une photo. Lecture sur votre téléphone, rien n\'est envoyé.', available: ocrAvailable, note: 'Disponible dans l\'application mobile' },
    { href: '/item/new', icon: 'create-outline', title: 'Saisir à la main', text: 'Pour les produits sans emballage ou un ajout rapide.', available: true },
    ...(AI_PHOTO_SCAN_ENABLED ? [{ href: '/scan/photo', icon: 'camera-outline' as const, title: 'Photo du frigo (IA)', text: 'Reconnaissance par IA distante.', available: true }] : []),
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={typography.title}>Ajouter des aliments</Text>
          <Text style={typography.caption}>Gratuit et illimité</Text>
        </View>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      {options.map((o, i) => (
        <Animated.View key={o.href} entering={FadeInDown.delay(i * 60).duration(300)}>
          <Pressable
            disabled={!o.available}
            onPress={() => router.push(o.href as never)}
            style={({ pressed }) => [styles.card, !o.available && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <View style={styles.icon}><Ionicons name={o.icon} size={26} color={colors.sageDark} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={typography.heading}>{o.title}</Text>
              <Text style={typography.caption}>{o.available ? o.text : o.note}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        </Animated.View>
      ))}

      <Text style={[typography.caption, { color: colors.textFaint, textAlign: 'center' }]}>
        Vous vérifiez toujours la liste avant l'ajout. Les dates de péremption se lisent sur l'emballage en un geste.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center' },
});
