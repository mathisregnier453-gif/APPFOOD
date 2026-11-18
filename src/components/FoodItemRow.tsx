import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { formatQuantity } from '@/lib/catalog';
import { getExpiryStatus, localTodayIso } from '@/lib/expiry';
import type { FoodItem } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';
import { Card, CategoryIcon, ExpiryBadge } from './ui';

export function FoodItemRow({ item, alertDays, onPress, locationLabel }: { item: FoodItem; alertDays: number; onPress: () => void; locationLabel?: string }) {
  const expiry = getExpiryStatus(item.expiry_date, item.expiry_kind, localTodayIso(), alertDays);
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Card onPress={onPress} style={styles.card}>
        <CategoryIcon categoryId={item.category_id} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={typography.heading} numberOfLines={1}>{item.name}</Text>
          <Text style={typography.caption} numberOfLines={1}>
            {formatQuantity(item.quantity, item.unit, item.quantity_is_estimate)}
            {locationLabel ? ` · ${locationLabel}` : ''}
          </Text>
          {expiry.level !== 'none' && <ExpiryBadge level={expiry.level} label={expiry.label} />}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
});
