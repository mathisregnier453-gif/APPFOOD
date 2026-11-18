import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card, Chip, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useInventory } from '@/features/inventory/useInventory';
import { openPaywall, useEntitlements } from '@/features/billing/EntitlementsProvider';
import { billingAvailable, manageSubscription } from '@/features/billing/purchases';
import { notificationsAllowed, registerPushToken, requestNotificationPermission } from '@/features/notifications/notifications';
import { invokeFunction, supabase } from '@/lib/supabase';
import type { NotificationPrefs } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';

const PLAN_LABEL = { free: 'Gratuit', premium: 'Premium', family: 'Famille' } as const;
const ALERT_OPTIONS = [1, 2, 3, 5];

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const { plan, can, requireFeature, memberCount } = useEntitlements();
  const { quota } = useInventory();
  const [deleting, setDeleting] = useState(false);
  const policyUrl = Constants.expoConfig?.extra?.privacyPolicyUrl as string | undefined;

  const setAlertDays = async (days: number) => {
    if (!session) return;
    await supabase.from('profiles').update({ expiry_alert_days: days }).eq('id', session.user.id);
    await refreshProfile();
  };

  // Seules les notifications opérationnelles sont proposées (celles du foyer
  // partagé arriveront avec la phase 5).
  const NOTIF_OPTIONS: { key: keyof NotificationPrefs; label: string; hint: string; premium?: boolean }[] = [
    { key: 'expiry', label: 'Péremption proche', hint: 'Un rappel groupé à 9 h, selon votre délai d\'alerte.' },
    { key: 'meal_reminder', label: 'Repas prévus', hint: 'À l\'heure du repas planifié.', premium: true },
    { key: 'missing_ingredient', label: 'Ingrédient manquant', hint: 'La veille à 17 h, s\'il manque quelque chose pour un repas prévu.', premium: true },
    ...(memberCount > 1 ? [
      { key: 'household_activity' as const, label: 'Activité du foyer', hint: 'Quand un membre ajoute des aliments ou rejoint le foyer.' },
      { key: 'shopping_update' as const, label: 'Liste de courses', hint: 'Quand un membre modifie la liste ou range des achats.' },
    ] : []),
  ];

  const setNotif = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!session || !profile) return;
    if (value && (await requestNotificationPermission())) void registerPushToken(session.user.id).catch(() => undefined);
    if (value && !(await notificationsAllowed())) {
      Alert.alert('Notifications désactivées', 'Autorisez les notifications de Sauge dans les réglages du téléphone.', [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    await supabase.from('profiles').update({ notification_prefs: { ...profile.notification_prefs, [key]: value } }).eq('id', session.user.id);
    await refreshProfile();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer mon compte',
      "Votre compte, votre stock, vos photos et votre historique seront définitivement supprimés. Si vous avez un abonnement, résiliez-le aussi depuis l'App Store ou Google Play.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await invokeFunction('delete-account', { confirm: 'SUPPRIMER' });
              await signOut();
            } catch {
              setDeleting(false);
              Alert.alert('Erreur', 'La suppression a échoué. Réessayez ou contactez le support.');
            }
          },
        },
      ],
    );
  };

  // Scanner gratuit et illimité : la jauge suit les recettes IA du mois.
  const used = quota?.recipes_used ?? 0;
  const limit = quota?.recipes_limit ?? 0;
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;

  return (
    <Screen>
      <View style={styles.rowBetween}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={typography.title}>{profile?.display_name || 'Mon profil'}</Text>
          <Text style={typography.caption}>{session?.user.email}</Text>
        </View>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={styles.rowBetween}>
          <Text style={typography.heading}>Offre {quota ? PLAN_LABEL[quota.plan] : ''}</Text>
          <Text style={typography.caption}>{used} / {limit} idées de recettes</Text>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${ratio * 100}%` }]} /></View>
        <Text style={typography.caption}>
          {quota ? `Renouvellement le ${new Date(quota.period_end).toLocaleDateString('fr-FR')}.` : ''}
        </Text>
        {plan === 'free' ? (
          <Button label="Découvrir Premium et Famille" icon="sparkles-outline" size="md" onPress={() => openPaywall('profile')} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {plan === 'premium' && <Button label="Passer à Famille" variant="secondary" size="md" onPress={() => openPaywall('profile')} />}
            {billingAvailable() && <Button label="Gérer mon abonnement" variant="ghost" size="md" onPress={() => void manageSubscription().catch(() => undefined)} />}
          </View>
        )}
      </Card>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Alerte de péremption" />
        <Text style={[typography.body, { color: colors.textMuted }]}>Prévenez-moi lorsqu'il reste :</Text>
        <View style={styles.chips}>
          {ALERT_OPTIONS.map((d) => (
            <Chip
              key={d}
              label={`${d} jour${d > 1 ? 's' : ''}`}
              selected={(can('smart_notifications') ? profile?.expiry_alert_days : 2) === d}
              onPress={() => requireFeature('smart_notifications', 'notifications', () => void setAlertDays(d))}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Notifications" />
        <Card style={{ gap: spacing.lg }}>
          {NOTIF_OPTIONS.map((o) => (
            <View key={o.key} style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 2, paddingRight: spacing.md }}>
                <Text style={typography.body}>{o.label}{o.premium && !can('smart_notifications') ? ' · Premium' : ''}</Text>
                <Text style={typography.caption}>{o.hint}</Text>
              </View>
              <Switch
                value={(!o.premium || can('smart_notifications')) && (profile?.notification_prefs?.[o.key] ?? true)}
                onValueChange={(v) => (o.premium ? requireFeature('smart_notifications', 'notifications', () => void setNotif(o.key, v)) : void setNotif(o.key, v))}
                trackColor={{ true: colors.sage, false: colors.border }}
              />
            </View>
          ))}
        </Card>
      </View>

      <Card style={styles.linkCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={typography.body}>Statistiques d'usage anonymes</Text>
          <Text style={typography.caption}>Aucune donnée de stock ni identifiant de compte.</Text>
        </View>
        <Switch
          value={profile?.analytics_consent ?? false}
          onValueChange={(v) => {
            if (session) void supabase.from('profiles').update({ analytics_consent: v }).eq('id', session.user.id).then(() => refreshProfile());
          }}
          trackColor={{ true: colors.sage, false: colors.border }}
        />
      </Card>

      {profile?.is_admin && (
        <Card onPress={() => router.push('/admin')} style={styles.linkCard}>
          <Ionicons name="speedometer-outline" size={20} color={colors.sageDark} />
          <Text style={[typography.body, { flex: 1 }]}>Administration</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Card>
      )}

      <Card onPress={() => router.push('/household')} style={styles.linkCard}>
        <Ionicons name="people-outline" size={20} color={colors.sageDark} />
        <Text style={[typography.body, { flex: 1 }]}>Mon foyer{memberCount > 1 ? ` · ${memberCount} membres` : ''}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Card>

      <Card onPress={() => router.push('/preferences')} style={styles.linkCard}>
        <Ionicons name="options-outline" size={20} color={colors.sageDark} />
        <Text style={[typography.body, { flex: 1 }]}>Préférences alimentaires</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Card>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Confidentialité" />
        <Card style={{ gap: spacing.sm }}>
          <Text style={typography.body}>Les photos de scan sont supprimées après validation, et au plus tard après 7 jours. Elles ne servent qu'à reconnaître vos aliments.</Text>
          {policyUrl && <Text style={styles.link} onPress={() => void Linking.openURL(policyUrl)}>Politique de confidentialité</Text>}
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button label="Se déconnecter" variant="secondary" onPress={() => void signOut()} />
        <Button label="Supprimer mon compte" variant="danger" onPress={confirmDelete} loading={deleting} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.sageMist, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.sage },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: { color: colors.sageDark, fontWeight: '600' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
