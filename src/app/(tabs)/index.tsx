import { useThemedStyles } from '../../hooks/useTheme';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import { CampusNowSection } from '../../components/campus-now/CampusNowSection';
import { PostCard } from '../../components/PostCard';
import { BlockUserSheet } from '../../components/moderation/BlockUserSheet';
import { ReportSheet } from '../../components/moderation/ReportSheet';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useFeed } from '../../hooks/useFeed';
import { useNotifications } from '../../hooks/useNotifications';
import { useProfile } from '../../hooks/useProfile';
import { getAvatarUrl } from '../../lib/avatars';
import {
  getCampusNowEvents,
  getEventErrorMessage,
  setEventInterest,
} from '../../lib/events';
import type { ModerationUser, ReportTarget } from '../../lib/moderation';
import { deletePost, getPostErrorMessage } from '../../lib/posts';
import {
  getInteractionErrorMessage,
  setPostLike,
} from '../../lib/postInteractions';
import type { FeedPost } from '../../types/post';
import type { CampusEvent } from '../../types/event';

export default function HomeScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const { unreadCount } = useNotifications();
  const {
    errorMessage,
    hasMore,
    isLoadingMore,
    isRefreshing,
    loadMore,
    posts,
    refreshFeed,
    removePost,
    status,
    updatePostLike,
  } = useFeed();
  const likeRequestsRef = useRef(new Set<string>());
  const [campusNowError, setCampusNowError] = useState<string | null>(null);
  const [campusNowEvents, setCampusNowEvents] = useState<CampusEvent[]>([]);
  const [campusNowLoading, setCampusNowLoading] = useState(true);
  const [blockTarget, setBlockTarget] = useState<ModerationUser | null>(null);
  const [deletingPostIds, setDeletingPostIds] = useState<Set<string>>(
    () => new Set()
  );
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [likePendingIds, setLikePendingIds] = useState<Set<string>>(
    () => new Set()
  );
  const [eventInterestPendingIds, setEventInterestPendingIds] = useState<
    Set<string>
  >(() => new Set());
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    let isActive = true;
    const avatarPath = profile?.avatar_path;

    if (!avatarPath) {
      setProfileAvatarUrl(null);
      return () => {
        isActive = false;
      };
    }

    void getAvatarUrl(avatarPath)
      .then((url) => {
        if (isActive) {
          setProfileAvatarUrl(url);
        }
      })
      .catch(() => {
        if (isActive) {
          setProfileAvatarUrl(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [profile?.avatar_path]);

  const refreshCampusNow = useCallback(async () => {
    const userId = session?.user.id;

    if (!userId) {
      return;
    }

    setCampusNowError(null);
    setCampusNowLoading(true);

    try {
      setCampusNowEvents(await getCampusNowEvents(userId));
    } catch (error) {
      console.warn('[campus-now] Could not load campus events.', error);
      setCampusNowError('Check your connection and try again.');
    } finally {
      setCampusNowLoading(false);
    }
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([refreshFeed(), refreshCampusNow()]);
    }, [refreshCampusNow, refreshFeed])
  );

  const handleToggleEventInterest = useCallback(
    async (event: CampusEvent) => {
      const userId = session?.user.id;

      if (!userId || eventInterestPendingIds.has(event.id)) {
        return;
      }

      const nextInterested = !event.isInterested;
      setEventInterestPendingIds((current) => new Set(current).add(event.id));
      setCampusNowEvents((current) =>
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
        console.warn('[campus-now] Could not update event interest.', error);
        setCampusNowEvents((current) =>
          current.map((item) =>
            item.id === event.id
              ? { ...item, isInterested: event.isInterested }
              : item
          )
        );
        setCampusNowError(getEventErrorMessage(error));
      } finally {
        setEventInterestPendingIds((current) => {
          const next = new Set(current);
          next.delete(event.id);
          return next;
        });
      }
    },
    [eventInterestPendingIds, session?.user.id]
  );

  const handleDeletePost = useCallback(
    async (post: FeedPost) => {
      const userId = session?.user.id;

      if (!userId || deletingPostIds.has(post.id)) {
        return;
      }

      setDeletingPostIds((current) => new Set(current).add(post.id));

      try {
        const result = await deletePost(post, userId);
        removePost(post.id);

        if (result.mediaCleanupFailed) {
          Alert.alert(
            'Post deleted',
            'The post is gone, but its photo could not be cleaned up automatically.'
          );
        }
      } catch (error) {
        Alert.alert('Could not delete post', getPostErrorMessage(error));
      } finally {
        setDeletingPostIds((current) => {
          const next = new Set(current);
          next.delete(post.id);
          return next;
        });
      }
    },
    [deletingPostIds, removePost, session?.user.id]
  );

  const handleToggleLike = useCallback(
    async (post: FeedPost) => {
      const userId = session?.user.id;

      if (!userId || likeRequestsRef.current.has(post.id)) {
        return;
      }

      const nextIsLiked = !post.isLikedByCurrentUser;
      const nextLikeCount = Math.max(
        0,
        post.likeCount + (nextIsLiked ? 1 : -1)
      );

      likeRequestsRef.current.add(post.id);
      setLikePendingIds((current) => new Set(current).add(post.id));
      setInteractionError(null);
      updatePostLike(post.id, {
        isLikedByCurrentUser: nextIsLiked,
        likeCount: nextLikeCount,
      });

      try {
        await setPostLike({
          isLiked: nextIsLiked,
          postId: post.id,
          userId,
        });
      } catch (error) {
        console.warn('[feed] Could not update post like.', error);
        updatePostLike(post.id, {
          isLikedByCurrentUser: post.isLikedByCurrentUser,
          likeCount: post.likeCount,
        });
        setInteractionError(getInteractionErrorMessage(error));
      } finally {
        likeRequestsRef.current.delete(post.id);
        setLikePendingIds((current) => {
          const next = new Set(current);
          next.delete(post.id);
          return next;
        });
      }
    },
    [session?.user.id, updatePostLike]
  );

  const openPost = useCallback(
    (post: FeedPost) => {
      router.push({ pathname: '/post/[id]', params: { id: post.id } });
    },
    [router]
  );

  const openAuthor = useCallback(
    (post: FeedPost) => {
      if (post.author.kind === 'organization') {
        router.push({
          pathname: '/organization/[id]',
          params: { id: post.author.id },
        });
        return;
      }

      if (!post.authorId) {
        return;
      }

      if (post.authorId === session?.user.id) {
        router.navigate('/(tabs)/profile');
        return;
      }

      router.push({ pathname: '/user/[id]', params: { id: post.authorId } });
    },
    [router, session?.user.id]
  );

  const isInitialLoading = status === 'idle' || status === 'loading';

  return (
    <SafeAreaScreen style={styles.safeArea} withinTabNavigator>
      <FlatList
        contentContainerStyle={styles.content}
        data={posts}
        keyExtractor={(post) => post.id}
        ListEmptyComponent={
          isInitialLoading ? (
            <FeedSkeleton />
          ) : status === 'error' ? (
            <FeedState
              actionLabel="Try again"
              message={errorMessage ?? 'The campus feed is unavailable right now.'}
              onAction={() => void refreshFeed()}
              title="Could not load posts"
            />
          ) : (
            <FeedState
              actionLabel="Create the first post"
              message="Start a useful conversation with students across your university."
              onAction={() => router.navigate('/(tabs)/create')}
              title="Your campus feed is quiet"
            />
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              color={colors.textSecondary}
              style={styles.footerLoader}
            />
          ) : posts.length > 0 && !hasMore ? (
            <View style={styles.footerSpace} />
          ) : null
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.brand}>VĀRTĀ</Text>
                <Text style={styles.greeting}>{getGreeting()}</Text>
              </View>

              <View style={styles.headerActions}>
                <Pressable
                  accessibilityLabel={
                    unreadCount > 0
                      ? `Notifications, ${unreadCount} unread`
                      : 'Notifications'
                  }
                  accessibilityRole="button"
                  onPress={() => router.push('/notifications')}
                  style={({ pressed }) => [
                    styles.notificationButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={{
                      android: 'notifications_none',
                      ios: unreadCount > 0 ? 'bell.fill' : 'bell',
                      web: 'notifications_none',
                    }}
                    size={22}
                    tintColor={colors.textPrimary}
                  />

                  {unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>

                <Avatar
                  fullName={profile?.full_name ?? 'Student'}
                  uri={profileAvatarUrl}
                  verified={profile?.is_verified}
                />
              </View>
            </View>

            <View style={styles.intro}>
              <Text style={styles.heading}>What’s happening?</Text>
              <Text style={styles.subheading}>
                Discussions, updates and everything happening around campus.
              </Text>
            </View>

            <CampusNowSection
              errorMessage={campusNowError}
              events={campusNowEvents}
              interestPendingIds={eventInterestPendingIds}
              isLoading={campusNowLoading}
              onEventPress={(event) =>
                router.push({ pathname: '/event/[id]', params: { id: event.id } })
              }
              onInterestToggle={handleToggleEventInterest}
              onRetry={() => void refreshCampusNow()}
              onSeeAll={() => router.push('/events')}
            />

            <View style={styles.feedHeader}>
              <Text style={styles.sectionEyebrow}>CAMPUS FEED</Text>
              <Text style={styles.sectionTitle}>Latest</Text>
            </View>

            {errorMessage && posts.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void refreshFeed()}
                style={({ pressed }) => [
                  styles.inlineError,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.inlineErrorText}>{errorMessage}</Text>
                <Text style={styles.inlineErrorAction}>Retry</Text>
              </Pressable>
            ) : null}

            {interactionError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setInteractionError(null)}
                style={({ pressed }) => [
                  styles.inlineError,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.inlineErrorText}>{interactionError}</Text>
                <Text style={styles.inlineErrorAction}>Dismiss</Text>
              </Pressable>
            ) : null}
          </>
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            colors={[colors.textPrimary]}
            onRefresh={() =>
              void Promise.all([refreshFeed(), refreshCampusNow()])
            }
            progressBackgroundColor={colors.surfaceElevated}
            refreshing={isRefreshing}
            tintColor={colors.textPrimary}
          />
        }
        renderItem={({ item }) => (
          <PostCard
            currentUserId={session?.user.id ?? null}
            isDeleting={deletingPostIds.has(item.id)}
            isLikePending={likePendingIds.has(item.id)}
            onAuthorPress={openAuthor}
            onBlockUser={(post) =>
              post.author.kind === 'student' && post.authorId
                ? setBlockTarget({
                    fullName: post.author.fullName,
                    id: post.authorId,
                  })
                : undefined
            }
            onCommentPress={openPost}
            onDelete={handleDeletePost}
            onOpenPost={openPost}
            onReport={(post) =>
              setReportTarget({
                id: post.id,
                label: 'Report this post',
                type: 'post',
              })
            }
            onToggleLike={handleToggleLike}
            post={item}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      <ReportSheet
        onClose={() => setReportTarget(null)}
        reporterId={session?.user.id ?? null}
        target={reportTarget}
      />

      <BlockUserSheet
        currentUserId={session?.user.id ?? null}
        onChanged={() => void refreshFeed()}
        onClose={() => setBlockTarget(null)}
        user={blockTarget}
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

function FeedState({ actionLabel, message, onAction, title }: FeedStateProps) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [
          styles.stateButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.stateButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function FeedSkeleton() {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View accessibilityLabel="Loading campus posts" style={styles.skeletonList}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <View style={styles.skeletonHeader}>
            <View style={[styles.skeletonBlock, styles.skeletonAvatar]} />
            <View style={styles.skeletonIdentity}>
              <View style={[styles.skeletonBlock, styles.skeletonName]} />
              <View style={[styles.skeletonBlock, styles.skeletonMeta]} />
            </View>
          </View>
          <View style={[styles.skeletonBlock, styles.skeletonLine]} />
          <View style={[styles.skeletonBlock, styles.skeletonShortLine]} />
        </View>
      ))}
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning.';
  }

  if (hour < 17) {
    return 'Good afternoon.';
  }

  return 'Good evening.';
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerCopy: {
    flex: 1,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  notificationButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  unreadBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: 9,
    backgroundColor: colors.textPrimary,
  },

  unreadBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.white,
  },

  brand: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: colors.textSecondary,
  },

  greeting: {
    marginTop: 3,
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  intro: {
    marginTop: spacing.xxl,
  },

  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  subheading: {
    marginTop: spacing.sm,
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  feedHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },

  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.25,
    color: colors.textMuted,
  },

  sectionTitle: {
    marginTop: spacing.xs,
    fontSize: 21,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  inlineError: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
  },

  inlineErrorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
  },

  inlineErrorAction: {
    marginLeft: spacing.md,
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },

  stateCard: {
    minHeight: 220,
    paddingVertical: spacing.xxl,
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },

  stateTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  stateMessage: {
    maxWidth: 300,
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  stateButton: {
    minHeight: 44,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  stateButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },

  skeletonList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },

  skeletonCard: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },

  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  skeletonBlock: {
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },

  skeletonAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  skeletonIdentity: {
    marginLeft: spacing.md,
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
    marginTop: spacing.lg,
  },

  skeletonShortLine: {
    width: '64%',
    height: 12,
    marginTop: spacing.sm,
  },

  footerLoader: {
    marginVertical: spacing.lg,
  },

  footerSpace: {
    height: spacing.lg,
  },

  pressed: {
    opacity: 0.62,
  },
});
