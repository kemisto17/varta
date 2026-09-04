import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '../../components/Avatar';
import { CampusNowSection } from '../../components/campus-now/CampusNowSection';
import { FeedItemRenderer } from '../../components/feed/FeedItemRenderer';
import { BlockUserSheet } from '../../components/moderation/BlockUserSheet';
import { ReportSheet } from '../../components/moderation/ReportSheet';
import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import {
  radius,
  spacing,
  type ThemeColors,
} from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useFeed } from '../../hooks/useFeed';
import { useNotifications } from '../../hooks/useNotifications';
import { useProfile } from '../../hooks/useProfile';
import { useThemedStyles } from '../../hooks/useTheme';
import { getAvatarUrl } from '../../lib/avatars';
import {
  getCampusNowEvents,
  getEventErrorMessage,
  setEventInterest,
} from '../../lib/events';
import type {
  ModerationUser,
  ReportTarget,
} from '../../lib/moderation';
import { getMentionedProfileId } from '../../lib/mentions';
import {
  getInteractionErrorMessage,
  setPostLike,
} from '../../lib/postInteractions';
import {
  deletePost,
  getPostErrorMessage,
} from '../../lib/posts';
import type { CampusEvent } from '../../types/event';
import type { FeedPost } from '../../types/post';

const AUTO_REFRESH_INTERVAL_MS =
  2 * 60 * 1000;

export default function HomeScreen() {
  const { colors, styles } =
    useThemedStyles(createStyles);

  const router = useRouter();

  const { session } =
    useAuth();

  const { profile } =
    useProfile();

  const { unreadCount } =
    useNotifications();

  const {
    errorMessage,
    feedMode,
    hasMore,
    items: homeFeedItems,
    isLoadingMore,
    isRefreshing,
    loadMore,
    refreshFeed,
    removePost,
    setFeedMode,
    status,
    updatePostLike,
  } = useFeed();

  const likeRequestsRef =
    useRef(
      new Set<string>()
    );

  const deletePostRequestsRef =
    useRef(
      new Set<string>()
    );

  const eventInterestRequestsRef =
    useRef(
      new Set<string>()
    );

  const campusNowRequestIdRef =
    useRef(0);

  const activeUserIdRef =
    useRef<string | null>(
      null
    );

  const [
    stateUserId,
    setStateUserId,
  ] =
    useState<
      string | null
    >(null);

  const campusNowLoadedRef =
    useRef(false);

  const lastFeedRefreshAtRef =
    useRef(0);

  const lastCampusNowRefreshAtRef =
    useRef(0);

  const [
    campusNowError,
    setCampusNowError,
  ] =
    useState<
      string | null
    >(null);

  const [
    campusNowEvents,
    setCampusNowEvents,
  ] =
    useState<
      CampusEvent[]
    >([]);

  const [
    campusNowLoading,
    setCampusNowLoading,
  ] =
    useState(true);

  const [
    blockTarget,
    setBlockTarget,
  ] =
    useState<
      ModerationUser | null
    >(null);

  const [
    deletingPostIds,
    setDeletingPostIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set()
    );

  const [
    interactionError,
    setInteractionError,
  ] =
    useState<
      string | null
    >(null);

  const [
    likePendingIds,
    setLikePendingIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set()
    );

  const [
    eventInterestPendingIds,
    setEventInterestPendingIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set()
    );

  const [
    profileAvatarUrl,
    setProfileAvatarUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    reportTarget,
    setReportTarget,
  ] =
    useState<
      ReportTarget | null
    >(null);

  /*
   * Any cached Home data belongs
   * to the currently authenticated
   * user.
   */
  useEffect(() => {
    activeUserIdRef.current =
      session?.user.id ?? null;

    setStateUserId(
      session?.user.id ?? null
    );

    campusNowRequestIdRef.current +=
      1;

    likeRequestsRef.current.clear();
    deletePostRequestsRef.current.clear();
    eventInterestRequestsRef.current.clear();

    campusNowLoadedRef.current =
      false;

    lastFeedRefreshAtRef.current =
      0;

    lastCampusNowRefreshAtRef.current =
      0;

    setCampusNowEvents(
      []
    );

    setCampusNowError(
      null
    );

    setCampusNowLoading(
      true
    );

    setEventInterestPendingIds(
      new Set()
    );

    setDeletingPostIds(
      new Set()
    );

    setLikePendingIds(
      new Set()
    );

    setInteractionError(
      null
    );

    setBlockTarget(
      null
    );

    setReportTarget(
      null
    );
  }, [session?.user.id]);

  /*
   * Resolve the current profile
   * avatar independently from the
   * raw ProfileContext DB row.
   */
  useEffect(() => {
    let isActive = true;

    const avatarPath =
      profile?.avatar_path;

    if (!avatarPath) {
      setProfileAvatarUrl(
        null
      );

      return () => {
        isActive =
          false;
      };
    }

    void getAvatarUrl(
      avatarPath
    )
      .then((url) => {
        if (isActive) {
          setProfileAvatarUrl(
            url
          );
        }
      })
      .catch(() => {
        if (isActive) {
          setProfileAvatarUrl(
            null
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [profile?.avatar_path]);

  const refreshCampusNow =
    useCallback(
      async () => {
        const userId =
          session?.user.id;

        if (!userId) {
          return;
        }

        const requestId =
          campusNowRequestIdRef.current +
          1;

        campusNowRequestIdRef.current =
          requestId;

        setCampusNowError(
          null
        );

        if (
          !campusNowLoadedRef.current
        ) {
          setCampusNowLoading(
            true
          );
        }

        try {
          const nextEvents =
            await getCampusNowEvents(
              userId
            );

          if (
            campusNowRequestIdRef.current !==
              requestId ||
            activeUserIdRef.current !==
              userId
          ) {
            return;
          }

          setCampusNowEvents(
            nextEvents
          );

          lastCampusNowRefreshAtRef.current =
            Date.now();
        } catch (error) {
          if (
            campusNowRequestIdRef.current !==
              requestId ||
            activeUserIdRef.current !==
              userId
          ) {
            return;
          }

          console.warn(
            '[campus-now] Could not load campus events.',
            error
          );

          setCampusNowError(
            'Check your connection and try again.'
          );
        } finally {
          if (
            campusNowRequestIdRef.current ===
              requestId &&
            activeUserIdRef.current ===
              userId
          ) {
            campusNowLoadedRef.current =
              true;

            setCampusNowLoading(
              false
            );
          }
        }
      },
      [session?.user.id]
    );

  /*
   * Returning to Home should not
   * automatically download the same
   * feed and events again.
   *
   * Refresh when:
   * - the screen has never loaded,
   * - cached data is older than the
   *   automatic refresh interval.
   *
   * Pull-to-refresh still always
   * performs an explicit refresh.
   */
  useFocusEffect(
    useCallback(() => {
      const now =
        Date.now();

      const shouldRefreshFeed =
        status ===
          'idle' ||
        now -
          lastFeedRefreshAtRef.current >=
          AUTO_REFRESH_INTERVAL_MS;

      const shouldRefreshCampusNow =
        !campusNowLoadedRef.current ||
        now -
          lastCampusNowRefreshAtRef.current >=
          AUTO_REFRESH_INTERVAL_MS;

      if (
        shouldRefreshFeed
      ) {
        /*
         * Set this immediately to
         * prevent repeated focus
         * callbacks from launching
         * duplicate requests.
         */
        lastFeedRefreshAtRef.current =
          now;

        void refreshFeed();
      }

      if (
        shouldRefreshCampusNow
      ) {
        void refreshCampusNow();
      }

    }, [
      refreshCampusNow,
      refreshFeed,
      status,
    ])
  );

  const handleRefresh =
    useCallback(() => {
      const now =
        Date.now();

      lastFeedRefreshAtRef.current =
        now;

      lastCampusNowRefreshAtRef.current =
        now;

      void Promise.all([
        refreshFeed(true),
        refreshCampusNow(),
      ]);
    }, [
      refreshCampusNow,
      refreshFeed,
    ]);

  const handleToggleEventInterest =
    useCallback(
      async (
        event: CampusEvent
      ) => {
        const userId =
          session?.user.id;

        if (
          !userId ||
          eventInterestRequestsRef.current.has(
            event.id
          )
        ) {
          return;
        }

        const nextInterested =
          !event.isInterested;

        eventInterestRequestsRef.current.add(
          event.id
        );

        setEventInterestPendingIds(
          (current) =>
            new Set(
              current
            ).add(
              event.id
            )
        );

        setCampusNowEvents(
          (current) =>
            current.map(
              (item) =>
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
            '[campus-now] Could not update event interest.',
            error
          );

          setCampusNowEvents(
            (current) =>
              current.map(
                (item) =>
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

          setCampusNowError(
            getEventErrorMessage(
              error
            )
          );
        } finally {
          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          eventInterestRequestsRef.current.delete(
            event.id
          );

          setEventInterestPendingIds(
            (current) => {
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
      [
        session?.user.id,
      ]
    );

  const handleDeletePost =
    useCallback(
      async (
        post: FeedPost
      ) => {
        const userId =
          session?.user.id;

        if (
          !userId ||
          deletePostRequestsRef.current.has(
            post.id
          )
        ) {
          return;
        }

        deletePostRequestsRef.current.add(
          post.id
        );

        setDeletingPostIds(
          (current) =>
            new Set(
              current
            ).add(
              post.id
            )
        );

        try {
          const result =
            await deletePost(
              post,
              userId
            );

          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          removePost(
            post.id
          );

          if (
            result.mediaCleanupFailed
          ) {
            Alert.alert(
              'Post deleted',
              'The post is gone, but its photo could not be cleaned up automatically.'
            );
          }
        } catch (error) {
          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          Alert.alert(
            'Could not delete post',
            getPostErrorMessage(
              error
            )
          );
        } finally {
          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          deletePostRequestsRef.current.delete(
            post.id
          );

          setDeletingPostIds(
            (current) => {
              const next =
                new Set(
                  current
                );

              next.delete(
                post.id
              );

              return next;
            }
          );
        }
      },
      [
        removePost,
        session?.user.id,
      ]
    );

  const handleToggleLike =
    useCallback(
      async (
        post: FeedPost
      ) => {
        const userId =
          session?.user.id;

        if (
          !userId ||
          likeRequestsRef.current.has(
            post.id
          )
        ) {
          return;
        }

        const nextIsLiked =
          !post.isLikedByCurrentUser;

        const nextLikeCount =
          Math.max(
            0,
            post.likeCount +
              (
                nextIsLiked
                  ? 1
                  : -1
              )
          );

        likeRequestsRef.current.add(
          post.id
        );

        setLikePendingIds(
          (current) =>
            new Set(
              current
            ).add(
              post.id
            )
        );

        setInteractionError(
          null
        );

        updatePostLike(
          post.id,
          {
            isLikedByCurrentUser:
              nextIsLiked,

            likeCount:
              nextLikeCount,
          }
        );

        try {
          await setPostLike(
            {
              isLiked:
                nextIsLiked,

              postId:
                post.id,

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
            '[feed] Could not update post like.',
            error
          );

          updatePostLike(
            post.id,
            {
              isLikedByCurrentUser:
                post.isLikedByCurrentUser,

              likeCount:
                post.likeCount,
            }
          );

          setInteractionError(
            getInteractionErrorMessage(
              error
            )
          );
        } finally {
          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          likeRequestsRef.current.delete(
            post.id
          );

          setLikePendingIds(
            (current) => {
              const next =
                new Set(
                  current
                );

              next.delete(
                post.id
              );

              return next;
            }
          );
        }
      },
      [
        session?.user.id,
        updatePostLike,
      ]
    );

  const openPost =
    useCallback(
      (
        post: FeedPost
      ) => {
        router.push({
          pathname:
            '/post/[id]',
          params: {
            id:
              post.id,
          },
        });
      },
      [router]
    );

  const openAuthor =
    useCallback(
      (
        post: FeedPost
      ) => {
        if (
          post.author.kind ===
          'organization'
        ) {
          router.push({
            pathname:
              '/organization/[id]',

            params: {
              id:
                post.author.id,
            },
          });

          return;
        }

        if (
          !post.authorId
        ) {
          return;
        }

        if (
          post.authorId ===
          session?.user.id
        ) {
          router.navigate(
            '/(tabs)/profile'
          );

          return;
        }

        router.push({
          pathname:
            '/user/[id]',

          params: {
            id:
              post.authorId,
          },
        });
      },
      [
        router,
        session?.user.id,
      ]
    );

  const openMention =
    useCallback(
      async (
        username: string
      ) => {
        try {
          const profileId =
            await getMentionedProfileId(
              username
            );

          if (!profileId) {
            return;
          }

          if (
            profileId ===
            session?.user.id
          ) {
            router.navigate(
              '/(tabs)/profile'
            );

            return;
          }

          router.push({
            pathname:
              '/user/[id]',
            params: {
              id:
                profileId,
            },
          });
        } catch (error) {
          console.warn(
            '[mentions] Could not open mentioned profile.',
            error
          );
        }
      },
      [
        router,
        session?.user.id,
      ]
    );

  const isInitialLoading =
    status === 'idle' ||
    status === 'loading';

  const currentUserId =
    session?.user.id ?? null;

  const isCurrentUserState =
    stateUserId ===
    currentUserId;

  const displayedCampusNowEvents =
    isCurrentUserState
      ? campusNowEvents
      : [];

  const displayedCampusNowError =
    isCurrentUserState
      ? campusNowError
      : null;

  const displayedCampusNowLoading =
    isCurrentUserState
      ? campusNowLoading
      : true;

  const displayedEventInterestPendingIds =
    isCurrentUserState
      ? eventInterestPendingIds
      : new Set<string>();

  const displayedDeletingPostIds =
    isCurrentUserState
      ? deletingPostIds
      : new Set<string>();

  const displayedLikePendingIds =
    isCurrentUserState
      ? likePendingIds
      : new Set<string>();

  const displayedInteractionError =
    isCurrentUserState
      ? interactionError
      : null;

  const displayedReportTarget =
    isCurrentUserState
      ? reportTarget
      : null;

  const displayedBlockTarget =
    isCurrentUserState
      ? blockTarget
      : null;

  const isSelectedFeedInitialLoading =
    isInitialLoading;

  const isSelectedFeedLoadingMore =
    isLoadingMore;

  const selectedFeedHasMore =
    hasMore;

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  return (
    <SafeAreaScreen
      style={
        styles.safeArea
      }
      withinTabNavigator
    >
      <FlatList
        contentContainerStyle={
          styles.content
        }
        data={homeFeedItems}
        keyExtractor={(
          item
        ) => item.feedKey}
        ListEmptyComponent={
          isSelectedFeedInitialLoading ? (
            <FeedSkeleton />
          ) : status ===
            'error' ? (
            <FeedState
              actionLabel="Try again"
              message={
                errorMessage ??
                'The campus feed is unavailable right now.'
              }
              onAction={() =>
                void refreshFeed()
              }
              title="Could not load posts"
            />
          ) : (
            <FeedState
              actionLabel="Create the first post"
              message="Start a useful conversation with students across your university."
              onAction={() =>
                router.navigate(
                  '/(tabs)/create'
                )
              }
              title="Your campus feed is quiet"
            />
          )
        }
        ListFooterComponent={
          isSelectedFeedLoadingMore ? (
            <ActivityIndicator
              color={
                colors.textSecondary
              }
              style={
                styles.footerLoader
              }
            />
          ) : homeFeedItems.length >
              0 &&
            !selectedFeedHasMore ? (
            <View
              style={
                styles.footerSpace
              }
            />
          ) : null
        }
        ListHeaderComponent={
          <>
            <View
              style={
                styles.header
              }
            >
              <View
                style={
                  styles.headerCopy
                }
              >
                <Text
                  style={
                    styles.brand
                  }
                >
                  VĀRTĀ
                </Text>

                <Text
                  style={
                    styles.greeting
                  }
                >
                  {getGreeting()}
                </Text>
              </View>

              <View
                style={
                  styles.headerActions
                }
              >
                <Pressable
                  accessibilityLabel={
                    unreadCount >
                    0
                      ? `Notifications, ${unreadCount} unread`
                      : 'Notifications'
                  }
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      '/notifications'
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.notificationButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={{
                      android:
                        'notifications_none',

                      ios:
                        unreadCount >
                        0
                          ? 'bell.fill'
                          : 'bell',

                      web:
                        'notifications_none',
                    }}
                    size={22}
                    tintColor={
                      colors.textPrimary
                    }
                  />

                  {unreadCount >
                  0 ? (
                    <View
                      style={
                        styles.unreadBadge
                      }
                    >
                      <Text
                        style={
                          styles.unreadBadgeText
                        }
                      >
                        {unreadCount >
                        9
                          ? '9+'
                          : unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>

                <Avatar
                  fullName={
                    profile?.full_name ??
                    'Student'
                  }
                  uri={
                    profileAvatarUrl
                  }
                  verified={
                    profile?.is_verified
                  }
                />
              </View>
            </View>

            <CampusNowSection
              errorMessage={
                displayedCampusNowError
              }
              events={
                displayedCampusNowEvents
              }
              interestPendingIds={
                displayedEventInterestPendingIds
              }
              isLoading={
                displayedCampusNowLoading
              }
              onEventPress={(
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
              onInterestToggle={
                handleToggleEventInterest
              }
              onRetry={() =>
                void refreshCampusNow()
              }
              onSeeAll={() =>
                router.push(
                  '/events'
                )
              }
            />

            <View
              style={
                styles.feedHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Campus feed
              </Text>

              <View style={styles.feedFilters}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: feedMode === 'campus' }}
                  onPress={() => setFeedMode('campus')}
                  style={({ pressed }) => [
                    styles.feedFilter,
                    feedMode === 'campus' && styles.feedFilterActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.feedFilterText,
                      feedMode === 'campus' && styles.feedFilterTextActive,
                    ]}
                  >
                    Campus
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: feedMode === 'latest' }}
                  onPress={() => setFeedMode('latest')}
                  style={({ pressed }) => [
                    styles.feedFilter,
                    feedMode === 'latest' && styles.feedFilterActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.feedFilterText,
                      feedMode === 'latest' &&
                        styles.feedFilterTextActive,
                    ]}
                  >
                    Latest
                  </Text>
                </Pressable>
              </View>
            </View>

            {errorMessage &&
            homeFeedItems.length >
              0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void refreshFeed()
                }
                style={({
                  pressed,
                }) => [
                  styles.inlineError,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.inlineErrorText
                  }
                >
                  {
                    errorMessage
                  }
                </Text>

                <Text
                  style={
                    styles.inlineErrorAction
                  }
                >
                  Retry
                </Text>
              </Pressable>
            ) : null}

            {displayedInteractionError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setInteractionError(
                    null
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.inlineError,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.inlineErrorText
                  }
                >
                  {
                    displayedInteractionError
                  }
                </Text>

                <Text
                  style={
                    styles.inlineErrorAction
                  }
                >
                  Dismiss
                </Text>
              </Pressable>
            ) : null}
          </>
        }
        onEndReached={
          handleLoadMore
        }
        onEndReachedThreshold={
          0.35
        }
        refreshControl={
          <RefreshControl
            colors={[
              colors.textPrimary,
            ]}
            onRefresh={
              handleRefresh
            }
            progressBackgroundColor={
              colors.surfaceElevated
            }
            refreshing={
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
          <FeedItemRenderer
            currentUserId={
              session?.user.id ??
              null
            }
            deletingPostIds={
              displayedDeletingPostIds
            }
            eventInterestPendingIds={
              displayedEventInterestPendingIds
            }
            item={item}
            likePendingIds={
              displayedLikePendingIds
            }
            onAuthorPress={
              openAuthor
            }
            onBlockUser={
              setBlockTarget
            }
            onDeletePost={
              handleDeletePost
            }
            onEditPost={(post) =>
              router.push({
                pathname:
                  '/post/[id]/edit',
                params: {
                  id: post.id,
                },
              })
            }
            onEventPress={(event) =>
              router.push({
                pathname:
                  '/event/[id]',
                params: {
                  id:
                    event.id,
                },
              })
            }
            onLostFoundPress={(id) =>
              router.push({
                pathname:
                  '/lost-found/[id]',
                params: {
                  id,
                },
              })
            }
            onMentionPress={
              openMention
            }
            onOpenPost={
              openPost
            }
            onReport={
              setReportTarget
            }
            onToggleEventInterest={
              handleToggleEventInterest
            }
            onTogglePostLike={
              handleToggleLike
            }
          />
        )}
        showsVerticalScrollIndicator={
          false
        }
      />

      <ReportSheet
        onClose={() =>
          setReportTarget(
            null
          )
        }
        reporterId={
          session?.user.id ??
          null
        }
        target={
          displayedReportTarget
        }
      />

      <BlockUserSheet
        currentUserId={
          session?.user.id ??
          null
        }
        onChanged={() =>
          void refreshFeed()
        }
        onClose={() =>
          setBlockTarget(
            null
          )
        }
        user={
          displayedBlockTarget
        }
      />
    </SafeAreaScreen>
  );
}

type FeedStateProps = {
  actionLabel: string;
  message: string;
  onAction: () => void;
  title: string;
};

function FeedState({
  actionLabel,
  message,
  onAction,
  title,
}: FeedStateProps) {
  const { styles } =
    useThemedStyles(
      createStyles
    );

  return (
    <View
      style={
        styles.stateCard
      }
    >
      <Text
        style={
          styles.stateTitle
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.stateMessage
        }
      >
        {message}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({
          pressed,
        }) => [
          styles.stateButton,
          pressed &&
            styles.pressed,
        ]}
      >
        <Text
          style={
            styles.stateButtonText
          }
        >
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function FeedSkeleton() {
  const { styles } =
    useThemedStyles(
      createStyles
    );

  return (
    <View
      accessibilityLabel="Loading campus posts"
      style={
        styles.skeletonList
      }
    >
      {[0, 1, 2].map(
        (item) => (
          <View
            key={item}
            style={
              styles.skeletonCard
            }
          >
            <View
              style={
                styles.skeletonHeader
              }
            >
              <View
                style={[
                  styles.skeletonBlock,
                  styles.skeletonAvatar,
                ]}
              />

              <View
                style={
                  styles.skeletonIdentity
                }
              >
                <View
                  style={[
                    styles.skeletonBlock,
                    styles.skeletonName,
                  ]}
                />

                <View
                  style={[
                    styles.skeletonBlock,
                    styles.skeletonMeta,
                  ]}
                />
              </View>
            </View>

            <View
              style={[
                styles.skeletonBlock,
                styles.skeletonLine,
              ]}
            />

            <View
              style={[
                styles.skeletonBlock,
                styles.skeletonShortLine,
              ]}
            />
          </View>
        )
      )}
    </View>
  );
}

function getGreeting() {
  const hour =
    new Date().getHours();

  if (hour < 12) {
    return 'Good morning.';
  }

  if (hour < 17) {
    return 'Good afternoon.';
  }

  return 'Good evening.';
}

const createStyles = (
  colors: ThemeColors
) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal:
        spacing.lg,
      paddingBottom:
        spacing.xxl,
    },

    header: {
      marginTop:
        spacing.md,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    headerCopy: {
      flex: 1,
    },

    headerActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: spacing.sm,
    },

    notificationButton: {
      width: 44,
      height: 44,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    unreadBadge: {
      position:
        'absolute',
      top: 2,
      right: 0,
      minWidth: 17,
      height: 17,
      paddingHorizontal:
        4,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 2,
      borderColor:
        colors.background,
      borderRadius: 9,
      backgroundColor:
        colors.textPrimary,
    },

    unreadBadgeText: {
      fontSize: 8,
      fontWeight: '700',
      color:
        colors.white,
    },

    brand: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing:
        2.2,
      color:
        colors.textSecondary,
    },

    greeting: {
      marginTop: 3,
      fontSize: 28,
      fontWeight: '700',
      color:
        colors.textPrimary,
    },

    feedHeader: {
      marginTop:
        spacing.xxl,
      marginBottom:
        spacing.sm,
    },

    sectionEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing:
        1.25,
      color:
        colors.textMuted,
    },

    sectionTitle: {
      fontSize: 21,
      fontWeight: '700',
      color:
        colors.textPrimary,
    },

    feedFilters: {
      marginTop:
        spacing.md,
      flexDirection:
        'row',
      gap:
        spacing.sm,
    },

    feedFilter: {
      minHeight: 36,
      paddingHorizontal:
        spacing.md,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        colors.borderSubtle,
      borderRadius:
        radius.full,
      backgroundColor:
        colors.surface,
    },

    feedFilterActive: {
      borderColor:
        colors.textPrimary,
      backgroundColor:
        colors.textPrimary,
    },

    feedFilterText: {
      fontSize: 12,
      fontWeight: '700',
      color:
        colors.textSecondary,
    },

    feedFilterTextActive: {
      color:
        colors.white,
    },

    inlineError: {
      marginBottom:
        spacing.sm,
      paddingVertical:
        spacing.sm,
      paddingHorizontal:
        spacing.md,
      borderRadius:
        radius.md,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      backgroundColor:
        colors.dangerSoft,
    },

    inlineErrorText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color:
        colors.danger,
    },

    inlineErrorAction: {
      marginLeft:
        spacing.md,
      fontSize: 12,
      fontWeight: '700',
      color:
        colors.danger,
    },

    stateCard: {
      minHeight: 220,
      paddingVertical:
        spacing.xxl,
      alignItems:
        'flex-start',
      justifyContent:
        'center',
      borderTopWidth: 1,
      borderTopColor:
        colors.borderSubtle,
    },

    stateTitle: {
      fontSize: 19,
      fontWeight: '700',
      color:
        colors.textPrimary,
    },

    stateMessage: {
      maxWidth: 300,
      marginTop:
        spacing.sm,
      fontSize: 14,
      lineHeight: 21,
      color:
        colors.textSecondary,
    },

    stateButton: {
      minHeight: 44,
      marginTop:
        spacing.lg,
      paddingHorizontal:
        spacing.md,
      borderRadius:
        radius.full,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.textPrimary,
    },

    stateButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color:
        colors.white,
    },

    skeletonList: {
      borderTopWidth: 1,
      borderTopColor:
        colors.borderSubtle,
    },

    skeletonCard: {
      paddingVertical:
        spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.borderSubtle,
    },

    skeletonHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    skeletonBlock: {
      borderRadius:
        radius.sm,
      backgroundColor:
        colors.border,
    },

    skeletonAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },

    skeletonIdentity: {
      marginLeft:
        spacing.md,
      gap: spacing.sm,
    },

    skeletonName: {
      width: 132,
      height: 11,
    },

    skeletonMeta: {
      width: 190,
      height: 9,
    },

    skeletonLine: {
      width: '92%',
      height: 12,
      marginTop:
        spacing.lg,
    },

    skeletonShortLine:
      {
        width: '64%',
        height: 12,
        marginTop:
          spacing.sm,
      },

    footerLoader: {
      marginVertical:
        spacing.lg,
    },

    footerSpace: {
      height: spacing.lg,
    },

    pressed: {
      opacity: 0.62,
    },
  });
