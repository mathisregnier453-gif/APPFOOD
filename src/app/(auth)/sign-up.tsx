import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Field, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message.includes('registered') ? 'Un compte existe déjà avec cet e-mail.' : "L'inscription a échoué. Réessayez.");
      return;
    }
    // Confirmation e-mail activée => pas de session immédiate.
    if (!data.session) setCheckEmail(true);
  };

  if (checkEmail) {
    return (
      <Screen>
        <View style={{ gap: spacing.lg, marginTop: spacing.xxl * 2 }}>
          <Text style={typography.title}>Vérifiez vos e-mails</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            Nous avons envoyé un lien de confirmation à {email.trim()}. Ouvrez-le, puis connectez-vous.
          </Text>
          <Button label="Retour à la connexion" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
          <Text style={typography.title}>Créer votre compte</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>Gratuit, sans carte bancaire.</Text>
        </View>
        <View style={{ gap: spacing.lg }}>
          <Field label="Prénom" value={name} onChangeText={setName} autoComplete="given-name" maxLength={60} />
          <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Mot de passe (8 caractères min.)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          {error && <Banner tone="danger">{error}</Banner>}
          <Button label="Créer mon compte" onPress={submit} loading={loading} disabled={!email || !password} />
          <Button label="J'ai déjà un compte" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
