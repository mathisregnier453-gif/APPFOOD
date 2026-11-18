import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'md' | 'lg';
}

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, style, size = 'lg' }: ButtonProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const inactive = disabled || loading;
  const palette = PALETTE[variant];

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        disabled={inactive}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 18, stiffness: 300 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 300 }))}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
        style={[
          styles.base,
          size === 'md' && styles.md,
          { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive && !loading ? 0.5 : 1 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <View style={styles.row}>
            {icon && <Ionicons name={icon} size={19} color={palette.fg} />}
            <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const PALETTE: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.sage, fg: '#FFFFFF', border: colors.sage },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.sageDark, border: 'transparent' },
  danger: { bg: colors.dangerBg, fg: colors.danger, border: colors.dangerBg },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  md: { minHeight: 44, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: -0.1 },
});
