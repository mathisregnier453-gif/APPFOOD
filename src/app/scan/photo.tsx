import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Banner, Card, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { openPaywall, useEntitlements } from '@/features/billing/EntitlementsProvider';
import { fetchQuota } from '@/features/inventory/api';
import {
  analyzeScan, cancelScan, type CapturedPhoto, compressPhoto, createScanSession, uploadScanPhotos,
} from '@/features/scan/api';
import { notifyQuotaLow } from '@/features/notifications/notifications';
import { STORAGE, storageByKind } from '@/lib/catalog';
import { ApiError, supabase } from '@/lib/supabase';
import type { QuotaStatus, StorageKind } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/theme';
import { track } from '@/lib/observability';

type Stage = 'idle' | 'preparing' | 'uploading' | 'analyzing';

const STAGE_LABEL: Record<Stage, string> = {
  idle: '',
  preparing: 'Optimisation des photos…',
  uploading: 'Envoi sécurisé…',
  analyzing: 'Reconnaissance des aliments…',
};

function errorMessage(err: unknown, quota: QuotaStatus | null): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'quota_exceeded':
        return `Vous avez utilisé vos ${err.details.scans_limit ?? quota?.scans_limit ?? ''} scans du mois. Ils se renouvellent le ${quota ? new Date(quota.period_end).toLocaleDateString('fr-FR') : 'mois prochain'}. Les offres Premium (30 scans) et Famille (60 scans) permettent d'en faire plus.`;
      case 'analysis_failed':
        return "L'analyse n'a pas abouti. Ce scan ne vous a pas été décompté : vous pouvez réessayer.";
      case 'too_many_photos':
        return `Votre offre permet ${err.details.max} photos par scan.`;
      case 'household_read_only':
        return "Ce foyer partagé n'a plus l'offre Famille : seul son propriétaire peut scanner. Revenez à votre foyer personnel depuis Profil > Mon foyer.";
      case 'account_suspended':
        return 'Votre compte est suspendu. Contactez le support.';
      case 'network_error':
        return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
    }
  }
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

export default function ScanCaptureScreen() {
  const { session, householdId, profile } = useAuth();
  const { plan } = useEntitlements();
  const [kind, setKind] = useState<StorageKind>('fridge');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [maxPhotos, setMaxPhotos] = useState(4);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    void (async () => {
      const q = await fetchQuota(householdId).catch(() => null);
      setQuota(q);
      if (q) {
        const { data } = await supabase.from('plans').select('max_photos_per_scan').eq('code', q.plan).single();
        if (data) setMaxPhotos(data.max_photos_per_scan);
      }
    })();
  }, [householdId]);

  const busy = stage !== 'idle';
  const scansLeft = quota ? Math.max(0, quota.scans_limit - quota.scans_used) : null;

  // Toute modification des photos invalide la session en cours (nouvelle analyse nécessaire).
  const resetSession = () => {
    if (sessionId) void cancelScan(sessionId);
    setSessionId(null);
    setUploaded(false);
  };

  const addAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setStage('preparing');
    try {
      const room = maxPhotos - photos.length;
      const compressed = await Promise.all(assets.slice(0, room).map((a) => compressPhoto({ uri: a.uri, width: a.width, height: a.height })));
      resetSession();
      setPhotos((prev) => [...prev, ...compressed].slice(0, maxPhotos));
    } finally {
      setStage('idle');
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Appareil photo', "Autorisez l'accès à l'appareil photo dans les réglages pour scanner vos aliments.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
    if (!res.canceled) await addAssets(res.assets);
  };

  const importPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: maxPhotos - photos.length, quality: 0.9, exif: false,
    });
    if (!res.canceled) await addAssets(res.assets);
  };

  const analyze = async () => {
    if (!session || !householdId || photos.length === 0) return;
    setError(null);
    try {
      let id = sessionId;
      if (!id) {
        id = await createScanSession(householdId, session.user.id, kind);
        setSessionId(id);
      }
      if (!uploaded) {
        // Ré-essai après coupure : l'envoi reprend dans la même session (aucun scan perdu).
        setStage('uploading');
        await uploadScanPhotos(householdId, id, photos);
        setUploaded(true);
      }
      setStage('analyzing');
      const result = await analyzeScan(id);
      track('scan_completed', { items: result.detections.length, photos: photos.length, from_cache: result.from_cache });
      if (result.quota && quota) {
        void notifyQuotaLow(result.quota.scans_limit - result.quota.scans_used, quota.period_end, profile?.notification_prefs?.quota ?? true).catch(() => undefined);
      }
      router.replace({ pathname: '/scan/review', params: { sessionId: result.session_id, kind } });
    } catch (err) {
      setError(errorMessage(err, quota));
      if (err instanceof ApiError && err.code === 'quota_exceeded') setQuota((q) => (q ? { ...q, scans_used: q.scans_limit } : q));
    } finally {
      setStage('idle');
    }
  };

  const close = () => {
    resetSession();
    router.back();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Scanner</Text>
        <Pressable accessibilityLabel="Fermer" onPress={close} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={typography.caption}>Quel espace scannez-vous ?</Text>
        <View style={styles.kinds}>
          {STORAGE.map((s) => {
            const active = s.kind === kind;
            return (
              <Pressable
                key={s.kind}
                disabled={busy}
                onPress={() => {
                  if (s.kind !== kind) resetSession();
                  setKind(s.kind);
                }}
                style={[styles.kind, active && styles.kindActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={22} color={active ? '#fff' : colors.sageDark} />
                <Text style={[styles.kindLabel, active && { color: '#fff' }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[typography.caption, { color: colors.textFaint }]}>{storageByKind(kind).hint}</Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={styles.rowBetween}>
          <Text style={typography.heading}>Photos</Text>
          <Text style={typography.caption}>{photos.length} / {maxPhotos}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {photos.map((p, i) => (
            <Animated.View key={p.uri} entering={ZoomIn.duration(200)} style={styles.thumbWrap}>
              <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
              {!busy && (
                <Pressable
                  accessibilityLabel={`Retirer la photo ${i + 1}`}
                  style={styles.remove}
                  onPress={() => {
                    resetSession();
                    setPhotos((prev) => prev.filter((x) => x.uri !== p.uri));
                  }}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              )}
            </Animated.View>
          ))}
          {photos.length < maxPhotos && (
            <Pressable onPress={takePhoto} disabled={busy} style={[styles.thumb, styles.addThumb]} accessibilityLabel="Prendre une photo">
              <Ionicons name="camera-outline" size={26} color={colors.sageDark} />
              <Text style={[typography.caption, { color: colors.sageDark }]}>Photo</Text>
            </Pressable>
          )}
        </ScrollView>
        {photos.length < maxPhotos && (
          <Pressable onPress={importPhotos} disabled={busy}>
            <Text style={styles.import}>Importer depuis la galerie</Text>
          </Pressable>
        )}
      </Card>

      {error && (
        <Animated.View entering={FadeIn}>
          <Banner tone={error.includes('scans du mois') ? 'warning' : 'danger'}>{error}</Banner>
          {error.includes('scans du mois') && plan !== 'family' && (
            <Button label="Voir les offres" icon="sparkles-outline" variant="secondary" size="md" style={{ marginTop: spacing.sm }} onPress={() => openPaywall('scan_quota')} />
          )}
        </Animated.View>
      )}

      <View style={{ marginTop: 'auto', gap: spacing.sm }}>
        {scansLeft !== null && (
          <Text style={[typography.caption, { textAlign: 'center' }]}>
            {scansLeft} scan{scansLeft > 1 ? 's' : ''} restant{scansLeft > 1 ? 's' : ''} · 1 scan = toutes les photos de cet espace
          </Text>
        )}
        {busy && <Text style={[typography.caption, { textAlign: 'center', color: colors.sageDark }]}>{STAGE_LABEL[stage]}</Text>}
        <Button
          label={photos.length === 0 ? 'Ajoutez au moins une photo' : 'Analyser mes aliments'}
          icon="sparkles-outline"
          onPress={analyze}
          loading={busy}
          disabled={photos.length === 0 || scansLeft === 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  kinds: { flexDirection: 'row', gap: spacing.sm },
  kind: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  kindActive: { backgroundColor: colors.sage, borderColor: colors.sage },
  kindLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumbWrap: { position: 'relative' },
  thumb: { width: 96, height: 128, borderRadius: radius.md },
  addThumb: { backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.sage },
  remove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  import: { color: colors.sageDark, fontWeight: '600', fontSize: 14 },
});
