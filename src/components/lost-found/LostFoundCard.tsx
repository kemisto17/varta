import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';
import { getLostFoundCategoryLabel } from '../../lib/lostFound';
import { formatRelativeTimestamp } from '../../lib/time';
import type { LostFoundItem } from '../../types/lostFound';

type LostFoundCardProps = {
  item: LostFoundItem;
  onPress: () => void;
};

export function LostFoundCard({ item, onPress }: LostFoundCardProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const metadata = [
    getLostFoundCategoryLabel(item.category),
    item.campusLocation,
    formatItemDate(item.itemDate),
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityLabel={`Open ${item.kind} item: ${item.title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.copy}>
        <View style={styles.labelRow}>
          <Text style={styles.moduleLabel}>LOST & FOUND</Text>
          <View
            style={[
              styles.kindBadge,
              item.kind === 'lost' ? styles.lostBadge : styles.foundBadge,
            ]}
          >
            <Text style={styles.kindText}>
              {item.kind === 'lost' ? 'LOST' : 'FOUND'}
            </Text>
          </View>
          {item.status === 'resolved' ? (
            <View style={styles.resolvedBadge}>
              <Text style={styles.resolvedText}>RESOLVED</Text>
            </View>
          ) : null}
        </View>

        <Text numberOfLines={2} style={styles.title}>
          {item.title}
        </Text>
        <Text numberOfLines={2} style={styles.description}>
          {item.description}
        </Text>
        <Text numberOfLines={1} style={styles.metadata}>
          {metadata.join(' · ')}
        </Text>
        <Text numberOfLines={1} style={styles.author}>
          {item.author.fullName} · {formatRelativeTimestamp(item.createdAt)}
        </Text>
      </View>

      {item.imageUrl ? (
        <Image
          accessibilityLabel={`Photo of ${item.title}`}
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={item.imageUrl}
          source={item.imageUrl}
          style={styles.image}
          transition={160}
        />
      ) : (
        <View style={styles.imageFallback}>
          <SymbolView
            name={{
              android: item.kind === 'lost' ? 'search' : 'inventory_2',
              ios: item.kind === 'lost' ? 'magnifyingglass' : 'shippingbox',
              web: item.kind === 'lost' ? 'search' : 'inventory_2',
            }}
            size={26}
            tintColor={colors.textMuted}
          />
        </View>
      )}
    </Pressable>
  );
}

function formatItemDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      minHeight: 148,
      marginBottom: spacing.sm,
      padding: spacing.md,
      flexDirection: 'row',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    cardPressed: { backgroundColor: colors.borderSubtle },
    copy: { flex: 1, minWidth: 0 },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    moduleLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    kindBadge: {
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
    },
    lostBadge: { backgroundColor: colors.dangerSoft },
    foundBadge: { backgroundColor: colors.successSoft },
    kindText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.textPrimary,
    },
    resolvedBadge: {
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.borderSubtle,
    },
    resolvedText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: colors.textSecondary,
    },
    title: {
      marginTop: spacing.sm,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    description: {
      marginTop: spacing.xs,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
    },
    metadata: { marginTop: spacing.sm, fontSize: 11, color: colors.textMuted },
    author: { marginTop: 3, fontSize: 11, color: colors.textMuted },
    image: {
      width: 96,
      height: 116,
      borderRadius: radius.md,
      backgroundColor: colors.borderSubtle,
    },
    imageFallback: {
      width: 96,
      height: 116,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
  });
