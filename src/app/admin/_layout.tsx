import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme';

// Espace réservé aux administrateurs. Le masquage ici n'est qu'un confort :
// chaque fonction admin_* est refusée par le serveur aux autres comptes.
export default function AdminLayout() {
  const { profile } = useAuth();
  if (!profile?.is_admin) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: true, headerTintColor: colors.sageDark, headerStyle: { backgroundColor: colors.background }, contentStyle: { backgroundColor: colors.background } }} />;
}
