import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner, Chip, Field, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchPreferences, savePreferences } from '@/features/recipes/api';
import { ALLERGEN_OPTIONS, DIET_OPTIONS } from '@/features/recipes/catalog';
import { colors, spacing, typography } from '@/theme';

function toList(text: string): string[] {
  return [...new Set(text.split(',').map((s) => s.trim()).filter((s) => s.length >= 2))].slice(0, 30);
}

export default function PreferencesScreen() {
  const { session } = useAuth();
  const [diets, setDiets] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [otherAllergies, setOtherAllergies] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    void fetchPreferences(session.user.id).then((p) => {
      setDiets(p.diets);
      setAllergies(p.allergies.filter((a) => ALLERGEN_OPTIONS.includes(a)));
      setOtherAllergies(p.allergies.filter((a) => !ALLERGEN_OPTIONS.includes(a)).join(', '));
      setDislikes(p.dislikes.join(', '));
    });
  }, [session]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const save = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      await savePreferences(session.user.id, {
        diets,
        allergies: [...new Set([...allergies, ...toList(otherAllergies)])].slice(0, 20),
        dislikes: toList(dislikes),
      });
      router.back();
    } catch {
      setError("L'enregistrement a échoué. Réessayez.");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.header}>
          <Text style={typography.title}>Préférences alimentaires</Text>
          <Pressable accessibilityLabel="Fermer" onPress={() => router.back()} hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <Text style={[typography.body, { color: colors.textMuted }]}>Utilisées pour toutes vos idées de recettes.</Text>

        <View style={styles.group}>
          <Text style={typography.heading}>Régime</Text>
          <View style={styles.wrap}>
            {DIET_OPTIONS.map((d) => <Chip key={d} label={d} selected={diets.includes(d)} onPress={() => toggle(diets, setDiets, d)} />)}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={typography.heading}>Allergies et intolérances</Text>
          <View style={styles.wrap}>
            {ALLERGEN_OPTIONS.map((a) => <Chip key={a} label={a} selected={allergies.includes(a)} onPress={() => toggle(allergies, setAllergies, a)} />)}
          </View>
          <Field label="Autres (séparées par des virgules)" value={otherAllergies} onChangeText={setOtherAllergies} placeholder="Ex. kiwi, pêche" />
          <Banner tone="info">Les recettes contenant un allergène déclaré sont écartées automatiquement. Ce filtre ne remplace pas la lecture des étiquettes.</Banner>
        </View>

        <Field label="Aliments que vous n'aimez pas" value={dislikes} onChangeText={setDislikes} placeholder="Ex. coriandre, chou de Bruxelles" />

        {error && <Banner tone="danger">{error}</Banner>}
        <Button label="Enregistrer" icon="checkmark" onPress={save} loading={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  group: { gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
