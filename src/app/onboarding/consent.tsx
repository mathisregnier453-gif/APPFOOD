import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Card, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme';

const POINTS = [
  ['camera-outline', 'Vos photos servent uniquement à reconnaître vos aliments.'],
  ['time-outline', 'Elles sont supprimées après validation du scan, et au plus tard après 7 jours.'],
  ['lock-closed-outline', "Votre stock n'est visible que par vous (et les membres de votre foyer)."],
  ['trash-outline', 'Vous pouvez supprimer votre compte et toutes vos données à tout moment.'],
] as const;

export default function ConsentScreen() {
  const { session, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const policyUrl = Constants.expoConfig?.extra?.privacyPolicyUrl as string | undefined;

  const accept = async () => {
    if (!session) return;
    setLoading(true);
    const { error: updateError } = await supabase
      .from('profiles').update({ privacy_consent_at: new Date().toISOString(), analytics_consent: analytics }).eq('id', session.user.id);
    setLoading(false);
    if (updateError) setError("Impossible d'enregistrer votre choix. Réessayez.");
    else await refreshProfile();
  };

  return (
    <Screen>
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <Text style={typography.title}>Vos données, en toute transparence</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          Pour reconnaître vos aliments, Sauge envoie les photos que vous prenez à un service d'intelligence artificielle, via nos serveurs.
        </Text>
      </View>
      <Card style={{ gap: spacing.lg }}>
        {POINTS.map(([, text]) => (
          <View key={text} style={styles.point}>
            <View style={styles.dot} />
            <Text style={[typography.body, { flex: 1 }]}>{text}</Text>
          </View>
        ))}
      </Card>
      {policyUrl && (
        <Text style={styles.link} onPress={() => void Linking.openURL(policyUrl)}>Lire la politique de confidentialité</Text>
      )}
      <Card style={styles.toggleRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={typography.body}>Statistiques d'usage anonymes (facultatif)</Text>
          <Text style={typography.caption}>Nous aident à améliorer l'app. Aucune donnée de votre stock ni identifiant de compte. Modifiable dans le Profil.</Text>
        </View>
        <Switch value={analytics} onValueChange={setAnalytics} trackColor={{ true: colors.sage, false: colors.border }} />
      </Card>
      {error && <Banner tone="danger">{error}</Banner>}
      <View style={{ gap: spacing.sm, marginTop: 'auto' }}>
        <Button label="J'accepte et je continue" onPress={accept} loading={loading} />
        <Button label="Refuser et me déconnecter" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage, marginTop: 7 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  link: { color: colors.sageDark, fontWeight: '600', textAlign: 'center' },
});
