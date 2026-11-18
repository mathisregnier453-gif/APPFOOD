import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Card, Chip, SectionTitle } from '@/components/ui';
import { type CaptureStats, type Dashboard, eur, fetchCaptureStats, fetchDashboard, pct } from '@/features/admin/api';
import { addDaysIso } from '@/lib/dates';
import { localTodayIso } from '@/lib/expiry';
import { colors, radius, spacing, typography } from '@/theme';

const PERIODS = [
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: 'month', label: 'Ce mois' },
] as const;

const FEATURE_LABEL: Record<string, string> = { scan: 'Scans', recipe: 'Recettes', meal_plan: 'Planning', anti_waste: 'Anti-gaspi' };

function range(id: (typeof PERIODS)[number]['id']): [string, string] {
  const today = localTodayIso();
  if (id === 'month') return [`${today.slice(0, 8)}01`, today];
  return [addDaysIso(today, -(Number(id) - 1)), today];
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warning' | 'good' }) {
  return (
    <Card style={styles.tile}>
      <Text style={typography.caption} numberOfLines={1}>{label}</Text>
      <Text style={[styles.tileValue, tone === 'warning' && { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {hint ? <Text style={[typography.caption, { fontSize: 11 }]} numberOfLines={2}>{hint}</Text> : null}
    </Card>
  );
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('30');
  const [data, setData] = useState<Dashboard | null>(null);
  const [capture, setCapture] = useState<CaptureStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [from, to] = range(period);
      const [d, c] = await Promise.all([fetchDashboard(from, to), fetchCaptureStats(from, to)]);
      setData(d);
      setCapture(c);
    } catch {
      setError('Tableau de bord indisponible (droits administrateur requis).');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const maxCost = Math.max(0.0001, ...(data?.ai.by_feature.map((f) => f.cost_eur) ?? [0]));
  const belowTarget = data ? data.margin.per_premium_sub_month_eur < data.margin.target_eur : false;

  return (
    <>
      <Stack.Screen options={{ title: 'Administration' }} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View style={styles.row}>
          {PERIODS.map((p) => <Chip key={p.id} label={p.label} selected={period === p.id} onPress={() => setPeriod(p.id)} />)}
        </View>
        {error && <Banner tone="danger">{error}</Banner>}
        {!data ? (
          loading ? <ActivityIndicator color={colors.sage} /> : null
        ) : (
          <>
            <SectionTitle title="Revenus" />
            <View style={styles.grid}>
              <Tile label="MRR (TTC)" value={eur(data.revenue.mrr_gross_eur)} />
              <Tile label="MRR net" value={eur(data.revenue.mrr_net_eur)} hint="hors TVA et commission store" />
              <Tile label="Marge / Premium" value={eur(data.margin.per_premium_sub_month_eur)} hint={`objectif ${eur(data.margin.target_eur)}`} tone={belowTarget ? 'warning' : undefined} />
              <Tile label="Prix Premium net" value={eur(data.margin.premium_net_price_eur)} />
            </View>

            {capture && (
              <>
                <SectionTitle title="Scanner" />
                <View style={styles.grid}>
                  <Tile label="Ajouts au stock" value={String(capture.captures_total)} hint={`${capture.by_method.barcode ?? 0} codes-barres · ${capture.by_method.receipt ?? 0} tickets · ${capture.by_method.manual ?? 0} saisies`} />
                  <Tile label="Traités gratuitement" value={pct(capture.free_share)} hint={`${capture.by_method.ai_photo ?? 0} analyses IA payantes`} />
                  <Tile label="Reconnaissance correcte" value={pct(capture.recognition_rate)} hint={`codes-barres ${pct(capture.recognition_by_method.barcode)} · tickets ${pct(capture.recognition_by_method.receipt)}`} />
                  <Tile label="Corrections" value={String(capture.corrections)} hint={`${capture.removals} lignes supprimées sur ${capture.items_detected} proposées`} />
                  <Tile label="IA payante" value={eur(capture.paid_ai_cost_eur, 2)} hint={`${capture.paid_ai_calls} appels`} />
                  <Tile label="Coût / ajout · / utilisateur" value={eur(capture.avg_cost_per_capture_eur, 4)} hint={eur(capture.avg_cost_per_user_eur, 4)} />
                </View>
              </>
            )}

            <SectionTitle title="Utilisateurs" />
            <View style={styles.grid}>
              <Tile label="Inscrits" value={String(data.users.total)} hint={`+${data.users.new} sur la période`} />
              <Tile label="Actifs (30 j)" value={String(data.users.active_30d)} />
              <Tile label="Gratuits" value={String(data.users.free)} />
              <Tile label="Premium · Famille" value={`${data.subscriptions.premium} · ${data.subscriptions.family}`} hint={`${data.subscriptions.yearly} annuels`} />
              <Tile label="Conversion" value={pct(data.conversion.paying_rate)} hint={`cohorte : ${pct(data.conversion.cohort_rate)}`} />
              <Tile label="Résiliation" value={pct(data.churn.rate)} hint={`${data.subscriptions.not_renewing} ne renouvelleront pas`} />
            </View>

            <SectionTitle title="Coûts" />
            <View style={styles.grid}>
              <Tile label="Coût IA" value={eur(data.ai.cost_eur)} hint={`${data.ai.scans} scans`} />
              <Tile label="IA / scan" value={eur(data.ai.cost_per_scan_eur, 4)} />
              <Tile label="IA / abonné / mois" value={eur(data.ai.cost_per_paying_sub_month_eur, 3)} hint="objectif 0,40 €" tone={(data.ai.cost_per_paying_sub_month_eur ?? 0) > 0.4 ? 'warning' : undefined} />
              <Tile label="IA / gratuit / mois" value={eur(data.ai.cost_per_free_user_month_eur, 3)} />
              <Tile label="Hébergement / mois" value={eur(data.costs.hosting_month_eur)} hint={`${eur(data.costs.hosting_per_user_month_eur, 4)} / utilisateur`} />
              <Tile label="Erreurs" value={String(data.errors.server_errors + data.errors.ai_failures)} hint={`${data.errors.ai_failures} échecs IA · ${data.errors.billing_events_failed} paiements`} tone={data.errors.billing_events_failed > 0 ? 'warning' : undefined} />
            </View>

            <Card style={{ gap: spacing.md }}>
              <Text style={typography.heading}>Coût IA par fonctionnalité</Text>
              {data.ai.by_feature.length === 0 && <Text style={typography.caption}>Aucun appel sur la période.</Text>}
              {data.ai.by_feature.map((f) => (
                <View key={f.feature} style={{ gap: 4 }} accessible accessibilityLabel={`${FEATURE_LABEL[f.feature] ?? f.feature} : ${eur(f.cost_eur)}, ${f.calls} appels, ${f.failures} échecs`}>
                  <View style={styles.between}>
                    <Text style={typography.body}>{FEATURE_LABEL[f.feature] ?? f.feature}</Text>
                    <Text style={typography.caption}>{eur(f.cost_eur)} · {f.calls} appels{f.failures ? ` · ${f.failures} échecs` : ''}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.bar, { width: `${Math.max(2, (f.cost_eur / maxCost) * 100)}%` }]} />
                  </View>
                </View>
              ))}
              {data.anomalies.failing_features.length > 0 && (
                <Banner tone="warning">Taux d'échec supérieur à 10 % : {data.anomalies.failing_features.map((f) => FEATURE_LABEL[f] ?? f).join(', ')}</Banner>
              )}
            </Card>

            <Card style={{ gap: spacing.sm }}>
              <Text style={typography.heading}>Utilisateurs les plus coûteux</Text>
              <Text style={typography.caption}>Moyenne par utilisateur actif : {eur(data.anomalies.avg_cost_per_active_user_eur, 4)}</Text>
              {data.anomalies.top_users.map((u) => (
                <View key={u.user_id} style={styles.between}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {u.abnormal && <Ionicons name="warning" size={16} color={colors.warning} accessibilityLabel="Coût anormal" />}
                    <Text style={typography.body} numberOfLines={1}>{u.email ?? u.user_id.slice(0, 8)}</Text>
                  </View>
                  <Text style={typography.caption}>{eur(u.cost_eur, 3)} · {u.calls} appels{u.ratio_to_avg ? ` · ×${u.ratio_to_avg}` : ''}</Text>
                </View>
              ))}
            </Card>

            <View style={{ gap: spacing.sm }}>
              {[
                { href: '/admin/users', icon: 'people-outline', label: 'Utilisateurs et abus' },
                { href: '/admin/plans', icon: 'pricetags-outline', label: 'Offres et quotas' },
                { href: '/admin/settings', icon: 'calculator-outline', label: 'Paramètres financiers' },
                { href: '/admin/errors', icon: 'bug-outline', label: 'Erreurs techniques' },
              ].map((l) => (
                <Card key={l.href} onPress={() => router.push(l.href as never)} style={styles.link}>
                  <Ionicons name={l.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.sageDark} />
                  <Text style={[typography.body, { flex: 1 }]}>{l.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </Card>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '48.5%', gap: 4, padding: spacing.md },
  tileValue: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.sageMist, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.sageDark },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
