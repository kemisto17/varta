import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { getAuthErrorMessage } from '../../lib/auth';
import {
  getIsUserBlocked,
  type ModerationUser,
  type ReportTarget,
} from '../../lib/moderation';
import {
  deletePost,
  getPostErrorMessage,
  getUserPostsPage,
} from '../../lib/posts';
import {
  getInteractionErrorMessage,
  setPostLike,
} from '../../lib/postInteractions';
import { getUserProfile } from '../../lib/profile';
import { deleteCurrentPushToken } from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';
import type { FeedCursor, FeedPost } from '../../types/post';
import type { UserProfile } from '../../types/profile';
import { Avatar } from '../Avatar';
import { PostCard } from '../PostCard';
import { ProfileBadges } from '../badges/ProfileBadges';
import { ActionSheet } from '../moderation/ActionSheet';
import { BlockUserSheet } from '../moderation/BlockUserSheet';
import { ReportSheet } from '../moderation/ReportSheet';

type ProfileStatus = 'loading' | 'ready' | 'unavailable' | 'error';

type StudentProfileScreenProps = {
  profileId: string;
  showBackButton?: boolean;
};

export function StudentProfileScreen({
  profileId,
  showBackButton = false,
}: StudentProfileScreenProps) {
  const router = useRouter();
  const { session } = useAuth();
  const viewerUserId = session?.user.id ?? null;
  const isOwnProfile = viewerUserId === profileId;
  const requestId = useRef(0);
  const likeRequests = useRef(new Set<string>());
  const loadMoreRequest = useRef(false);
  const [blockTarget, setBlockTarget] = useState<ModerationUser | null>(null);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [deletingPostIds, setDeletingPostIds] = useState<Set<string>>(
    () => new Set()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isProfileOptionsVisible, setIsProfileOptionsVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [likePendingIds, setLikePendingIds] = useState<Set<string>>(
    () => new Set()
  );
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('loading');

  const loadProfile = useCallback(
    async (refreshing = false) => {
      if (!viewerUserId || !isUuid(profileId)) {
        setStatus('unavailable');
        return;
      }

      const activeRequestId = requestId.current + 1;
      requestId.current = activeRequestId;

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setStatus('loading');
      }

      setErrorMessage(null);

      try {
        const [nextProfile, page, nextIsBlocked] = await Promise.all([
          getUserProfile(profileId),
          getUserPostsPage(profileId, viewerUserId),
          isOwnProfile
            ? Promise.resolve(false)
            : getIsUserBlocked(viewerUserId, profileId),
        ]);

        if (requestId.current !== activeRequestId) {
          return;
        }

        if (!nextProfile) {
          setProfile(null);
          setPosts([]);
          setIsBlocked(false);
          setStatus('unavailable');
          return;
        }

        setProfile(nextProfile);
        setPosts(page.posts);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
        setIsBlocked(nextIsBlocked);
        setStatus('ready');
      } catch (error) {
        if (requestId.current !== activeRequestId) {
          return;
        }

        console.warn('[student-profile] Could not load profile.', error);
        setErrorMessage(
          'We could not load this profile. Check your connection and try again.'
        );
        setStatus('error');
      } finally {
        if (requestId.current === activeRequestId) {
          setIsRefreshing(false);
        }
      }
    },
    [isOwnProfile, profileId, viewerUserId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadProfile();

      return () => {
        requestId.current += 1;
      };
    }, [loadProfile])
  );

  const loadMore = useCallback(async () => {
    if (
      !viewerUserId ||
      !cursor ||
      !hasMore ||
      loadMoreRequest.current
    ) {
      return;
    }

    loadMoreRequest.current = true;
    setIsLoadingMore(true);

    try {
      const page = await getUserPostsPage(profileId, viewerUserId, cursor);
      setPosts((current) => {
        const existingIds = new Set(current.map((post) => post.id));
        return [
          ...current,
          ...page.posts.filter((post) => !existingIds.has(post.id)),
        ];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn('[student-profile] Could not load more posts.', error);
      setErrorMessage('More posts could not be loaded. Pull down to retry.');
    } finally {
      loadMoreRequest.current = false;
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore, profileId, viewerUserId]);

  const handleToggleLike = useCallback(
    async (post: FeedPost) => {
      if (!viewerUserId || likeRequests.current.has(post.id)) {
        return;
      }

      const nextIsLiked = !post.isLikedByCurrentUser;
      const nextLikeCount = Math.max(
        0,
        post.likeCount + (nextIsLiked ? 1 : -1)
      );

      likeRequests.current.add(post.id);
      setLikePendingIds((current) => new Set(current).add(post.id));
      setErrorMessage(null);
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                isLikedByCurrentUser: nextIsLiked,
                likeCount: nextLikeCount,
              }
            : item
        )
      );

      try {
        await setPostLike({
          isLiked: nextIsLiked,
          postId: post.id,
          userId: viewerUserId,
        });
      } catch (error) {
        setPosts((current) =>
          current.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  isLikedByCurrentUser: post.isLikedByCurrentUser,
                  likeCount: post.likeCount,
                }
              : item
          )
        );
        setErrorMessage(getInteractionErrorMessage(error));
      } finally {
        likeRequests.current.delete(post.id);
        setLikePendingIds((current) => {
          const next = new Set(current);
          next.delete(post.id);
          return next;
        });
      }
    },
    [viewerUserId]
  );

  const handleDeletePost = useCallback(
    async (post: FeedPost) => {
      if (!viewerUserId || deletingPostIds.has(post.id)) {
        return;
      }

      setDeletingPostIds((current) => new Set(current).add(post.id));

      try {
        const result = await deletePost(post, viewerUserId);
        setPosts((current) => current.filter((item) => item.id !== post.id));
        setProfile((current) =>
          current
            ? { ...current, postCount: Math.max(0, current.postCount - 1) }
            : current
        );

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
    [deletingPostIds, viewerUserId]
  );

  const openPost = useCallback(
    (post: FeedPost) => {
      router.push({ pathname: '/post/[id]', params: { id: post.id } });
    },
    [router]
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [router]);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setErrorMessage(null);

    if (viewerUserId) {
      try {
        await deleteCurrentPushToken(viewerUserId);
      } catch (error) {
        console.warn('[push] Could not remove the current device token.', error);
      }
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(getAuthErrorMessage(error.message));
      setIsSigningOut(false);
    }
  }, [isSigningOut, viewerUserId]);

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ProfileTopBar onBack={showBackButton ? goBack : undefined} />
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ProfileTopBar onBack={showBackButton ? goBack : undefined} />
        <ProfileState
          actionLabel="Try again"
          message={errorMessage ?? 'We could not load this profile.'}
          onAction={() => void loadProfile()}
          title="Could not load profile"
        />
      </SafeAreaView>
    );
  }

  if (status === 'unavailable' || !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ProfileTopBar onBack={showBackButton ? goBack : undefined} />
        <ProfileState
          actionLabel={showBackButton ? 'Go back' : 'Try again'}
          message="This student profile may be unavailable or outside your university."
          onAction={showBackButton ? goBack : () => void loadProfile()}
          title="Profile unavailable"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ProfileTopBar
        onBack={showBackButton ? goBack : undefined}
        onMore={isOwnProfile ? undefined : () => setIsProfileOptionsVisible(true)}
      />
      <FlatList
        contentContainerStyle={styles.listContent}
        data={posts}
        keyExtractor={(post) => post.id}
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyTitle}>No posts yet.</Text>
            <Text style={styles.emptyMessage}>
              {isOwnProfile
                ? 'Your conversations will appear here.'
                : `${profile.fullName}'s conversations will appear here.`}
            </Text>
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              color={colors.textSecondary}
              style={styles.footerLoader}
            />
          ) : null
        }
        ListHeaderComponent={
          <ProfileHeader
            errorMessage={errorMessage}
            isOwnProfile={isOwnProfile}
            isSigningOut={isSigningOut}
            onEdit={() => router.push('/edit-profile')}
            onFeedback={() => router.push('/feedback')}
            onSignOut={() => void handleSignOut()}
            profile={profile}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        onRefresh={() => void loadProfile(true)}
        refreshing={isRefreshing}
        renderItem={({ item }) => (
          <PostCard
            currentUserId={viewerUserId}
            isDeleting={deletingPostIds.has(item.id)}
            isLikePending={likePendingIds.has(item.id)}
            onBlockUser={
              isOwnProfile
                ? undefined
                : (post) =>
                    setBlockTarget({
                      fullName: post.author.fullName,
                      id: post.authorId,
                    })
            }
            onCommentPress={openPost}
            onDelete={isOwnProfile ? handleDeletePost : undefined}
            onOpenPost={openPost}
            onReport={
              isOwnProfile
                ? undefined
                : (post) =>
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

      <ActionSheet
        actions={[
          {
            label: 'Report profile',
            onPress: () =>
              setReportTarget({
                id: profile.id,
                label: 'Report this profile',
                type: 'profile',
              }),
          },
          {
            label: isBlocked ? 'Unblock student' : 'Block student',
            onPress: () =>
              setBlockTarget({
                fullName: profile.fullName,
                id: profile.id,
              }),
            tone: isBlocked ? 'default' : 'danger',
          },
        ]}
        onClose={() => setIsProfileOptionsVisible(false)}
        title="Profile options"
        visible={isProfileOptionsVisible}
      />

      <ReportSheet
        onClose={() => setReportTarget(null)}
        reporterId={viewerUserId}
        target={reportTarget}
      />

      <BlockUserSheet
        currentUserId={viewerUserId}
        mode={
          isBlocked && blockTarget?.id === profile.id ? 'unblock' : 'block'
        }
        onChanged={() => void loadProfile(true)}
        onClose={() => setBlockTarget(null)}
        user={blockTarget}
      />
    </SafeAreaView>
  );
}

function ProfileTopBar({
  onBack,
  onMore,
}: {
  onBack?: () => void;
  onMore?: () => void;
}) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [
            styles.topBarButton,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{ android: 'arrow_back', ios: 'chevron.left', web: 'arrow_back' }}
            size={22}
            tintColor={colors.textPrimary}
          />
        </Pressable>
      ) : (
        <Text style={styles.brand}>VĀRTĀ</Text>
      )}

      <Text style={styles.topBarTitle}>Profile</Text>
      {onMore ? (
        <Pressable
          accessibilityLabel="Profile options"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onMore}
          style={({ pressed }) => [
            styles.topBarButton,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{ android: 'more_horiz', ios: 'ellipsis', web: 'more_horiz' }}
            size={21}
            tintColor={colors.textPrimary}
          />
        </Pressable>
      ) : (
        <View style={styles.topBarButton} />
      )}
    </View>
  );
}

function ProfileHeader({
  errorMessage,
  isOwnProfile,
  isSigningOut,
  onEdit,
  onFeedback,
  onSignOut,
  profile,
}: {
  errorMessage: string | null;
  isOwnProfile: boolean;
  isSigningOut: boolean;
  onEdit: () => void;
  onFeedback: () => void;
  onSignOut: () => void;
  profile: UserProfile;
}) {
  return (
    <View>
      <View style={styles.profileHeader}>
        <Avatar
          fullName={profile.fullName}
          size={88}
          uri={profile.avatarUrl}
          verified={profile.isVerified}
        />

        <Text style={styles.name}>{profile.fullName}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        <Text style={styles.academicMeta}>
          {profile.institute.shortName} · {profile.branch} ·{' '}
          {formatYear(profile.year)}
        </Text>

        {profile.isVerified ? (
          <View style={styles.verifiedRow}>
            <SymbolView
              name={{ android: 'verified', ios: 'checkmark.seal.fill', web: 'verified' }}
              size={15}
              tintColor={colors.success}
            />
            <Text style={styles.verifiedText}>Verified student</Text>
          </View>
        ) : null}

        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <ProfileBadges badges={profile.badges} />

        <View style={styles.postCount}>
          <Text style={styles.postCountValue}>{profile.postCount}</Text>
          <Text style={styles.postCountLabel}>
            {profile.postCount === 1 ? 'POST' : 'POSTS'}
          </Text>
        </View>

        {isOwnProfile ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={onEdit}
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.editButtonText}>Edit profile</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onFeedback}
              style={({ pressed }) => [
                styles.feedbackButton,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  android: 'chat_bubble_outline',
                  ios: 'bubble.left',
                  web: 'chat_bubble_outline',
                }}
                size={15}
                tintColor={colors.textSecondary}
              />
              <Text style={styles.feedbackButtonText}>
                Send alpha feedback
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSigningOut}
              onPress={onSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && styles.pressed,
              ]}
            >
              {isSigningOut ? (
                <ActivityIndicator color={colors.textSecondary} size="small" />
              ) : (
                <Text style={styles.signOutText}>Sign out</Text>
              )}
            </Pressable>
          </>
        ) : null}

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.inlineError}>
            {errorMessage}
          </Text>
        ) : null}
      </View>

      <View style={styles.postsHeading}>
        <Text style={styles.postsEyebrow}>CONVERSATIONS</Text>
        <Text style={styles.postsTitle}>Posts</Text>
      </View>
    </View>
  );
}

function ProfileSkeleton() {
  return (
    <View accessibilityLabel="Loading student profile" style={styles.skeleton}>
      <View style={[styles.skeletonBlock, styles.skeletonAvatar]} />
      <View style={[styles.skeletonBlock, styles.skeletonName]} />
      <View style={[styles.skeletonBlock, styles.skeletonUsername]} />
      <View style={[styles.skeletonBlock, styles.skeletonMeta]} />
      <View style={[styles.skeletonBlock, styles.skeletonButton]} />
      <View style={styles.skeletonDivider} />
      {[0, 1].map((item) => (
        <View key={item} style={styles.skeletonPost}>
          <View style={[styles.skeletonBlock, styles.skeletonPostAvatar]} />
          <View style={styles.skeletonPostCopy}>
            <View style={[styles.skeletonBlock, styles.skeletonPostName]} />
            <View style={[styles.skeletonBlock, styles.skeletonPostLine]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ProfileState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  actionLabel: string;
  message: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <View style={styles.state}>
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

function formatYear(year: number) {
  const suffix = year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';
  return `${year}${suffix} year`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  topBar: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  topBarButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topBarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  brand: {
    width: 44,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.textPrimary,
  },

  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  profileHeader: {
    paddingTop: spacing.xl,
    alignItems: 'center',
  },

  name: {
    marginTop: spacing.md,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },

  username: {
    marginTop: 3,
    fontSize: 14,
    color: colors.textSecondary,
  },

  academicMeta: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  verifiedRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },

  bio: {
    maxWidth: 340,
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },

  postCount: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },

  postCountValue: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  postCountLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },

  editButton: {
    minWidth: 180,
    minHeight: 44,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  feedbackButton: {
    minHeight: 40,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  feedbackButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  signOutButton: {
    minHeight: 36,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  signOutText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },

  inlineError: {
    width: '100%',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },

  postsHeading: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },

  postsEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.25,
    color: colors.textMuted,
  },

  postsTitle: {
    marginTop: spacing.xs,
    fontSize: 21,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  emptyPosts: {
    minHeight: 180,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    justifyContent: 'center',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  emptyMessage: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  footerLoader: {
    marginVertical: spacing.lg,
  },

  state: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  stateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  stateMessage: {
    maxWidth: 320,
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

  skeleton: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },

  skeletonBlock: {
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },

  skeletonAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },

  skeletonName: {
    width: 174,
    height: 18,
    marginTop: spacing.md,
  },

  skeletonUsername: {
    width: 110,
    height: 10,
    marginTop: spacing.sm,
  },

  skeletonMeta: {
    width: 230,
    height: 10,
    marginTop: spacing.lg,
  },

  skeletonButton: {
    width: 180,
    height: 44,
    marginTop: spacing.xl,
    borderRadius: radius.full,
  },

  skeletonDivider: {
    width: '100%',
    height: 1,
    marginTop: spacing.xl,
    backgroundColor: colors.borderSubtle,
  },

  skeletonPost: {
    width: '100%',
    paddingVertical: spacing.lg,
    flexDirection: 'row',
  },

  skeletonPostAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  skeletonPostCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },

  skeletonPostName: {
    width: 132,
    height: 11,
  },

  skeletonPostLine: {
    width: '88%',
    height: 12,
    marginTop: spacing.lg,
  },

  pressed: {
    opacity: 0.58,
  },
});
