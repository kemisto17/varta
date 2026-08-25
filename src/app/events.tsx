import { useThemedStyles } from '../hooks/useTheme';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View, } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { EventCard } from '../components/events/EventCard';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { getEventErrorMessage, getEventsPage, setEventInterest } from '../lib/events';
import type { CampusEvent, EventCursor, EventFilter } from '../types/event';

type EventsStatus = 'loading' | 'ready' | 'error';
const FILTERS: { label: string; value: EventFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'My Institute', value: 'institute' },
  { label: 'Following', value: 'following' },
];

export default function EventsScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const eventsCountRef = useRef(0);
  const requestIdRef = useRef(0);
  const [cursor, setCursor] = useState<EventCursor | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [hasMore, setHasMore] = useState(false);
  const [interestPendingIds, setInterestPendingIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<EventsStatus>('loading');

  const loadEvents = useCallback(
    async (nextFilter: EventFilter, refresh = false) => {
      const userId = session?.user.id;

      if (!userId) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setErrorMessage(null);
      setFilter(nextFilter);

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setStatus('loading');
      }

      try {
        const page = await getEventsPage({
          filter: nextFilter,
          instituteId: profile?.institute_id ?? null,
          userId,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        setCursor(page.cursor);
        eventsCountRef.current = page.events.length;
        setEvents(page.events);
        setHasMore(page.hasMore);
        setStatus('ready');
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        console.warn('[events] Could not load event list.', error);
        setErrorMessage('Check your connection and try again.');
        setStatus(eventsCountRef.current > 0 ? 'ready' : 'error');
      } finally {
        setIsRefreshing(false);
      }
    },
    [profile?.institute_id, session?.user.id]
  );

  useFocusEffect(
    useCallback(() => {
      void loadEvents(filter, true);
    }, [filter, loadEvents])
  );

  const loadMore = useCallback(async () => {
    const userId = session?.user.id;

    if (!userId || !cursor || !hasMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const page = await getEventsPage(
        {
          filter,
          instituteId: profile?.institute_id ?? null,
          userId,
        },
        cursor
      );
      setCursor(page.cursor);
      setEvents((current) => {
        const nextEvents = [
          ...current,
          ...page.events.filter(
            (event) => !current.some((existing) => existing.id === event.id)
          ),
        ];

        eventsCountRef.current = nextEvents.length;
        return nextEvents;
      });
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn('[events] Could not load more events.', error);
      setErrorMessage('We could not load more events. Try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, filter, hasMore, isLoadingMore, profile?.institute_id, session?.user.id]);

  const toggleInterest = useCallback(
    async (event: CampusEvent) => {
      const userId = session?.user.id;

      if (!userId || interestPendingIds.has(event.id)) {
        return;
      }

      const nextInterested = !event.isInterested;
      setInterestPendingIds((current) => new Set(current).add(event.id));
      setEvents((current) =>
        current.map((item) =>
          item.id === event.id ? { ...item, isInterested: nextInterested } : item
        )
      );

      try {
        await setEventInterest({
          eventId: event.id,
          isInterested: nextInterested,
          userId,
        });
      } catch (error) {
        console.warn('[events] Could not update interest.', error);
        setEvents((current) =>
          current.map((item) =>
            item.id === event.id ? { ...item, isInterested: event.isInterested } : item
          )
        );
        setErrorMessage(getEventErrorMessage(error));
      } finally {
        setInterestPendingIds((current) => {
          const next = new Set(current);
          next.delete(event.id);
          return next;
        });
      }
    },
    [interestPendingIds, session?.user.id]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Events" />
      <FlatList
        contentContainerStyle={[styles.content, events.length === 0 && styles.emptyContent]}
        data={events}
        keyExtractor={(event) => event.id}
        ListHeaderComponent={
          <>
            <Text style={styles.heading}>What’s happening</Text>
            <Text style={styles.subheading}>Official events across your campus.</Text>
            <View style={styles.filters}>
              {FILTERS.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.value}
                  onPress={() => void loadEvents(item.value)}
                  style={({ pressed }) => [
                    styles.filter,
                    filter === item.value && styles.filterActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errorMessage && events.length > 0 ? (
              <Text accessibilityRole="alert" style={styles.inlineError}>{errorMessage}</Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          status === 'loading' ? (
            <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
          ) : (
            <View style={styles.state}>
              <Text style={styles.stateTitle}>
                {status === 'error' ? "Couldn't load campus events." : 'Nothing happening yet.'}
              </Text>
              <Text style={styles.stateMessage}>
                {status === 'error'
                  ? errorMessage ?? 'Check your connection and try again.'
                  : filter === 'following'
                    ? 'Follow an organization to see its upcoming events here.'
                    : 'New campus events will appear here.'}
              </Text>
              {status === 'error' ? (
                <Pressable accessibilityRole="button" onPress={() => void loadEvents(filter)}>
                  <Text style={styles.retry}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? <ActivityIndicator color={colors.textSecondary} style={styles.loader} /> : null
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            colors={[colors.textPrimary]}
            onRefresh={() => void loadEvents(filter, true)}
            progressBackgroundColor={colors.surfaceElevated}
            refreshing={isRefreshing}
            tintColor={colors.textPrimary}
          />
        }
        renderItem={({ item }) => (
          <EventCard
            event={item}
            interestPending={interestPendingIds.has(item.id)}
            onInterestToggle={toggleInterest}
            onPress={(event) =>
              router.push({ pathname: '/event/[id]', params: { id: event.id } })
            }
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  emptyContent: { flexGrow: 1 },
  heading: { marginTop: spacing.xl, fontSize: 27, fontWeight: '700', color: colors.textPrimary },
  subheading: { marginTop: spacing.xs, fontSize: 14, color: colors.textSecondary },
  filters: { marginVertical: spacing.lg, flexDirection: 'row', gap: spacing.sm },
  filter: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  filterActive: { borderColor: colors.textPrimary, backgroundColor: colors.textPrimary },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterTextActive: { color: colors.white },
  inlineError: { marginBottom: spacing.md, fontSize: 12, color: colors.danger },
  loader: { marginVertical: spacing.xl },
  state: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center', color: colors.textPrimary },
  stateMessage: { maxWidth: 280, marginTop: spacing.sm, fontSize: 14, lineHeight: 21, textAlign: 'center', color: colors.textSecondary },
  retry: { marginTop: spacing.lg, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  pressed: { opacity: 0.55 },
});
