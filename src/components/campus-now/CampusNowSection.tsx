import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import type { CampusEvent } from '../../types/event';
import { EventCard } from '../events/EventCard';

type CampusNowSectionProps = {
  errorMessage: string | null;
  events: CampusEvent[];
  interestPendingIds: Set<string>;
  isLoading: boolean;
  onEventPress: (event: CampusEvent) => void;
  onInterestToggle: (event: CampusEvent) => void;
  onRetry: () => void;
  onSeeAll: () => void;
};

export function CampusNowSection({
  errorMessage,
  events,
  interestPendingIds,
  isLoading,
  onEventPress,
  onInterestToggle,
  onRetry,
  onSeeAll,
}: CampusNowSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>YOUR UNIVERSITY</Text>
          <Text style={styles.title}>Campus Now</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onSeeAll}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View accessibilityLabel="Loading campus events" style={styles.loadingCard}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Couldn't load campus events.</Text>
          <Text style={styles.stateMessage}>{errorMessage}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Nothing happening yet.</Text>
          <Text style={styles.stateMessage}>New campus events will appear here.</Text>
        </View>
      ) : (
        events.map((event) => (
          <EventCard
            event={event}
            interestPending={interestPendingIds.has(event.id)}
            key={event.id}
            onInterestToggle={onInterestToggle}
            onPress={onEventPress}
          />
        ))
      )}

      {events.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSeeAll}
          style={({ pressed }) => [styles.allButton, pressed && styles.pressed]}
        >
          <Text style={styles.allButtonText}>See all events</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl },
  headingRow: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.25, color: colors.textMuted },
  title: { marginTop: spacing.xs, fontSize: 23, fontWeight: '700', color: colors.textPrimary },
  seeAll: { paddingVertical: spacing.sm, fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  stateCard: {
    minHeight: 132,
    padding: spacing.lg,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  loadingCard: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  stateMessage: { marginTop: spacing.xs, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  retry: { marginTop: spacing.md, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  allButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  allButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  pressed: { opacity: 0.55 },
});
