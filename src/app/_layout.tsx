import * as Notifications from 'expo-notifications';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { EntitlementsProvider } from '@/features/billing/EntitlementsProvider';
import { initErrorTracking, setAnalyticsConsent, setErrorUser, wrapRoot } from '@/lib/observability';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();
initErrorTracking();

function RootNavigator() {
  const { session, profile, loading } = useAuth();

  // Erreurs : identifiant technique seulement ; statistiques : selon le consentement.
  useEffect(() => {
    setErrorUser(session?.user.id ?? null);
    if (session) void supabase.rpc('touch_last_active');
  }, [session?.user.id]);
  useEffect(() => {
    setAnalyticsConsent(profile?.analytics_consent === true);
  }, [profile?.analytics_consent]);

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  // Tap sur un rappel : ouverture de l'écran concerné (ex. recettes anti-gaspi).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    });
    return () => sub.remove();
  }, []);

  const signedIn = !!session;
  const consented = !!profile?.privacy_consent_at;
  const segments = useSegments();

  // Redirection explicite selon l'état : sans elle, l'URL "/" (onglets protégés)
  // n'a aucun écran pour un visiteur non connecté ("Unmatched Route").
  useEffect(() => {
    if (loading || (signedIn && !profile)) return;
    const area = segments[0];
    if (!signedIn && area !== '(auth)') router.replace('/sign-in');
    else if (signedIn && !consented && area !== 'onboarding') router.replace('/onboarding/consent');
    else if (signedIn && consented && (area === '(auth)' || area === 'onboarding')) router.replace('/');
  }, [loading, signedIn, consented, profile, segments]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !consented}>
        <Stack.Screen name="onboarding/consent" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && consented}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="item/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="item/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe/generate" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="preferences" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="household/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="household/join" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin" />
        <Stack.Screen name="recipe/cook" options={{ presentation: 'modal' }} />
        <Stack.Screen name="planning/slot" options={{ presentation: 'modal' }} />
        <Stack.Screen name="planning/generate" options={{ presentation: 'modal' }} />
        <Stack.Screen name="planning/assign" options={{ presentation: 'modal' }} />
        <Stack.Screen name="shopping/purchase" options={{ presentation: 'modal' }} />
        <Stack.Screen name="item/barcode" options={{ presentation: 'fullScreenModal' }} />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <EntitlementsProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </EntitlementsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default wrapRoot(RootLayout);
