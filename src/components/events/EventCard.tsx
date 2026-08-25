import { useThemedStyles } from '../../hooks/useTheme';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { formatEventStart, isEventHappeningNow } from '../../lib/time';
import type { CampusEvent } from '../../types/event';

type EventCardProps = {
  event: CampusEvent;
  interestPending?: boolean;
  onInterestToggle?: (event: CampusEvent) => void;
  onPress: (event: CampusEvent) => void;
};

export function EventCard({
  event,
  interestPending = false,
  onInterestToggle,
  onPress,
}: EventCardProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const isCancelled = event.status === 'cancelled';
  const happeningNow = isEventHappeningNow(event.startsAt, event.endsAt);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onPress(event)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {event.coverUrl ? (
          <Image
            accessibilityLabel={`${event.title} cover`}
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: event.coverUrl }}
            style={styles.cover}
            transition={140}
          />
        ) : null}

        <View style={styles.copy}>
          <View style={styles.organizationRow}>
            <Text numberOfLines={1} style={styles.organization}>
              {event.organization.name}
            </Text>
            {event.organization.isVerified ? (
              <SymbolView
                name={{ android: 'verified', ios: 'checkmark.seal.fill', web: 'verified' }}
                size={14}
                tintColor={colors.textPrimary}
              />
            ) : null}
            {happeningNow && !isCancelled ? (
              <Text style={styles.liveLabel}>NOW</Text>
            ) : null}
            {isCancelled ? <Text style={styles.cancelledLabel}>CANCELLED</Text> : null}
          </View>

          <Text numberOfLines={2} style={[styles.title, isCancelled && styles.cancelledText]}>
            {event.title}
          </Text>
          <Text style={styles.meta}>{formatEventStart(event.startsAt)}</Text>
          {event.location ? (
            <Text numberOfLines={1} style={styles.location}>
              {event.location}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {onInterestToggle && !isCancelled ? (
        <Pressable
          accessibilityRole="button"
          disabled={interestPending}
          onPress={() => onInterestToggle(event)}
          style={({ pressed }) => [
            styles.interestButton,
            event.isInterested && styles.interestButtonActive,
            pressed && styles.pressed,
            interestPending && styles.disabled,
          ]}
        >
          <SymbolView
            name={{
              android: event.isInterested ? 'bookmark' : 'bookmark_border',
              ios: event.isInterested ? 'bookmark.fill' : 'bookmark',
              web: event.isInterested ? 'bookmark' : 'bookmark_border',
            }}
            size={15}
            tintColor={event.isInterested ? colors.white : colors.textPrimary}
          />
          <Text
            style={[
              styles.interestLabel,
              event.isInterested && styles.interestLabelActive,
            ]}
          >
            {event.isInterested ? 'Interested' : 'Save event'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 8.5,
    backgroundColor: colors.borderSubtle,
  },
  copy: { padding: spacing.md },
  organizationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  organization: {
    maxWidth: '65%',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  liveLabel: {
    marginLeft: 'auto',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.success,
  },
  cancelledLabel: {
    marginLeft: 'auto',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: colors.danger,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cancelledText: { textDecorationLine: 'line-through', color: colors.textSecondary },
  meta: { marginTop: spacing.sm, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  location: { marginTop: 4, fontSize: 13, color: colors.textSecondary },
  interestButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  interestButtonActive: { backgroundColor: colors.textPrimary },
  interestLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  interestLabelActive: { color: colors.white },
  pressed: { opacity: 0.58 },
  disabled: { opacity: 0.45 },
});
