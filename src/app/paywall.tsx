import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Banner, Card, Screen } from '@/components/ui';
import { useEntitlements } from '@/features/billing/EntitlementsProvider';
import { AI_PHOTO_SCAN_ENABLED } from '@/features/capture/store';
import { featureLines, type Offer, type PaidPlan, type PaywallReason, type Period, type PlanRow, REASON_COPY } from '@/features/billing/offers';
import { billingAvailable, fetchOffers, fetchPlans, manageSubscription, purchase, restore } from '@/features/billing/purchases';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import { track } from '@/lib/observability';

export default function PaywallScreen() {
  const { reason = 'profile' } = useLocalSearchParams<{ reason?: PaywallReason }>();
  const { plan: currentPlan, refresh } = useEntitlements();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [offers, setOffers] = useState<Offer<PurchasesPackage>[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>(currentPlan === 'premium' ? 'family' : 'premium');
  const [period, setPeriod] = useState<Period>('yearly');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = REASON_COPY[reason] ?? REASON_COPY.profile;
  const extra = Constants.expoConfig?.extra as { privacyPolicyUrl?: string; termsUrl?: string } | undefined;

  useEffect(() => {
    track('paywall_viewed', { reason });
    void (async () => {
      try {
        const p = await fetchPlans();
        setPlans(p);
        setOffers(await fetchOffers(p));
      } catch {
        setError('Les offres ne sont pas disponibles pour le moment. Réessayez plus tard.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = useMemo(
    () => offers.find((o) => o.plan === selectedPlan && o.period === period) ?? offers.find((o) => o.plan === selectedPlan),
    [offers, selectedPlan, period],
  );
  const yearlySavings = offers.find((o) => o.plan === selectedPlan && o.period === 'yearly')?.savingsPercent;

  const buy = async () => {
    if (!selected) return;
    setBusy('buy');
    setError(null);
    try {
      const outcome = await purchase(selected);
      if (outcome === 'purchased') {
        track('purchase_completed', { plan: selected.plan, period: selected.period });
        await refresh();
        Alert.alert('Bienvenue !', `Votre offre ${selected.plan === 'family' ? 'Famille' : 'Premium'} est active.`, [{ text: 'Continuer', onPress: () => router.back() }]);
      }
    } catch {
      setError("L'achat n'a pas abouti. Aucun montant n'a été prélevé si la confirmation du store n'a pas été donnée.");
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    setBusy('restore');
    setError(null);
    try {
      await restore();
      await refresh();
      Alert.alert('Achats restaurés', 'Vos abonnements actifs ont été appliqués à ce compte.');
    } catch {
      setError('La restauration a échoué. Vérifiez que vous êtes connecté au bon compte store.');
    } finally {
      setBusy(null);
    }
  };

  const planRow = (code: PaidPlan) => plans.find((p) => p.code === code);
  const priceFor = (code: PaidPlan) => offers.find((o) => o.plan === code && o.period === period) ?? offers.find((o) => o.plan === code);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.badge}><Ionicons name="sparkles" size={22} color={colors.sageDark} /></View>
        <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text style={typography.title}>{copy.title}</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>{copy.subtitle}</Text>
      </View>

      {!billingAvailable() && <Banner tone="info">Les achats ne sont pas disponibles dans cette version de l'application.</Banner>}

      <View style={styles.periods}>
        {(['monthly', 'yearly'] as Period[]).map((p) => (
          <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.periodItem, period === p && styles.periodActive]} accessibilityRole="tab" accessibilityState={{ selected: period === p }}>
            <Text style={[styles.periodLabel, period === p && { color: colors.text }]}>{p === 'monthly' ? 'Mensuel' : 'Annuel'}</Text>
            {p === 'yearly' && yearlySavings ? <Text style={styles.save}>-{yearlySavings} %</Text> : null}
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.sage} />
      ) : (
        (['premium', 'family'] as PaidPlan[]).map((code, i) => {
          const row = planRow(code);
          if (!row) return null;
          const offer = priceFor(code);
          const active = selectedPlan === code;
          const isCurrent = currentPlan === code;
          return (
            <Animated.View key={code} entering={FadeInDown.delay(i * 80)}>
              <Card onPress={() => setSelectedPlan(code)} style={[styles.planCard, active && styles.planActive]}>
                <View style={styles.planHead}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                      <Text style={typography.heading}>{row.label}</Text>
                      {code === 'premium' && <Text style={styles.tag}>Le plus choisi</Text>}
                      {isCurrent && <Text style={[styles.tag, { backgroundColor: colors.infoBg, color: colors.info }]}>Votre offre</Text>}
                    </View>
                    {offer ? (
                      <Text style={typography.caption}>
                        {offer.priceString} / {offer.period === 'monthly' ? 'mois' : 'an'}
                        {offer.period === 'yearly' && offer.perMonth ? ` · soit ${offer.perMonth} / mois` : ''}
                      </Text>
                    ) : (
                      <Text style={typography.caption}>Prix indisponible</Text>
                    )}
                  </View>
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.sage : colors.textFaint} />
                </View>
                {featureLines(row, { aiPhotoScan: AI_PHOTO_SCAN_ENABLED }).map((line) => (
                  <View key={line} style={styles.line}>
                    <Ionicons name="checkmark" size={16} color={colors.sageDark} />
                    <Text style={[typography.body, { flex: 1, fontSize: 14 }]}>{line}</Text>
                  </View>
                ))}
              </Card>
            </Animated.View>
          );
        })
      )}

      {error && <Banner tone="danger">{error}</Banner>}

      <View style={{ gap: spacing.sm }}>
        {currentPlan === selectedPlan ? (
          <Button label="Gérer mon abonnement" variant="secondary" onPress={() => void manageSubscription().catch(() => undefined)} />
        ) : (
          <Button
            label={selected ? `S'abonner · ${selected.priceString} / ${selected.period === 'monthly' ? 'mois' : 'an'}` : 'Offre indisponible'}
            onPress={buy}
            loading={busy === 'buy'}
            disabled={!selected || busy !== null || !billingAvailable()}
          />
        )}
        <Button label="Restaurer mes achats" variant="ghost" onPress={doRestore} loading={busy === 'restore'} disabled={busy !== null || !billingAvailable()} />
      </View>

      <Text style={styles.legal}>
        Abonnement à renouvellement automatique, facturé sur votre compte {Platform.OS === 'ios' ? 'Apple' : 'Google Play'} après confirmation de l'achat.
        Il se renouvelle au même prix sauf résiliation au moins 24 h avant la fin de la période en cours, depuis les réglages de votre compte store.
        Aucun scan ni service supplémentaire n'est jamais facturé sans votre accord explicite.
      </Text>
      <View style={styles.links}>
        {extra?.termsUrl && <Text style={styles.link} onPress={() => void Linking.openURL(extra.termsUrl!)}>Conditions d'utilisation</Text>}
        {extra?.privacyPolicyUrl && <Text style={styles.link} onPress={() => void Linking.openURL(extra.privacyPolicyUrl!)}>Confidentialité</Text>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  periods: { flexDirection: 'row', backgroundColor: colors.sageMist, borderRadius: radius.pill, padding: 4 },
  periodItem: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  periodActive: { backgroundColor: colors.surface, ...shadow.card },
  periodLabel: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  save: { fontSize: 11, fontWeight: '700', color: '#fff', backgroundColor: colors.sage, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  planCard: { gap: spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  planActive: { borderColor: colors.sage },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  tag: { fontSize: 11, fontWeight: '700', color: colors.sageDark, backgroundColor: colors.sageMist, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  legal: { fontSize: 11, lineHeight: 16, color: colors.textFaint, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  link: { color: colors.sageDark, fontWeight: '600', fontSize: 13 },
});
