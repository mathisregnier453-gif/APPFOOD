import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  Pressable, ScrollView, type StyleProp, StyleSheet, Text, TextInput, type TextInputProps, View, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { categoryById } from '@/lib/catalog';
import type { ExpiryLevel } from '@/lib/expiry';
import { colors, radius, shadow, spacing, typography } from '@/theme';

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = <View style={[padded && styles.padded, { flexGrow: 1 }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={typography.heading}>{title}</Text>
      {action}
    </View>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={typography.caption}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        style={[styles.input, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon && <Ionicons name={icon} size={15} color={selected ? '#fff' : colors.textMuted} />}
      <Text style={[styles.chipLabel, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function CategoryIcon({ categoryId, size = 44 }: { categoryId: string; size?: number }) {
  const cat = categoryById(categoryId);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: cat.tint, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={size * 0.48} color={colors.text} />
    </View>
  );
}

const BADGE: Record<ExpiryLevel, { bg: string; fg: string } | null> = {
  none: null,
  ok: { bg: colors.sageMist, fg: colors.sageDark },
  soon: { bg: colors.warningBg, fg: colors.warning },
  urgent: { bg: colors.warningBg, fg: colors.warning },
  passed: { bg: colors.dangerBg, fg: colors.danger },
};

export function ExpiryBadge({ level, label }: { level: ExpiryLevel; label: string }) {
  const style = BADGE[level];
  if (!style) return null;
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.badgeLabel, { color: style.fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, message, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.sageDark} />
      </View>
      <Text style={[typography.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text>
      {children}
    </View>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger'; children: ReactNode }) {
  const palette = { info: [colors.infoBg, colors.info], warning: [colors.warningBg, colors.warning], danger: [colors.dangerBg, colors.danger] }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette[0] }]}>
      <Text style={[typography.body, { color: palette[1], fontSize: 14 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  padded: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: spacing.lg, fontSize: 16, color: colors.text,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36,
    borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.sage, borderColor: colors.sage },
  chipLabel: { fontSize: 14, fontWeight: '500', color: colors.text },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeLabel: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: colors.sageMist, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  banner: { borderRadius: radius.md, padding: spacing.lg },
});
