import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FoodItemRow } from '@/components/FoodItemRow';
import { RecipeCard } from '@/components/RecipeCard';
import { Banner, Card, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { openPaywall, useEntitlements } from '@/features/billing/EntitlementsProvider';
import { type ActivityEntry, activityText, fetchActivity, fetchMembers, relativeTime } from '@/features/household/api';
import { useInventory } from '@/features/inventory/useInventory';
import { AI_PHOTO_SCAN_ENABLED } from '@/features/capture/store';
import { syncExpiryReminders } from '@/features/notifications/notifications';
import { rankRecipes } from '@/features/recipes/availability';
import { useRecipes } from '@/features/recipes/useRecipes';
import { useMeals } from '@/features/planning/useWeek';
import type { MealSlot } from '@/lib/types';
import { STORAGE } from '@/lib/catalog';
import { getExpiryStatus, localTodayIso } from '@/lib/expiry';
import { colors, radius, shadow, spacing, typography } from '@/theme';

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'petit-déjeuner', lunch: 'déjeuner', dinner: 'dîner' };
const SLOT_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2 };

function greeting(): string {
  const h = new Date().getHours();
  return h < 18 ? 'Bonjour' : 'Bonsoir';
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const { items, locations, quota, loading, error } = useInventory();
  const { recipes, availability, favorites } = useRecipes();
  const { plan, can, canWrite, memberCount } = useEntitlements();
  const { session, householdId } = useAuth();
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());
  useFocusEffect(
    useCallback(() => {
      if (!householdId || memberCount <= 1) return;
      void Promise.all([fetchActivity(householdId, 5), fetchMembers(householdId)])
        .then(([a, m]) => {
          setActivity(a);
          setMemberNames(new Map(m.map((x) => [x.user_id, x.display_name])));
        })
        .catch(() => undefined);
    }, [householdId, memberCount]),
  );
  const alertDays = profile?.expiry_alert_days ?? 2;
  const today = localTodayIso();
  const expiryEnabled = profile?.notification_prefs?.expiry ?? true;

  // Rappels locaux de péremption, reprogrammés quand le stock change.
  useEffect(() => {
    if (loading) return;
    // Délai personnalisé = Premium ; offre gratuite : rappel 2 jours avant.
    void syncExpiryReminders(items, can('smart_notifications') ? alertDays : 2, expiryEnabled).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, alertDays, expiryEnabled, loading, plan]);

  const { meals, missingFor } = useMeals(today, 2);
  const nextMeal = useMemo(() => {
    const hour = new Date().getHours();
    const passed = (slot: MealSlot) => (slot === 'breakfast' ? hour >= 10 : slot === 'lunch' ? hour >= 14 : hour >= 21);
    return [...meals]
      .filter((m) => !m.is_cooked && !(m.plan_date === today && passed(m.slot)))
      .sort((a, b) => a.plan_date.localeCompare(b.plan_date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])[0];
  }, [meals, today]);

  const recommended = useMemo(() => rankRecipes(recipes, availability).slice(0, 3), [recipes, availability]);

  const countsByKind = useMemo(() => {
    const kindById = new Map(locations.map((l) => [l.id, l.kind]));
    const counts = { fridge: 0, freezer: 0, pantry: 0 };
    for (const it of items) {
      const kind = kindById.get(it.storage_location_id);
      if (kind) counts[kind] += 1;
    }
    return counts;
  }, [items, locations]);

  const toEatSoon = useMemo(
    () =>
      items
        .map((it) => ({ it, status: getExpiryStatus(it.expiry_date, it.expiry_kind, today, alertDays) }))
        .filter(({ status }) => status.level === 'soon' || status.level === 'urgent' || status.level === 'passed')
        .slice(0, 5),
    [items, today, alertDays],
  );

  const scansLeft = quota ? Math.max(0, quota.scans_limit - quota.scans_used) : null;

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.headerRow}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={typography.caption}>{greeting()}{profile?.display_name ? `, ${profile.display_name}` : ''}</Text>
          <Text style={typography.display}>Que reste-t-il{'\n'}dans votre cuisine ?</Text>
        </View>
        <Pressable accessibilityLabel="Mon profil" onPress={() => router.push('/profile')} style={styles.avatar}>
          <Text style={styles.avatarLetter}>{(profile?.display_name?.[0] ?? '·').toUpperCase()}</Text>
        </Pressable>
      </Animated.View>

      {error && <Banner tone="danger">{error}</Banner>}
      {!canWrite && (
        <Card onPress={() => router.push('/household')} style={styles.upsell}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.warning} />
          <Text style={[typography.body, { flex: 1 }]}>Foyer partagé en lecture seule : l'offre Famille n'est plus active.</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Card>
      )}

      {AI_PHOTO_SCAN_ENABLED && plan === 'free' && scansLeft !== null && scansLeft <= 1 && (
        <Card onPress={() => openPaywall('scan_quota')} style={styles.upsell}>
          <Ionicons name="sparkles-outline" size={20} color={colors.sageDark} />
          <Text style={[typography.body, { flex: 1 }]}>
            {scansLeft === 0 ? 'Scans du mois utilisés.' : 'Plus qu\'un scan ce mois-ci.'} Premium : 30 scans par mois.
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Card>
      )}

      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <Pressable onPress={() => router.push('/scan')} style={({ pressed }) => [styles.scanCard, pressed && { opacity: 0.92 }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.scanTitle}>Ajouter des aliments</Text>
            <Text style={styles.scanSubtitle}>
              Codes-barres ou ticket de caisse · gratuit et illimité
            </Text>
          </View>
          <View style={styles.scanIcon}><Ionicons name="scan" size={26} color={colors.sageDark} /></View>
        </Pressable>
      </Animated.View>

      {nextMeal && (
        <Card onPress={() => router.push('/planning')} style={styles.nextMeal}>
          <View style={styles.nextIcon}><Ionicons name="calendar-outline" size={20} color={colors.sageDark} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={typography.caption}>
              Prochain repas · {nextMeal.plan_date === today ? "aujourd'hui" : 'demain'} · {SLOT_LABEL[nextMeal.slot]}
            </Text>
            <Text style={typography.heading} numberOfLines={1}>{nextMeal.recipes?.title ?? nextMeal.custom_title}</Text>
            {missingFor(nextMeal).length > 0 && (
              <Text style={[typography.caption, { color: colors.warning }]}>{missingFor(nextMeal).length} ingrédient(s) à acheter</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Card>
      )}

      <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.summaryRow}>
        {STORAGE.map((s) => (
          <Card key={s.kind} style={styles.summaryCard} onPress={() => router.push({ pathname: '/stock', params: { kind: s.kind } })}>
            <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.sageDark} />
            <Text style={styles.summaryCount}>{countsByKind[s.kind]}</Text>
            <Text style={typography.caption} numberOfLines={1}>{s.label}</Text>
          </Card>
        ))}
      </Animated.View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="À consommer rapidement" />
        {loading ? (
          <ActivityIndicator color={colors.sage} />
        ) : toEatSoon.length > 0 ? (
          toEatSoon.map(({ it }) => (
            <FoodItemRow key={it.id} item={it} alertDays={alertDays} onPress={() => router.push(`/item/${it.id}`)} />
          ))
        ) : (
          <Card>
            <Text style={[typography.body, { color: colors.textMuted }]}>
              {items.length === 0
                ? 'Votre stock est vide. Lancez un scan ou ajoutez un aliment à la main.'
                : "Rien d'urgent. Pensez à renseigner les dates de péremption pour être alerté à temps."}
            </Text>
          </Card>
        )}
      </View>

      {items.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <SectionTitle
            title="Recettes recommandées"
            action={<Text style={styles.link} onPress={() => router.push(recommended.length ? '/recipes' : '/recipe/generate')}>{recommended.length ? 'Tout voir' : 'Générer'}</Text>}
          />
          {recommended.length > 0 ? (
            recommended.map((r, i) => (
              <RecipeCard key={r.id} index={i} recipe={r} availability={availability(r)} favorite={favorites.has(r.id)} onPress={() => router.push(`/recipe/${r.id}`)} />
            ))
          ) : (
            <Card onPress={() => router.push({ pathname: '/recipe/generate', params: { focus: 'anti_waste' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name="sparkles-outline" size={22} color={colors.sageDark} />
              <Text style={[typography.body, { flex: 1 }]}>Trouvez des idées de recettes avec ce que vous avez déjà.</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Card>
          )}
        </View>
      )}

      {memberCount > 1 && activity.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Activité du foyer" action={<Text style={styles.link} onPress={() => router.push('/household')}>Le foyer</Text>} />
          <Card style={{ gap: spacing.md }}>
            {activity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <View style={styles.activityDot} />
                <Text style={[typography.body, { flex: 1, fontSize: 14 }]}>{activityText(a, a.actor_id === session?.user.id ? 'Vous' : memberNames.get(a.actor_id ?? '') ?? 'Un membre')}</Text>
                <Text style={typography.caption}>{relativeTime(a.created_at)}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {!loading && items.length === 0 && (
        <EmptyState icon="leaf-outline" title="Commencez en 30 secondes" message="Prenez une photo de chaque étage de votre réfrigérateur : Sauge reconnaît vos aliments, vous validez." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  upsell: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.sageMist },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '700', color: colors.sageDark },
  nextMeal: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center' },
  scanCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.sage,
    borderRadius: radius.lg, padding: spacing.xl, ...shadow.floating,
  },
  scanTitle: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  scanSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.88)', fontWeight: '500' },
  scanIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryCard: { flex: 1, gap: 6, paddingVertical: spacing.lg },
  summaryCount: { fontSize: 24, fontWeight: '700', color: colors.text },
  link: { color: colors.sageDark, fontWeight: '600' },
});
