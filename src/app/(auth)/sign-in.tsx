import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Banner, Field, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authError) setError('E-mail ou mot de passe incorrect.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <View style={styles.logo}><Text style={styles.logoLetter}>S</Text></View>
          <Text style={typography.display}>Sauge</Text>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Scannez votre frigo, retrouvez vos aliments,{'\n'}gaspillez moins.
          </Text>
        </Animated.View>

        <View style={{ gap: spacing.lg }}>
          <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" />
          {error && <Banner tone="danger">{error}</Banner>}
          <Button label="Se connecter" onPress={submit} loading={loading} disabled={!email || !password} />
          <Link href="/(auth)/sign-up" style={styles.link}>Créer un compte</Link>
          <Link href="/(auth)/forgot-password" style={[styles.link, { color: colors.textMuted, fontWeight: '500', paddingVertical: 0 }]}>Mot de passe oublié ?</Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl * 1.5, marginBottom: spacing.xl },
  logo: { width: 76, height: 76, borderRadius: 26, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: '#fff', fontSize: 38, fontWeight: '700' },
  link: { textAlign: 'center', color: colors.sageDark, fontWeight: '600', fontSize: 15, paddingVertical: spacing.md },
});
