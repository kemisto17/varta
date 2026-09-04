import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';
import { getLostFoundCategoryLabel } from '../../lib/lostFound';
import { formatRelativeTimestamp } from '../../lib/time';
import type { LostFoundItem } from '../../types/lostFound';
import { Avatar } from '../Avatar';
import { OrganizationAvatar } from '../organizations/OrganizationAvatar';

type LostFoundFeedCardProps = {
  item: LostFoundItem;
  onPress: () => void;
};

export function LostFoundFeedCard({
  item,
  onPress,
}: LostFoundFeedCardProps) {
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
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        {item.author.kind === 'student' ? (
          <Avatar
            fullName={item.author.fullName}
            uri={item.author.avatarUrl}
            verified={item.author.isVerified}
          />
        ) : (
          <OrganizationAvatar
            name={item.author.fullName}
            size={42}
            uri={item.author.avatarUrl}
          />
        )}

        <View style={styles.authorCopy}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.authorName}>
              {item.author.fullName}
            </Text>
            {item.author.kind === 'organization' && item.author.isVerified ? (
              <SymbolView
                name={{
                  android: 'verified',
                  ios: 'checkmark.seal.fill',
                  web: 'verified',
                }}
                size={14}
                tintColor={colors.textPrimary}
              />
            ) : null}
          </View>

          <Text numberOfLines={1} style={styles.identityMeta}>
            {item.author.kind === 'student'
              ? `@${item.author.username} · ${item.author.institute.short_name}`
              : `Official organization · ${item.author.campusShortName}`}
          </Text>
          <Text style={styles.time}>{formatRelativeTimestamp(item.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.labelRow}>
        <View style={styles.moduleBadge}>
          <SymbolView
            name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }}
            size={13}
            tintColor={colors.textSecondary}
          />
          <Text style={styles.moduleLabel}>LOST & FOUND</Text>
        </View>
        <View
          style={[
            styles.kindBadge,
            item.kind === 'lost' ? styles.lostBadge : styles.foundBadge,
          ]}
        >
          <Text style={styles.kindLabel}>
            {item.kind === 'lost' ? 'LOST' : 'FOUND'}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>

      {metadata.length > 0 ? (
        <Text numberOfLines={2} style={styles.metadata}>
          {metadata.join(' · ')}
        </Text>
      ) : null}

      {item.imageUrl ? (
        <Image
          accessibilityLabel={`Photo of ${item.title}`}
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={item.imageUrl}
          source={item.imageUrl}
          style={styles.image}
          transition={180}
        />
      ) : null}

      <View style={styles.actionRow}>
        <Text style={styles.actionLabel}>View details</Text>
        <SymbolView
          name={{
            android: 'arrow_forward',
            ios: 'arrow.right',
            web: 'arrow_forward',
          }}
          size={16}
          tintColor={colors.textSecondary}
        />
      </View>
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
    container: {
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    pressed: { opacity: 0.62 },
    header: { flexDirection: 'row', alignItems: 'center' },
    authorCopy: { flex: 1, marginLeft: spacing.md },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    authorName: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    identityMeta: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
    time: { marginTop: 2, fontSize: 11, color: colors.textMuted },
    labelRow: {
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    moduleBadge: {
      minHeight: 28,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
    },
    moduleLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.textSecondary,
    },
    kindBadge: {
      minHeight: 28,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
    },
    lostBadge: { backgroundColor: colors.dangerSoft },
    foundBadge: { backgroundColor: colors.successSoft },
    kindLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.7,
      color: colors.textPrimary,
    },
    title: {
      marginTop: spacing.md,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    description: {
      marginTop: spacing.xs,
      fontSize: 16,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    metadata: {
      marginTop: spacing.sm,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    image: {
      width: '100%',
      marginTop: spacing.md,
      aspectRatio: 4 / 3,
      borderRadius: radius.lg,
      backgroundColor: colors.borderSubtle,
    },
    actionRow: {
      minHeight: 34,
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    actionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  });
