import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, shadow } from '@/theme';

// Cinq onglets + bouton Scanner flottant, accessible depuis tous les onglets.
function ScanButton() {
  return (
    <View style={styles.fabWrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scanner mon frigo"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/scan');
        }}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Ionicons name="scan" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} size={size} color={color as string} />;

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.sageDark,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline') }} />
        <Tabs.Screen name="stock" options={{ title: 'Mon stock', tabBarIcon: icon('grid-outline') }} />
        <Tabs.Screen name="recipes" options={{ title: 'Recettes', tabBarIcon: icon('restaurant-outline') }} />
        <Tabs.Screen name="planning" options={{ title: 'Planning', tabBarIcon: icon('calendar-outline') }} />
        <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: icon('cart-outline') }} />
      </Tabs>
      <ScanButton />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 88, paddingTop: 8 },
  fabWrap: { position: 'absolute', right: 20, bottom: 104 },
  fab: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.sage,
    alignItems: 'center', justifyContent: 'center', ...shadow.floating,
  },
});
