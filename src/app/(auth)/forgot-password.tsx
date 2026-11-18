import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Field, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme';

// Réinitialisation par code reçu par e-mail : aucun lien à ouvrir, fonctionne
// quel que soit l'appareil sur lequel l'e-mail est lu.
export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    // Même message que l'adresse existe ou non (pas d'énumération des comptes).
    if (e && e.status === 429) {
      setError('Trop de demandes. Réessayez dans quelques minutes.');
      return;
    }
    setInfo(`Si un compte existe pour ${email.trim()}, un code vient d'y être envoyé.`);
    setStep('code');
  };

  const reset = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    const { error: otpError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (otpError) {
      setLoading(false);
      setError('Code invalide ou expiré.');
      return;
    }
    const { error: updError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updError) setError('Le mot de passe n\'a pas pu être changé. Choisissez-en un autre.');
    // Succès : la session est ouverte, la navigation principale prend le relais.
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
          <Text style={typography.title}>Mot de passe oublié</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {step === 'email' ? 'Indiquez votre e-mail : nous vous envoyons un code.' : 'Saisissez le code reçu et votre nouveau mot de passe.'}
          </Text>
        </View>
        <View style={{ gap: spacing.lg }}>
          {step === 'email' ? (
            <>
              <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              {error && <Banner tone="danger">{error}</Banner>}
              <Button label="Recevoir un code" onPress={sendCode} loading={loading} disabled={!email.includes('@')} />
            </>
          ) : (
            <>
              {info && <Banner>{info}</Banner>}
              <Field label="Code reçu par e-mail" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={10} />
              <Field label="Nouveau mot de passe (8 caractères min.)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
              {error && <Banner tone="danger">{error}</Banner>}
              <Button label="Changer le mot de passe" onPress={reset} loading={loading} disabled={code.length < 6 || !password} />
              <Button label="Renvoyer un code" variant="ghost" onPress={sendCode} disabled={loading} />
            </>
          )}
          <Button label="Retour à la connexion" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
