import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { type ErrorEntry, fetchErrors } from '@/features/admin/api';
import { colors, spacing, typography } from '@/theme';

// Erreurs serveur (edge functions), échecs IA et paiements. Les erreurs de l'app
// mobile sont dans Sentry.
export default function AdminErrors() {
  const [errors, setErrors] = useState<ErrorEntry[] | null>(null);
  useEffect(() => {
    void fetchErrors().then(setErrors).catch(() => setErrors([]));
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Erreurs techniques' }} />
      {!errors ? <ActivityIndicator color={colors.sage} style={{ marginTop: spacing.xl }} /> : (
        <FlatList
          data={errors}
          keyExtractor={(e, i) => `${e.at}-${i}`}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<Text style={typography.body}>Aucune erreur récente.</Text>}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <Card style={{ gap: 4, padding: spacing.md }}>
              <View style={styles.between}>
                <Text style={typography.heading}>{item.source}</Text>
                <Text style={typography.caption}>{new Date(item.at).toLocaleString('fr-FR')}</Text>
              </View>
              <Text style={[typography.body, { color: colors.danger }]}>{item.code}</Text>
              {item.message ? <Text style={typography.caption} numberOfLines={3}>{item.message}</Text> : null}
            </Card>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
