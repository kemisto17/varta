import { useThemedStyles } from '../../hooks/useTheme';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
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
  const { colors, styles } = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const availableWidth = Math.max(240, width - spacing.lg * 2);
  const cardWidth =
    events.length > 1 ? Math.max(240, availableWidth - 36) : availableWidth;
  const snapInterval = cardWidth + spacing.md;

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
          <Text style={styles.seeAll}>All events</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View accessibilityLabel="Loading campus events" style={styles.loadingCard}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Couldn’t load campus events.</Text>
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
        <FlatList
          data={events}
          decelerationRate="fast"
          disableIntervalMomentum
          horizontal
          ItemSeparatorComponent={EventSeparator}
          keyExtractor={(event) => event.id}
          renderItem={({ item }) => (
            <EventCard
              containerStyle={[styles.eventCard, { width: cardWidth }]}
              event={item}
              interestPending={interestPendingIds.has(item.id)}
              onInterestToggle={onInterestToggle}
              onPress={onEventPress}
            />
          )}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={snapInterval}
        />
      )}
    </View>
  );
}

function EventSeparator() {
  return <View style={{ width: spacing.md }} />;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { marginTop: spacing.xl },
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
  eventCard: { marginBottom: 0 },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  stateMessage: { marginTop: spacing.xs, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  retry: { marginTop: spacing.md, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  pressed: { opacity: 0.55 },
});
