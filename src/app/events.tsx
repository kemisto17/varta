import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../hooks/useTheme';

import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { EventCard } from '../components/events/EventCard';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import {
  getEventErrorMessage,
  getEventsPage,
  setEventInterest,
} from '../lib/events';
import type {
  CampusEvent,
  EventCursor,
  EventFilter,
} from '../types/event';

type EventsStatus =
  | 'loading'
  | 'ready'
  | 'error';

const FILTERS: {
  label: string;
  value: EventFilter;
}[] = [
  {
    label: 'All',
    value: 'all',
  },
  {
    label: 'My Institute',
    value: 'institute',
  },
  {
    label: 'Following',
    value: 'following',
  },
  {
    label: 'Interested',
    value: 'interested',
  },
];

export default function EventsScreen() {
  const { colors, styles } =
    useThemedStyles(
      createStyles
    );

  const router =
    useRouter();

  const { session } =
    useAuth();

  const { profile } =
    useProfile();

  const userId =
    session?.user.id ??
    null;

  const eventsCountRef =
    useRef(0);

  const requestIdRef =
    useRef(0);

  /*
   * Pagination and first-page loading
   * use independent locks.
   *
   * A refresh/filter change invalidates
   * pagination and prevents a stale
   * cursor from being used until the
   * new first page resolves.
   */
  const loadingMoreRef =
    useRef(false);

  const firstPageLoadingRef =
    useRef(false);

  /*
   * Ref is used only inside async
   * handlers. React state below is used
   * when rendering.
   */
  const loadedFilterRef =
    useRef<
      EventFilter | null
    >(null);

  const interestRequestsRef =
    useRef(
      new Set<string>()
    );

  const activeUserIdRef =
    useRef<
      string | null
    >(null);

  const [
    stateUserId,
    setStateUserId,
  ] =
    useState<
      string | null
    >(null);

  const [
    cursor,
    setCursor,
  ] =
    useState<
      EventCursor | null
    >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    events,
    setEvents,
  ] =
    useState<
      CampusEvent[]
    >([]);

  const [
    filter,
    setFilter,
  ] =
    useState<EventFilter>(
      'all'
    );

  /*
   * Render-safe counterpart of
   * loadedFilterRef.
   */
  const [
    loadedFilter,
    setLoadedFilter,
  ] =
    useState<
      EventFilter | null
    >(null);

  const [
    hasMore,
    setHasMore,
  ] =
    useState(false);

  const [
    interestPendingIds,
    setInterestPendingIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set()
    );

  const [
    isLoadingMore,
    setIsLoadingMore,
  ] =
    useState(false);

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    status,
    setStatus,
  ] =
    useState<EventsStatus>(
      'loading'
    );

  /*
   * Events state belongs to the current
   * authenticated account.
   *
   * stateUserId also prevents one render
   * of the previous account's events
   * before this effect gets a chance to
   * clear them.
   */
  useEffect(() => {
    activeUserIdRef.current =
      userId;

    requestIdRef.current +=
      1;

    firstPageLoadingRef.current =
      false;

    loadingMoreRef.current =
      false;

    loadedFilterRef.current =
      null;

    interestRequestsRef.current.clear();

    eventsCountRef.current =
      0;

    setStateUserId(
      userId
    );

    setLoadedFilter(
      null
    );

    setCursor(
      null
    );

    setErrorMessage(
      null
    );

    setEvents(
      []
    );

    setHasMore(
      false
    );

    setInterestPendingIds(
      new Set()
    );

    setIsLoadingMore(
      false
    );

    setIsRefreshing(
      false
    );

    setStatus(
      'loading'
    );
  }, [userId]);

  const loadEvents =
    useCallback(
      async (
        nextFilter:
          EventFilter,

        refresh =
          false
      ) => {
        if (!userId) {
          return;
        }

        /*
         * This first-page request
         * invalidates any pagination
         * operation already in flight.
         */
        const requestId =
          requestIdRef.current +
          1;

        requestIdRef.current =
          requestId;

        firstPageLoadingRef.current =
          true;

        loadingMoreRef.current =
          false;

        setIsLoadingMore(
          false
        );

        setErrorMessage(
          null
        );

        const hasCurrentFilter =
          loadedFilterRef.current ===
          nextFilter;

        if (
          refresh &&
          hasCurrentFilter
        ) {
          setIsRefreshing(
            true
          );
        } else {
          if (
            !hasCurrentFilter
          ) {
            /*
             * Never display results from
             * Filter A underneath the UI
             * for Filter B.
             */
            setEvents(
              []
            );

            setCursor(
              null
            );

            setHasMore(
              false
            );

            eventsCountRef.current =
              0;
          }

          setStatus(
            'loading'
          );
        }

        try {
          const page =
            await getEventsPage(
              {
                filter:
                  nextFilter,

                instituteId:
                  profile
                    ?.institute_id ??
                  null,

                userId,
              }
            );

          if (
            requestIdRef.current !==
              requestId ||
            activeUserIdRef.current !==
              userId
          ) {
            return;
          }

          loadedFilterRef.current =
            nextFilter;

          setLoadedFilter(
            nextFilter
          );

          eventsCountRef.current =
            page.events.length;

          setCursor(
            page.cursor
          );

          setEvents(
            page.events
          );

          setHasMore(
            page.hasMore
          );

          setStatus(
            'ready'
          );
        } catch (error) {
          if (
            requestIdRef.current !==
              requestId ||
            activeUserIdRef.current !==
              userId
          ) {
            return;
          }

          console.warn(
            '[events] Could not load event list.',
            error
          );

          /*
           * Mark this filter as resolved,
           * even though it failed, so the
           * UI can show its error state.
           */
          loadedFilterRef.current =
            nextFilter;

          setLoadedFilter(
            nextFilter
          );

          setErrorMessage(
            'Check your connection and try again.'
          );

          setStatus(
            eventsCountRef.current >
              0
              ? 'ready'
              : 'error'
          );
        } finally {
          if (
            requestIdRef.current ===
              requestId &&
            activeUserIdRef.current ===
              userId
          ) {
            firstPageLoadingRef.current =
              false;

            setIsRefreshing(
              false
            );
          }
        }
      },
      [
        profile?.institute_id,
        userId,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      void loadEvents(
        filter,
        true
      );

      return () => {
        /*
         * Invalidate page requests when
         * leaving this screen.
         */
        requestIdRef.current +=
          1;

        firstPageLoadingRef.current =
          false;

        loadingMoreRef.current =
          false;

        setIsLoadingMore(
          false
        );

        setIsRefreshing(
          false
        );
      };
    }, [
      filter,
      loadEvents,
    ])
  );

  const loadMore =
    useCallback(
      async () => {
        /*
         * loadedFilterRef is safe here
         * because this runs from an event
         * handler rather than during
         * render.
         */
        if (
          !userId ||
          firstPageLoadingRef.current ||
          loadingMoreRef.current ||
          loadedFilterRef.current !==
            filter ||
          !cursor ||
          !hasMore
        ) {
          return;
        }

        loadingMoreRef.current =
          true;

        setIsLoadingMore(
          true
        );

        setErrorMessage(
          null
        );

        const activeRequestId =
          requestIdRef.current;

        const activeCursor =
          cursor;

        const activeFilter =
          filter;

        try {
          const page =
            await getEventsPage(
              {
                filter:
                  activeFilter,

                instituteId:
                  profile
                    ?.institute_id ??
                  null,

                userId,
              },
              activeCursor
            );

          if (
            requestIdRef.current !==
              activeRequestId ||
            activeUserIdRef.current !==
              userId ||
            loadedFilterRef.current !==
              activeFilter
          ) {
            return;
          }

          setCursor(
            page.cursor
          );

          setEvents(
            (
              current
            ) => {
              const existingIds =
                new Set(
                  current.map(
                    (
                      event
                    ) =>
                      event.id
                  )
                );

              const nextEvents =
                [
                  ...current,

                  ...page.events.filter(
                    (
                      event
                    ) =>
                      !existingIds.has(
                        event.id
                      )
                  ),
                ];

              eventsCountRef.current =
                nextEvents.length;

              return nextEvents;
            }
          );

          setHasMore(
            page.hasMore
          );
        } catch (error) {
          if (
            requestIdRef.current !==
              activeRequestId ||
            activeUserIdRef.current !==
              userId ||
            loadedFilterRef.current !==
              activeFilter
          ) {
            return;
          }

          console.warn(
            '[events] Could not load more events.',
            error
          );

          setErrorMessage(
            'We could not load more events. Try again.'
          );
        } finally {
          if (
            requestIdRef.current ===
              activeRequestId &&
            activeUserIdRef.current ===
              userId &&
            loadedFilterRef.current ===
              activeFilter
          ) {
            loadingMoreRef.current =
              false;

            setIsLoadingMore(
              false
            );
          }
        }
      },
      [
        cursor,
        filter,
        hasMore,
        profile?.institute_id,
        userId,
      ]
    );

  const toggleInterest =
    useCallback(
      async (
        event:
          CampusEvent
      ) => {
        if (
          !userId ||
          interestRequestsRef.current.has(
            event.id
          )
        ) {
          return;
        }

        const nextInterested =
          !event.isInterested;

        interestRequestsRef.current.add(
          event.id
        );

        setInterestPendingIds(
          (
            current
          ) =>
            new Set(
              current
            ).add(
              event.id
            )
        );

        setEvents(
          (
            current
          ) =>
            current.map(
              (
                item
              ) =>
                item.id ===
                event.id
                  ? {
                      ...item,

                      interestedCount:
                        Math.max(
                          0,
                          item.interestedCount +
                            (nextInterested
                              ? 1
                              : -1)
                        ),

                      isInterested:
                        nextInterested,
                    }
                  : item
            )
        );

        try {
          await setEventInterest(
            {
              eventId:
                event.id,

              isInterested:
                nextInterested,

              userId,
            }
          );
        } catch (error) {
          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          console.warn(
            '[events] Could not update interest.',
            error
          );

          /*
           * Roll back only if the value
           * is still the optimistic value
           * written by this request.
           */
          setEvents(
            (
              current
            ) =>
              current.map(
                (
                  item
                ) =>
                  item.id ===
                    event.id &&
                  item.isInterested ===
                    nextInterested
                    ? {
                        ...item,

                        interestedCount:
                          event.interestedCount,

                        isInterested:
                          event.isInterested,
                      }
                    : item
              )
          );

          setErrorMessage(
            getEventErrorMessage(
              error
            )
          );
        } finally {
          /*
           * Check the account before
           * touching the shared request
           * lock.
           */
          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          interestRequestsRef.current.delete(
            event.id
          );

          setInterestPendingIds(
            (
              current
            ) => {
              const next =
                new Set(
                  current
                );

              next.delete(
                event.id
              );

              return next;
            }
          );
        }
      },
      [userId]
    );

  /*
   * Render uses React state only.
   * Refs remain reserved for async
   * coordination.
   */
  const isCurrentUserState =
    stateUserId ===
    userId;

  const isCurrentFilterState =
    loadedFilter ===
    filter;

  const displayedEvents =
    isCurrentUserState &&
    isCurrentFilterState
      ? events
      : [];

  const displayedErrorMessage =
    isCurrentUserState
      ? errorMessage
      : null;

  const displayedStatus:
    EventsStatus =
      !isCurrentUserState ||
      !isCurrentFilterState
        ? 'loading'
        : status;

  return (
    <SafeAreaScreen
      style={
        styles.safeArea
      }
    >
      <ScreenHeader
        title="Events"
      />

      <FlatList
        contentContainerStyle={[
          styles.content,

          displayedEvents.length ===
            0 &&
            styles.emptyContent,
        ]}
        data={
          displayedEvents
        }
        keyExtractor={(
          event
        ) =>
          event.id
        }
        ListHeaderComponent={
          <>
            <Text
              style={
                styles.heading
              }
            >
              What’s happening
            </Text>

            <Text
              style={
                styles.subheading
              }
            >
              Official events across your campus.
            </Text>

            <ScrollView
              contentContainerStyle={
                styles.filters
              }
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
            >
              {FILTERS.map(
                (
                  item
                ) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      selected:
                        filter ===
                        item.value,
                    }}
                    key={
                      item.value
                    }
                    onPress={() =>
                      setFilter(
                        item.value
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.filter,

                      filter ===
                        item.value &&
                        styles.filterActive,

                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,

                        filter ===
                          item.value &&
                          styles.filterTextActive,
                      ]}
                    >
                      {
                        item.label
                      }
                    </Text>
                  </Pressable>
                )
              )}
            </ScrollView>

            {displayedErrorMessage &&
            displayedEvents.length >
              0 ? (
              <Text
                accessibilityRole="alert"
                style={
                  styles.inlineError
                }
              >
                {
                  displayedErrorMessage
                }
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          displayedStatus ===
          'loading' ? (
            <ActivityIndicator
              color={
                colors.textSecondary
              }
              style={
                styles.loader
              }
            />
          ) : (
            <View
              style={
                styles.state
              }
            >
              <Text
                style={
                  styles.stateTitle
                }
              >
                {displayedStatus ===
                'error'
                  ? "Couldn't load campus events."
                  : filter ===
                      'interested'
                    ? 'No interested events yet.'
                    : 'Nothing happening yet.'}
              </Text>

              <Text
                style={
                  styles.stateMessage
                }
              >
                {displayedStatus ===
                'error'
                  ? displayedErrorMessage ??
                    'Check your connection and try again.'
                  : filter ===
                      'following'
                    ? 'Follow an organization to see its upcoming events here.'
                    : filter ===
                        'interested'
                      ? 'Events you mark Interested will appear here.'
                    : 'New campus events will appear here.'}
              </Text>

              {displayedStatus ===
              'error' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void loadEvents(
                      filter
                    )
                  }
                >
                  <Text
                    style={
                      styles.retry
                    }
                  >
                    Try again
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          isCurrentUserState &&
          isCurrentFilterState &&
          isLoadingMore ? (
            <ActivityIndicator
              color={
                colors.textSecondary
              }
              style={
                styles.loader
              }
            />
          ) : null
        }
        onEndReached={() =>
          void loadMore()
        }
        onEndReachedThreshold={
          0.4
        }
        refreshControl={
          <RefreshControl
            colors={[
              colors.textPrimary,
            ]}
            onRefresh={() =>
              void loadEvents(
                filter,
                true
              )
            }
            progressBackgroundColor={
              colors.surfaceElevated
            }
            refreshing={
              isCurrentUserState &&
              isCurrentFilterState &&
              isRefreshing
            }
            tintColor={
              colors.textPrimary
            }
          />
        }
        renderItem={({
          item,
        }) => (
          <EventCard
            event={
              item
            }
            interestPending={
              interestPendingIds.has(
                item.id
              )
            }
            onInterestToggle={
              toggleInterest
            }
            onPress={(
              event
            ) =>
              router.push({
                pathname:
                  '/event/[id]',

                params: {
                  id:
                    event.id,
                },
              })
            }
          />
        )}
        showsVerticalScrollIndicator={
          false
        }
      />
    </SafeAreaScreen>
  );
}

const createStyles = (
  colors:
    ThemeColors
) =>
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal:
        spacing.lg,

      paddingBottom:
        spacing.xxl,
    },

    emptyContent: {
      flexGrow:
        1,
    },

    heading: {
      marginTop:
        spacing.xl,

      fontSize:
        27,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    subheading: {
      marginTop:
        spacing.xs,

      fontSize:
        14,

      color:
        colors.textSecondary,
    },

    filters: {
      marginVertical:
        spacing.lg,

      flexDirection:
        'row',

      gap:
        spacing.sm,
    },

    filter: {
      minHeight:
        38,

      paddingHorizontal:
        spacing.md,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        radius.full,

      backgroundColor:
        colors.surface,
    },

    filterActive: {
      borderColor:
        colors.textPrimary,

      backgroundColor:
        colors.textPrimary,
    },

    filterText: {
      fontSize:
        12,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    filterTextActive: {
      color:
        colors.white,
    },

    inlineError: {
      marginBottom:
        spacing.md,

      fontSize:
        12,

      color:
        colors.danger,
    },

    loader: {
      marginVertical:
        spacing.xl,
    },

    state: {
      flex:
        1,

      minHeight:
        300,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    stateTitle: {
      fontSize:
        19,

      fontWeight:
        '700',

      textAlign:
        'center',

      color:
        colors.textPrimary,
    },

    stateMessage: {
      maxWidth:
        280,

      marginTop:
        spacing.sm,

      fontSize:
        14,

      lineHeight:
        21,

      textAlign:
        'center',

      color:
        colors.textSecondary,
    },

    retry: {
      marginTop:
        spacing.lg,

      fontSize:
        13,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    pressed: {
      opacity:
        0.55,
    },
  });
