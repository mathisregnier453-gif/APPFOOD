import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEntitlements } from '@/features/billing/EntitlementsProvider';
import { acceptInvite } from '@/features/household/api';
import { ApiError } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme';
import { track } from '@/lib/observability';

const MESSAGES: Record<string, string> = {
  invalid_code: 'Code invalide, expiré ou déjà utilisé. Demandez un nouveau code au propriétaire du foyer.',
  too_many_attempts: 'Trop de tentatives. Réessayez dans une heure.',
  already_member: 'Vous faites déjà partie de ce foyer.',
  household_full: 'Ce foyer est complet.',
  feature_locked: "Ce foyer n'a pas l'offre Famille : il ne peut pas accueillir de nouveaux membres.",
};

export default function JoinHouseholdScreen() {
  const { refreshProfile } = useAuth();
  const { refresh } = useEntitlements();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(clean);
      track('household_joined', {});
      await refreshProfile();
      await refresh();
      router.dismissAll();
      router.replace('/');
    } catch (err) {
      setError(MESSAGES[err instanceof ApiError ? err.code : ''] ?? 'Une erreur est survenue. Réessayez.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.header}>
          <Text style={typography.title}>Rejoindre un foyer</Text>
          <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          Saisissez le code reçu. Vous partagerez le stock, les courses et le planning de ce foyer ; votre foyer personnel reste disponible dans « Mes foyers ».
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="ABCD 2345"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          style={styles.input}
          accessibilityLabel="Code d'invitation"
        />
        {error && <Banner tone="danger">{error}</Banner>}
        <Button label="Rejoindre" icon="enter-outline" onPress={join} loading={busy} disabled={clean.length !== 8} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  input: {
    height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    textAlign: 'center', fontSize: 26, fontWeight: '700', letterSpacing: 4, color: colors.text,
  },
});
