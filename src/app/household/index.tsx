import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Card, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { openPaywall, useEntitlements } from '@/features/billing/EntitlementsProvider';
import {
  createInvite, fetchActiveInvite, fetchMembers, fetchMyHouseholds, type HouseholdMember, leaveHousehold,
  type MyHousehold, removeMember, renameHousehold, revokeInvite, switchHousehold,
} from '@/features/household/api';
import { ApiError } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme';

const PLAN_LABEL = { free: 'Gratuit', premium: 'Premium', family: 'Famille' } as const;

export default function HouseholdScreen() {
  const { session, householdId, refreshProfile } = useAuth();
  const { can, isOwner, maxMembers, canWrite, refresh } = useEntitlements();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [households, setHouseholds] = useState<MyHousehold[]>([]);
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = households.find((h) => h.household_id === householdId);

  const load = useCallback(async () => {
    if (!householdId) return;
    try {
      const [m, h] = await Promise.all([fetchMembers(householdId), fetchMyHouseholds()]);
      setMembers(m);
      setHouseholds(h);
      setName(h.find((x) => x.household_id === householdId)?.name ?? '');
      setInvite(isOwner ? await fetchActiveInvite(householdId) : null);
    } catch {
      setError('Impossible de charger le foyer.');
    } finally {
      setLoading(false);
    }
  }, [householdId, isOwner]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const afterHouseholdChange = async () => {
    await refreshProfile();
    await refresh();
  };

  const makeInvite = async () => {
    if (!householdId) return;
    if (!can('shared_household')) return openPaywall('household');
    setBusy(true);
    setError(null);
    try {
      setInvite(await createInvite(householdId));
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'household_full'
        ? `Votre foyer compte déjà ${maxMembers} personnes, le maximum de votre offre.`
        : "L'invitation n'a pas pu être créée.");
    } finally {
      setBusy(false);
    }
  };

  const shareInvite = () => {
    if (!invite) return;
    void Share.share({
      message: `Rejoins notre foyer sur Sauge pour partager le frigo, les courses et les repas de la semaine : ouvre l'app, Profil > Mon foyer > Rejoindre un foyer, et saisis le code ${invite.code} (valable 7 jours).`,
    });
  };

  const confirmLeave = () => {
    if (!householdId) return;
    Alert.alert('Quitter ce foyer ?', "Vous n'aurez plus accès à son stock, sa liste de courses ni son planning. Vous retrouverez votre foyer personnel.", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter', style: 'destructive',
        onPress: async () => {
          try {
            await leaveHousehold(householdId);
            await afterHouseholdChange();
            router.back();
          } catch {
            setError('Impossible de quitter le foyer.');
          }
        },
      },
    ]);
  };

  const confirmRemove = (m: HouseholdMember) =>
    Alert.alert(`Retirer ${m.display_name} ?`, "Cette personne n'aura plus accès au foyer. Elle retrouvera son foyer personnel.", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => void removeMember(householdId!, m.user_id).then(load).catch(() => setError('Impossible de retirer ce membre.')) },
    ]);

  const select = async (h: MyHousehold) => {
    if (!session || h.household_id === householdId) return;
    await switchHousehold(session.user.id, h.household_id);
    await afterHouseholdChange();
  };

  if (loading) return <Screen scroll={false}><ActivityIndicator color={colors.sage} style={{ marginTop: spacing.xxl * 2 }} /></Screen>;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Mon foyer</Text>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      {!canWrite && (
        <Banner tone="warning">Ce foyer n'a plus l'offre Famille : vous pouvez consulter ses données, mais plus les modifier. Le propriétaire peut réactiver l'offre, ou vous pouvez revenir à votre foyer personnel.</Banner>
      )}
      {error && <Banner tone="danger">{error}</Banner>}

      <Card style={{ gap: spacing.md }}>
        {isOwner ? (
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => householdId && name.trim().length > 0 && void renameHousehold(householdId, name).then(load)}
            style={styles.nameInput}
            maxLength={60}
            accessibilityLabel="Nom du foyer"
          />
        ) : (
          <Text style={typography.heading}>{current?.name}</Text>
        )}
        <Text style={typography.caption}>
          Offre {current ? PLAN_LABEL[current.plan] : ''} · {members.length} / {maxMembers} personne{maxMembers > 1 ? 's' : ''}
        </Text>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <SectionTitle title="Membres" />
        <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
          {members.map((m) => (
            <View key={m.user_id} style={styles.memberRow}>
              <View style={styles.avatar}><Text style={styles.avatarLetter}>{m.display_name[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{m.display_name}{m.is_me ? ' (vous)' : ''}</Text>
                <Text style={typography.caption}>{m.role === 'owner' ? 'Propriétaire' : 'Membre'}</Text>
              </View>
              {isOwner && !m.is_me && (
                <Pressable accessibilityLabel={`Retirer ${m.display_name}`} onPress={() => confirmRemove(m)} hitSlop={8}>
                  <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
                </Pressable>
              )}
            </View>
          ))}
        </Card>
      </View>

      {isOwner && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="Inviter" />
          {invite ? (
            <Card style={{ gap: spacing.md, alignItems: 'center' }}>
              <Text style={styles.code} selectable>{invite.code.replace(/(.{4})/, '$1 ')}</Text>
              <Text style={typography.caption}>Code à usage unique, valable jusqu'au {new Date(invite.expires_at).toLocaleDateString('fr-FR')}</Text>
              <Button label="Partager le code" icon="share-outline" onPress={shareInvite} style={{ alignSelf: 'stretch' }} />
              <Button label="Annuler ce code" variant="ghost" size="md" onPress={() => householdId && void revokeInvite(householdId).then(() => setInvite(null))} />
            </Card>
          ) : (
            <Button
              label={can('shared_household') ? 'Inviter un membre' : 'Inviter (offre Famille)'}
              icon="person-add-outline"
              variant={can('shared_household') ? 'primary' : 'secondary'}
              onPress={makeInvite}
              loading={busy}
              disabled={can('shared_household') && members.length >= maxMembers}
            />
          )}
          <Text style={[typography.caption, { color: colors.textFaint }]}>
            Les membres partagent le stock, la liste de courses, le planning et les scans du foyer. Leurs allergies sont prises en compte dans toutes les recettes.
          </Text>
        </View>
      )}

      {households.length > 1 && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="Mes foyers" />
          {households.map((h) => (
            <Card key={h.household_id} onPress={() => void select(h)} style={styles.householdRow}>
              <Ionicons name={h.household_id === householdId ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.sage} />
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{h.name}</Text>
                <Text style={typography.caption}>{h.member_count} membre{h.member_count > 1 ? 's' : ''} · {PLAN_LABEL[h.plan]}</Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <Button label="Rejoindre un foyer avec un code" icon="enter-outline" variant="secondary" onPress={() => router.push('/household/join')} />
        {members.length > 1 && <Button label="Quitter ce foyer" variant="danger" onPress={confirmLeave} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  nameInput: { fontSize: 20, fontWeight: '700', color: colors.text, paddingVertical: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontWeight: '700', color: colors.sageDark },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 4, color: colors.text, fontVariant: ['tabular-nums'] },
  householdRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
