import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Card } from '@/components/ui';
import { type AdminUser, eur, giftScans, listUsers, setSuspension } from '@/features/admin/api';
import { colors, radius, spacing, typography } from '@/theme';

const PLAN_LABEL = { free: 'Gratuit', premium: 'Premium', family: 'Famille' } as const;

export default function AdminUsers() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers(q));
    } catch {
      setError('Liste indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const suspend = (u: AdminUser) => {
    if (u.suspended) {
      void setSuspension(u.user_id, false, null).then(() => load(query));
      return;
    }
    if (Platform.OS === 'ios') {
      // Saisie du motif (iOS uniquement : Alert.prompt n'existe pas sur Android).
      Alert.prompt('Suspendre ce compte', 'Motif (visible dans le journal d\'administration) :', (reason) => {
        void setSuspension(u.user_id, true, reason || 'abus').then(() => load(query));
      });
      return;
    }
    Alert.alert('Suspendre ce compte ?', u.email, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Suspendre', style: 'destructive', onPress: () => void setSuspension(u.user_id, true, 'abus').then(() => load(query)) },
    ]);
  };

  const gift = (u: AdminUser) => {
    if (!u.household_id) return;
    Alert.alert('Offrir des scans', `Rendre des scans ce mois-ci au foyer de ${u.email} ?`, [
      { text: 'Annuler', style: 'cancel' },
      ...[1, 3, 5].map((n) => ({ text: `+${n}`, onPress: () => void giftScans(u.household_id!, n).then(() => load(query)) })),
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Utilisateurs' }} />
      <FlatList
        data={users}
        keyExtractor={(u) => u.user_id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <TextInput value={query} onChangeText={setQuery} placeholder="E-mail ou prénom" placeholderTextColor={colors.textFaint} autoCapitalize="none" style={styles.search} />
            {error && <Banner tone="danger">{error}</Banner>}
            {loading && <ActivityIndicator color={colors.sage} />}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item: u }) => (
          <Card style={{ gap: spacing.sm }}>
            <Pressable onPress={() => setOpen(open === u.user_id ? null : u.user_id)} style={styles.head}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={typography.body} numberOfLines={1}>{u.email}{u.is_admin ? ' · admin' : ''}</Text>
                <Text style={typography.caption}>
                  {PLAN_LABEL[u.plan]} · {u.scans_used} scans · IA {eur(u.ai_cost_month_eur, 3)} ce mois
                </Text>
              </View>
              {u.suspended && <Ionicons name="ban" size={18} color={colors.danger} accessibilityLabel="Suspendu" />}
            </Pressable>
            {open === u.user_id && (
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.caption}>
                  Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')} · dernière activité {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString('fr-FR') : 'inconnue'}
                </Text>
                <View style={styles.actions}>
                  <Button label="Offrir des scans" size="md" variant="secondary" onPress={() => gift(u)} />
                  {!u.is_admin && <Button label={u.suspended ? 'Réactiver' : 'Suspendre'} size="md" variant={u.suspended ? 'secondary' : 'danger'} onPress={() => suspend(u)} />}
                </View>
              </View>
            )}
          </Card>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  search: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, fontSize: 16, color: colors.text },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
