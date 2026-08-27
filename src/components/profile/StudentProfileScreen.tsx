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

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useThemedStyles } from '../../hooks/useTheme';
import {
  getProfileLinks,
  type StructuredLink,
} from '../../lib/links';
import {
  getIsUserBlocked,
  type ModerationUser,
  type ReportTarget,
} from '../../lib/moderation';
import {
  getInteractionErrorMessage,
  setPostLike,
} from '../../lib/postInteractions';
import {
  deletePost,
  getPostErrorMessage,
  getUserPostsPage,
} from '../../lib/posts';
import { getUserProfile } from '../../lib/profile';
import type {
  FeedCursor,
  FeedPost,
} from '../../types/post';
import type { UserProfile } from '../../types/profile';
import { Avatar } from '../Avatar';
import { ProfileBadges } from '../badges/ProfileBadges';
import { LinkifiedText } from '../links/LinkifiedText';
import { StructuredLinks } from '../links/StructuredLinks';
import { ActionSheet } from '../moderation/ActionSheet';
import { BlockUserSheet } from '../moderation/BlockUserSheet';
import { ReportSheet } from '../moderation/ReportSheet';
import { PostCard } from '../PostCard';
import { SafeAreaScreen } from '../SafeAreaScreen';

type ProfileStatus =
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'error';

type StudentProfileScreenProps = {
  profileId: string;
  showBackButton?: boolean;
};

const OTHER_PROFILE_CACHE_DURATION_MS =
  2 * 60 * 1000;

export function StudentProfileScreen({
  profileId,
  showBackButton = false,
}: StudentProfileScreenProps) {
  const { colors, styles } =
    useThemedStyles(createStyles);

  const router = useRouter();

  const { session } =
    useAuth();

  const viewerUserId =
    session?.user.id ?? null;

  const isOwnProfile =
    viewerUserId === profileId;

  const requestId =
    useRef(0);

  const profileRef =
    useRef<UserProfile | null>(
      null
    );

  const lastLoadedAtRef =
    useRef(0);

  const likeRequests =
    useRef(
      new Set<string>()
    );

  const deleteRequests =
    useRef(
      new Set<string>()
    );

  const loadMoreRequest =
    useRef(false);

  const firstPageRequest =
    useRef(false);

  const activeViewerUserIdRef =
    useRef<string | null>(
      null
    );

  const activeProfileIdRef =
    useRef<string | null>(
      null
    );

  const [
    stateProfileId,
    setStateProfileId,
  ] =
    useState<string | null>(
      null
    );

  const [
    stateViewerUserId,
    setStateViewerUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    blockTarget,
    setBlockTarget,
  ] =
    useState<
      ModerationUser | null
    >(null);

  const [
    cursor,
    setCursor,
  ] =
    useState<
      FeedCursor | null
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
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    hasMore,
    setHasMore,
  ] =
    useState(false);

  const [
    isLoadingMore,
    setIsLoadingMore,
  ] =
    useState(false);

  const [
    isBlocked,
    setIsBlocked,
  ] =
    useState(false);

  const [
    isProfileOptionsVisible,
    setIsProfileOptionsVisible,
  ] =
    useState(false);

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

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
    links,
    setLinks,
  ] =
    useState<
      StructuredLink[]
    >([]);

  const [
    posts,
    setPosts,
  ] =
    useState<
      FeedPost[]
    >([]);

  const [
    profile,
    setProfile,
  ] =
    useState<
      UserProfile | null
    >(null);

  const [
    reportTarget,
    setReportTarget,
  ] =
    useState<
      ReportTarget | null
    >(null);

  const [
    status,
    setStatus,
  ] =
    useState<ProfileStatus>(
      'loading'
    );

  /*
   * Profile state belongs to both:
   *
   * - the profile being viewed
   * - the authenticated viewer
   *
   * Reset everything if either changes.
   */
  useEffect(() => {
    activeViewerUserIdRef.current =
      viewerUserId;

    activeProfileIdRef.current =
      isUuid(profileId)
        ? profileId
        : null;

    requestId.current += 1;

    profileRef.current =
      null;

    lastLoadedAtRef.current =
      0;

    firstPageRequest.current =
      false;

    loadMoreRequest.current =
      false;

    likeRequests.current.clear();
    deleteRequests.current.clear();

    setStateProfileId(null);
    setStateViewerUserId(null);
    setProfile(null);
    setPosts([]);
    setLinks([]);
    setCursor(null);
    setHasMore(false);
    setIsBlocked(false);
    setErrorMessage(null);
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setDeletingPostIds(
      new Set()
    );
    setLikePendingIds(
      new Set()
    );
    setBlockTarget(null);
    setReportTarget(null);
    setIsProfileOptionsVisible(
      false
    );
    setStatus('loading');
  }, [
    profileId,
    viewerUserId,
  ]);

  const loadProfile =
    useCallback(
      async (
        refreshing = false
      ) => {
        if (
          !viewerUserId ||
          !isUuid(
            profileId
          )
        ) {
          setStatus(
            'unavailable'
          );

          return;
        }

        const activeRequestId =
          requestId.current +
          1;

        requestId.current =
          activeRequestId;

        firstPageRequest.current =
          true;

        /*
         * Any full profile refresh
         * invalidates pagination that
         * might currently be running.
         */
        loadMoreRequest.current =
          false;

        setIsLoadingMore(
          false
        );

        const hasExistingProfile =
          profileRef.current?.id ===
          profileId;

        if (refreshing) {
          setIsRefreshing(
            true
          );
        } else if (
          !hasExistingProfile
        ) {
          setStatus(
            'loading'
          );
        }

        setErrorMessage(
          null
        );

        try {
          const [
            nextProfile,
            page,
            nextIsBlocked,
            nextLinks,
          ] =
            await Promise.all([
              getUserProfile(
                profileId
              ),

              getUserPostsPage(
                profileId,
                viewerUserId
              ),

              isOwnProfile
                ? Promise.resolve(
                    false
                  )
                : getIsUserBlocked(
                    viewerUserId,
                    profileId
                  ),

              getProfileLinks(
                profileId
              ),
            ]);

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          if (
            !nextProfile
          ) {
            profileRef.current =
              null;

            lastLoadedAtRef.current =
              0;

            setStateProfileId(
              profileId
            );

            setStateViewerUserId(
              viewerUserId
            );

            setProfile(
              null
            );

            setPosts(
              []
            );

            setLinks(
              []
            );

            setCursor(
              null
            );

            setHasMore(
              false
            );

            setIsBlocked(
              false
            );

            setStatus(
              'unavailable'
            );

            return;
          }

          profileRef.current =
            nextProfile;

          lastLoadedAtRef.current =
            Date.now();

          setStateProfileId(
            profileId
          );

          setStateViewerUserId(
            viewerUserId
          );

          setProfile(
            nextProfile
          );

          setPosts(
            page.posts
          );

          setLinks(
            nextLinks
          );

          setCursor(
            page.cursor
          );

          setHasMore(
            page.hasMore
          );

          setIsBlocked(
            nextIsBlocked
          );

          setStatus(
            'ready'
          );
        } catch (error) {
          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          console.warn(
            '[student-profile] Could not load profile.',
            error
          );

          setStateProfileId(
            profileId
          );

          setStateViewerUserId(
            viewerUserId
          );

          setErrorMessage(
            'We could not load this profile. Check your connection and try again.'
          );

          /*
           * Keep an already-loaded
           * profile visible when a
           * background refresh fails.
           */
          setStatus(
            hasExistingProfile
              ? 'ready'
              : 'error'
          );
        } finally {
          if (
            requestId.current ===
            activeRequestId
          ) {
            firstPageRequest.current =
              false;

            setIsRefreshing(
              false
            );
          }
        }
      },
      [
        isOwnProfile,
        profileId,
        viewerUserId,
      ]
    );

  /*
   * Own profile:
   *
   * Always refresh on focus because
   * returning from Create/Edit should
   * immediately reflect new posts and
   * profile changes.
   *
   * Other student profiles:
   *
   * Reuse the existing result for up
   * to two minutes. Navigating
   * profile -> post -> back therefore
   * does not download profile, posts,
   * links and block state again.
   */
  useFocusEffect(
    useCallback(() => {
      const hasCurrentProfile =
        profileRef.current?.id ===
        profileId;

      const cacheIsFresh =
        hasCurrentProfile &&
        Date.now() -
          lastLoadedAtRef.current <
          OTHER_PROFILE_CACHE_DURATION_MS;

      const shouldLoad =
        isOwnProfile ||
        !cacheIsFresh;

      if (
        shouldLoad
      ) {
        void loadProfile();
      }

      return () => {
        /*
         * Invalidate requests that
         * finish after this screen has
         * lost focus.
         *
         * If a like/delete mutation is
         * still running, force the next
         * focus to reload even for an
         * otherwise-fresh cached profile.
         * A failed mutation may finish
         * while this screen is hidden,
         * so reusing the optimistic cache
         * would otherwise show stale data.
         */
        if (
          likeRequests.current.size >
            0 ||
          deleteRequests.current.size >
            0
        ) {
          lastLoadedAtRef.current =
            0;
        }

        requestId.current += 1;

        firstPageRequest.current =
          false;

        loadMoreRequest.current =
          false;

        setIsLoadingMore(
          false
        );
      };
    }, [
      isOwnProfile,
      loadProfile,
      profileId,
    ])
  );

  const loadMore =
    useCallback(
      async () => {
        if (
          !viewerUserId ||
          firstPageRequest.current ||
          !cursor ||
          !hasMore ||
          loadMoreRequest.current
        ) {
          return;
        }

        loadMoreRequest.current =
          true;

        setIsLoadingMore(
          true
        );

        setErrorMessage(
          null
        );

        /*
         * Capture the current profile
         * request version.
         *
         * If a refresh, navigation or
         * account/profile change occurs
         * while this page is loading,
         * the returned page is ignored.
         */
        const activeRequestId =
          requestId.current;

        const activeCursor =
          cursor;

        try {
          const page =
            await getUserPostsPage(
              profileId,
              viewerUserId,
              activeCursor
            );

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          setPosts(
            (
              current
            ) => {
              const existingIds =
                new Set(
                  current.map(
                    (
                      post
                    ) =>
                      post.id
                  )
                );

              return [
                ...current,

                ...page.posts.filter(
                  (
                    post
                  ) =>
                    !existingIds.has(
                      post.id
                    )
                ),
              ];
            }
          );

          setCursor(
            page.cursor
          );

          setHasMore(
            page.hasMore
          );
        } catch (error) {
          if (
            requestId.current ===
            activeRequestId
          ) {
            console.warn(
              '[student-profile] Could not load more posts.',
              error
            );

            setErrorMessage(
              'More posts could not be loaded. Pull down to retry.'
            );
          }
        } finally {
          if (
            requestId.current ===
            activeRequestId
          ) {
            loadMoreRequest.current =
              false;

            setIsLoadingMore(
              false
            );
          }
        }
      },
      [
        cursor,
        hasMore,
        profileId,
        viewerUserId,
      ]
    );

  const handleToggleLike =
    useCallback(
      async (
        post: FeedPost
      ) => {
        if (
          !viewerUserId ||
          likeRequests.current.has(
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

        likeRequests.current.add(
          post.id
        );

        setLikePendingIds(
          (
            current
          ) =>
            new Set(
              current
            ).add(
              post.id
            )
        );

        setErrorMessage(
          null
        );

        setPosts(
          (
            current
          ) =>
            current.map(
              (
                item
              ) =>
                item.id ===
                post.id
                  ? {
                      ...item,

                      isLikedByCurrentUser:
                        nextIsLiked,

                      likeCount:
                        nextLikeCount,
                    }
                  : item
            )
        );

        const activeRequestId =
          requestId.current;

        try {
          await setPostLike(
            {
              isLiked:
                nextIsLiked,

              postId:
                post.id,

              userId:
                viewerUserId,
            }
          );
        } catch (error) {
          if (
            requestId.current !==
              activeRequestId ||
            activeViewerUserIdRef.current !==
              viewerUserId ||
            activeProfileIdRef.current !==
              profileId
          ) {
            return;
          }

          setPosts(
            (
              current
            ) =>
              current.map(
                (
                  item
                ) =>
                  item.id ===
                  post.id
                    ? {
                        ...item,

                        isLikedByCurrentUser:
                          post.isLikedByCurrentUser,

                        likeCount:
                          post.likeCount,
                      }
                    : item
              )
          );

          setErrorMessage(
            getInteractionErrorMessage(
              error
            )
          );
        } finally {
          /*
           * A mutation from a previous
           * viewer/profile must not clear
           * the lock owned by the current
           * screen.
           *
           * A same-profile refresh is
           * different: it invalidates the
           * optimistic rollback, but the
           * original mutation still owns
           * this lock and should release
           * it when it finishes.
           */
          if (
            activeViewerUserIdRef.current !==
              viewerUserId ||
            activeProfileIdRef.current !==
              profileId
          ) {
            return;
          }

          likeRequests.current.delete(
            post.id
          );

          setLikePendingIds(
            (
              current
            ) => {
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
        profileId,
        viewerUserId,
      ]
    );

  const handleDeletePost =
    useCallback(
      async (
        post: FeedPost
      ) => {
        if (
          !viewerUserId ||
          deleteRequests.current.has(
            post.id
          )
        ) {
          return;
        }

        deleteRequests.current.add(
          post.id
        );

        setDeletingPostIds(
          (
            current
          ) =>
            new Set(
              current
            ).add(
              post.id
            )
        );

        const activeRequestId =
          requestId.current;

        try {
          const result =
            await deletePost(
              post,
              viewerUserId
            );

          if (
            requestId.current !==
              activeRequestId ||
            activeViewerUserIdRef.current !==
              viewerUserId ||
            activeProfileIdRef.current !==
              profileId
          ) {
            return;
          }

          setPosts(
            (
              current
            ) =>
              current.filter(
                (
                  item
                ) =>
                  item.id !==
                  post.id
              )
          );

          setProfile(
            (
              current
            ) => {
              if (
                !current
              ) {
                return current;
              }

              const nextProfile =
                {
                  ...current,

                  postCount:
                    Math.max(
                      0,
                      current.postCount -
                        1
                    ),
                };

              profileRef.current =
                nextProfile;

              return nextProfile;
            }
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
            requestId.current !==
              activeRequestId ||
            activeViewerUserIdRef.current !==
              viewerUserId ||
            activeProfileIdRef.current !==
              profileId
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
            activeViewerUserIdRef.current !==
              viewerUserId ||
            activeProfileIdRef.current !==
              profileId
          ) {
            return;
          }

          deleteRequests.current.delete(
            post.id
          );

          setDeletingPostIds(
            (
              current
            ) => {
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
        profileId,
        viewerUserId,
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

  const goBack =
    useCallback(() => {
      if (
        router.canGoBack()
      ) {
        router.back();

        return;
      }

      router.replace('/');
    }, [router]);

  const hasValidIdentity =
    Boolean(
      viewerUserId &&
      isUuid(profileId)
    );

  const hasCurrentState =
    stateProfileId ===
      profileId &&
    stateViewerUserId ===
      viewerUserId;

  /*
   * Effects run after render.
   *
   * When the route or authenticated
   * account changes, there is therefore
   * one render where React still holds
   * the previous profile state. Never
   * expose that previous profile.
   */
  if (
    hasValidIdentity &&
    !hasCurrentState
  ) {
    return (
      <SafeAreaScreen
        style={
          styles.safeArea
        }
        withinTabNavigator={
          !showBackButton
        }
      >
        <ProfileTopBar
          onBack={
            showBackButton
              ? goBack
              : undefined
          }
          onSettings={
            isOwnProfile
              ? () =>
                  router.push(
                    '/settings'
                  )
              : undefined
          }
          title="Profile"
        />

        <ProfileSkeleton />
      </SafeAreaScreen>
    );
  }

  if (
    !hasValidIdentity
  ) {
    return (
      <SafeAreaScreen
        style={
          styles.safeArea
        }
        withinTabNavigator={
          !showBackButton
        }
      >
        <ProfileTopBar
          onBack={
            showBackButton
              ? goBack
              : undefined
          }
          onSettings={
            isOwnProfile
              ? () =>
                  router.push(
                    '/settings'
                  )
              : undefined
          }
          title="Profile"
        />

        <ProfileState
          actionLabel={
            showBackButton
              ? 'Go back'
              : 'Try again'
          }
          message="This student profile may be unavailable or outside your university."
          onAction={
            showBackButton
              ? goBack
              : () =>
                  void loadProfile()
          }
          title="Profile unavailable"
        />
      </SafeAreaScreen>
    );
  }

  if (
    status ===
    'loading'
  ) {
    return (
      <SafeAreaScreen
        style={
          styles.safeArea
        }
        withinTabNavigator={
          !showBackButton
        }
      >
        <ProfileTopBar
          onBack={
            showBackButton
              ? goBack
              : undefined
          }
          onSettings={
            isOwnProfile
              ? () =>
                  router.push(
                    '/settings'
                  )
              : undefined
          }
          title="Profile"
        />

        <ProfileSkeleton />
      </SafeAreaScreen>
    );
  }

  if (
    status ===
    'error'
  ) {
    return (
      <SafeAreaScreen
        style={
          styles.safeArea
        }
        withinTabNavigator={
          !showBackButton
        }
      >
        <ProfileTopBar
          onBack={
            showBackButton
              ? goBack
              : undefined
          }
          onSettings={
            isOwnProfile
              ? () =>
                  router.push(
                    '/settings'
                  )
              : undefined
          }
          title="Profile"
        />

        <ProfileState
          actionLabel="Try again"
          message={
            errorMessage ??
            'We could not load this profile.'
          }
          onAction={() =>
            void loadProfile()
          }
          title="Could not load profile"
        />
      </SafeAreaScreen>
    );
  }

  if (
    status ===
      'unavailable' ||
    !profile
  ) {
    return (
      <SafeAreaScreen
        style={
          styles.safeArea
        }
        withinTabNavigator={
          !showBackButton
        }
      >
        <ProfileTopBar
          onBack={
            showBackButton
              ? goBack
              : undefined
          }
          onSettings={
            isOwnProfile
              ? () =>
                  router.push(
                    '/settings'
                  )
              : undefined
          }
          title="Profile"
        />

        <ProfileState
          actionLabel={
            showBackButton
              ? 'Go back'
              : 'Try again'
          }
          message="This student profile may be unavailable or outside your university."
          onAction={
            showBackButton
              ? goBack
              : () =>
                  void loadProfile()
          }
          title="Profile unavailable"
        />
      </SafeAreaScreen>
    );
  }

  return (
    <SafeAreaScreen
      style={
        styles.safeArea
      }
      withinTabNavigator={
        !showBackButton
      }
    >
      <ProfileTopBar
        onBack={
          showBackButton
            ? goBack
            : undefined
        }
        onMore={
          isOwnProfile
            ? undefined
            : () =>
                setIsProfileOptionsVisible(
                  true
                )
        }
        onSettings={
          isOwnProfile
            ? () =>
                router.push(
                  '/settings'
                )
            : undefined
        }
        title={`@${profile.username}`}
      />

      <FlatList
        contentContainerStyle={
          styles.listContent
        }
        data={posts}
        keyExtractor={(
          post
        ) => post.id}
        ListEmptyComponent={
          <View
            style={
              styles.emptyPosts
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No posts yet.
            </Text>

            <Text
              style={
                styles.emptyMessage
              }
            >
              {isOwnProfile
                ? 'Your conversations will appear here.'
                : `${profile.fullName}'s conversations will appear here.`}
            </Text>
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              color={
                colors.textSecondary
              }
              style={
                styles.footerLoader
              }
            />
          ) : null
        }
        ListHeaderComponent={
          <ProfileHeader
            errorMessage={
              errorMessage
            }
            isOwnProfile={
              isOwnProfile
            }
            onEdit={() =>
              router.push(
                '/edit-profile'
              )
            }
            onFollowing={
              isOwnProfile
                ? () =>
                    router.push(
                      '/following'
                    )
                : undefined
            }
            links={
              links
            }
            profile={
              profile
            }
          />
        }
        onEndReached={() =>
          void loadMore()
        }
        onEndReachedThreshold={
          0.35
        }
        refreshControl={
          <RefreshControl
            colors={[
              colors.textPrimary,
            ]}
            onRefresh={() =>
              void loadProfile(
                true
              )
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
          <PostCard
            currentUserId={
              viewerUserId
            }
            isDeleting={
              deletingPostIds.has(
                item.id
              )
            }
            isLikePending={
              likePendingIds.has(
                item.id
              )
            }
            onBlockUser={
              isOwnProfile
                ? undefined
                : (
                    post
                  ) =>
                    post.authorId
                      ? setBlockTarget(
                          {
                            fullName:
                              post.author
                                .fullName,

                            id:
                              post.authorId,
                          }
                        )
                      : undefined
            }
            onCommentPress={
              openPost
            }
            onDelete={
              isOwnProfile
                ? handleDeletePost
                : undefined
            }
            onOpenPost={
              openPost
            }
            onReport={
              isOwnProfile
                ? undefined
                : (
                    post
                  ) =>
                    setReportTarget(
                      {
                        id:
                          post.id,

                        label:
                          'Report this post',

                        type:
                          'post',
                      }
                    )
            }
            onToggleLike={
              handleToggleLike
            }
            post={
              item
            }
          />
        )}
        showsVerticalScrollIndicator={
          false
        }
      />

      <ActionSheet
        actions={[
          {
            label:
              'Report profile',

            onPress: () =>
              setReportTarget(
                {
                  id:
                    profile.id,

                  label:
                    'Report this profile',

                  type:
                    'profile',
                }
              ),
          },

          {
            label:
              isBlocked
                ? 'Unblock student'
                : 'Block student',

            onPress: () =>
              setBlockTarget(
                {
                  fullName:
                    profile.fullName,

                  id:
                    profile.id,
                }
              ),

            tone:
              isBlocked
                ? 'default'
                : 'danger',
          },
        ]}
        onClose={() =>
          setIsProfileOptionsVisible(
            false
          )
        }
        title="Profile options"
        visible={
          isProfileOptionsVisible
        }
      />

      <ReportSheet
        onClose={() =>
          setReportTarget(
            null
          )
        }
        reporterId={
          viewerUserId
        }
        target={
          reportTarget
        }
      />

      <BlockUserSheet
        currentUserId={
          viewerUserId
        }
        mode={
          isBlocked &&
          blockTarget?.id ===
            profile.id
            ? 'unblock'
            : 'block'
        }
        onChanged={() =>
          void loadProfile(
            true
          )
        }
        onClose={() =>
          setBlockTarget(
            null
          )
        }
        user={
          blockTarget
        }
      />
    </SafeAreaScreen>
  );
}

function ProfileTopBar({
  onBack,
  onMore,
  onSettings,
  title,
}: {
  onBack?: () => void;
  onMore?: () => void;
  onSettings?: () => void;
  title: string;
}) {
  const { colors, styles } =
    useThemedStyles(
      createStyles
    );

  return (
    <View
      style={
        styles.topBar
      }
    >
      {onBack ? (
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={({
            pressed,
          }) => [
            styles.topBarButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <SymbolView
            name={{
              android:
                'arrow_back',
              ios:
                'chevron.left',
              web:
                'arrow_back',
            }}
            size={22}
            tintColor={
              colors.textPrimary
            }
          />
        </Pressable>
      ) : (
        <View
          style={
            styles.topBarButton
          }
        />
      )}

      <Text
        numberOfLines={
          1
        }
        style={
          styles.topBarTitle
        }
      >
        {title}
      </Text>

      {onMore ? (
        <Pressable
          accessibilityLabel="Profile options"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onMore}
          style={({
            pressed,
          }) => [
            styles.topBarButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <SymbolView
            name={{
              android:
                'more_horiz',
              ios:
                'ellipsis',
              web:
                'more_horiz',
            }}
            size={21}
            tintColor={
              colors.textPrimary
            }
          />
        </Pressable>
      ) : onSettings ? (
        <Pressable
          accessibilityLabel="Settings"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onSettings}
          style={({
            pressed,
          }) => [
            styles.topBarButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <SymbolView
            name={{
              android:
                'settings',
              ios:
                'gearshape',
              web:
                'settings',
            }}
            size={21}
            tintColor={
              colors.textPrimary
            }
          />
        </Pressable>
      ) : (
        <View
          style={
            styles.topBarButton
          }
        />
      )}
    </View>
  );
}

function ProfileHeader({
  errorMessage,
  isOwnProfile,
  onEdit,
  onFollowing,
  links,
  profile,
}: {
  errorMessage:
    string | null;

  isOwnProfile:
    boolean;

  onEdit:
    () => void;

  onFollowing?:
    () => void;

  links:
    StructuredLink[];

  profile:
    UserProfile;
}) {
  const { colors, styles } =
    useThemedStyles(
      createStyles
    );

  return (
    <View>
      <View
        style={
          styles.profileHeader
        }
      >
        <View
          style={
            styles.metricsRow
          }
        >
          <Avatar
            fullName={
              profile.fullName
            }
            size={88}
            uri={
              profile.avatarUrl
            }
            verified={
              profile.isVerified
            }
          />

          <View
            style={
              styles.statsRow
            }
          >
            <ProfileStat
              label="Posts"
              value={
                profile.postCount
              }
            />

            <ProfileStat
              label="Following"
              onPress={
                onFollowing
              }
              value={
                profile.organizationFollowingCount
              }
            />
          </View>
        </View>

        <View
          style={
            styles.nameRow
          }
        >
          <Text
            numberOfLines={
              2
            }
            style={
              styles.name
            }
          >
            {
              profile.fullName
            }
          </Text>

          {profile.isVerified ? (
            <SymbolView
              name={{
                android:
                  'verified',
                ios:
                  'checkmark.seal.fill',
                web:
                  'verified',
              }}
              size={16}
              tintColor={
                colors.success
              }
            />
          ) : null}
        </View>

        <Text
          style={
            styles.academicMeta
          }
        >
          {
            profile.institute
              .shortName
          }{' '}
          ·{' '}
          {
            profile.branch
          }{' '}
          ·{' '}
          {formatYear(
            profile.year
          )}
        </Text>

        {profile.bio ? (
          <LinkifiedText
            style={
              styles.bio
            }
          >
            {
              profile.bio
            }
          </LinkifiedText>
        ) : null}

        <StructuredLinks
          links={
            links
          }
          ownerName={
            profile.fullName
          }
        />

        <ProfileBadges
          badges={
            profile.badges
          }
          maxVisible={3}
        />

        {isOwnProfile ? (
          <Pressable
            accessibilityRole="button"
            onPress={
              onEdit
            }
            style={({
              pressed,
            }) => [
              styles.profileAction,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.profileActionLabel
              }
            >
              Edit profile
            </Text>
          </Pressable>
        ) : null}

        {errorMessage ? (
          <Text
            accessibilityRole="alert"
            style={
              styles.inlineError
            }
          >
            {
              errorMessage
            }
          </Text>
        ) : null}
      </View>

      <View
        style={
          styles.contentTab
        }
      >
        <SymbolView
          name={{
            android:
              'view_agenda',
            ios:
              'rectangle.stack',
            web:
              'view_agenda',
          }}
          size={16}
          tintColor={
            colors.textPrimary
          }
        />

        <Text
          style={
            styles.contentTabLabel
          }
        >
          POSTS
        </Text>
      </View>
    </View>
  );
}

function ProfileStat({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress?: () => void;
  value: number;
}) {
  const { styles } =
    useThemedStyles(
      createStyles
    );

  const content = (
    <>
      <Text
        style={
          styles.statValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.statLabel
        }
      >
        {label}
      </Text>
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityLabel={`${value} ${label}. Open ${label.toLowerCase()}.`}
      accessibilityRole="button"
      onPress={onPress}
      style={({
        pressed,
      }) => [
        styles.stat,
        pressed &&
          styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={
        styles.stat
      }
    >
      {content}
    </View>
  );
}

function ProfileSkeleton() {
  const { styles } =
    useThemedStyles(
      createStyles
    );

  return (
    <View
      accessibilityLabel="Loading student profile"
      style={
        styles.skeleton
      }
    >
      <View
        style={
          styles.skeletonMetrics
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
            styles.skeletonStats
          }
        >
          {[0, 1].map(
            (
              item
            ) => (
              <View
                key={
                  item
                }
                style={
                  styles.skeletonStat
                }
              >
                <View
                  style={[
                    styles.skeletonBlock,
                    styles.skeletonStatValue,
                  ]}
                />

                <View
                  style={[
                    styles.skeletonBlock,
                    styles.skeletonStatLabel,
                  ]}
                />
              </View>
            )
          )}
        </View>
      </View>

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

      <View
        style={[
          styles.skeletonBlock,
          styles.skeletonBio,
        ]}
      />

      <View
        style={[
          styles.skeletonBlock,
          styles.skeletonButton,
        ]}
      />

      <View
        style={
          styles.skeletonDivider
        }
      />

      {[0, 1].map(
        (
          item
        ) => (
          <View
            key={
              item
            }
            style={
              styles.skeletonPost
            }
          >
            <View
              style={[
                styles.skeletonBlock,
                styles.skeletonPostAvatar,
              ]}
            />

            <View
              style={
                styles.skeletonPostCopy
              }
            >
              <View
                style={[
                  styles.skeletonBlock,
                  styles.skeletonPostName,
                ]}
              />

              <View
                style={[
                  styles.skeletonBlock,
                  styles.skeletonPostLine,
                ]}
              />
            </View>
          </View>
        )
      )}
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
  const { styles } =
    useThemedStyles(
      createStyles
    );

  return (
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
          {
            actionLabel
          }
        </Text>
      </Pressable>
    </View>
  );
}

function formatYear(
  year: number
) {
  const suffix =
    year === 1
      ? 'st'
      : year === 2
        ? 'nd'
        : year === 3
          ? 'rd'
          : 'th';

  return `${year}${suffix} year`;
}

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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

    topBar: {
      minHeight: 56,
      paddingHorizontal:
        spacing.md,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.borderSubtle,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    topBarButton: {
      width: 44,
      height: 44,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    topBarTitle: {
      flex: 1,
      textAlign:
        'center',
      fontSize: 15,
      fontWeight:
        '700',
      color:
        colors.textPrimary,
    },

    listContent: {
      flexGrow: 1,
      paddingHorizontal:
        spacing.lg,
      paddingBottom:
        spacing.xxl,
    },

    profileHeader: {
      paddingTop:
        spacing.lg,
      alignItems:
        'stretch',
    },

    metricsRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    nameRow: {
      marginTop:
        spacing.md,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },

    name: {
      flexShrink: 1,
      fontSize: 16,
      lineHeight: 22,
      fontWeight:
        '700',
      color:
        colors.textPrimary,
    },

    academicMeta: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 18,
      color:
        colors.textSecondary,
    },

    statsRow: {
      flex: 1,
      minHeight: 88,
      marginLeft:
        spacing.lg,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    stat: {
      flex: 1,
      minHeight: 56,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    statValue: {
      fontSize: 18,
      fontWeight:
        '700',
      color:
        colors.textPrimary,
    },

    statLabel: {
      marginTop: 3,
      fontSize: 10,
      fontWeight:
        '600',
      color:
        colors.textMuted,
    },

    bio: {
      marginTop:
        spacing.sm,
      fontSize: 14,
      lineHeight: 21,
      color:
        colors.textPrimary,
    },

    profileAction: {
      width: '100%',
      minHeight: 38,
      marginTop:
        spacing.md,
      paddingHorizontal:
        spacing.lg,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius:
        radius.sm,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
    },

    profileActionLabel: {
      fontSize: 13,
      fontWeight:
        '700',
      color:
        colors.textPrimary,
    },

    inlineError: {
      width: '100%',
      marginTop:
        spacing.md,
      padding:
        spacing.md,
      borderRadius:
        radius.md,
      textAlign:
        'center',
      fontSize: 12,
      lineHeight: 18,
      color:
        colors.danger,
      backgroundColor:
        colors.dangerSoft,
    },

    contentTab: {
      minHeight: 46,
      marginTop:
        spacing.lg,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        spacing.sm,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.textPrimary,
    },

    contentTabLabel: {
      fontSize: 10,
      fontWeight:
        '700',
      letterSpacing:
        1.1,
      color:
        colors.textPrimary,
    },

    emptyPosts: {
      minHeight: 180,
      paddingVertical:
        spacing.xl,
      justifyContent:
        'center',
    },

    emptyTitle: {
      fontSize: 16,
      fontWeight:
        '700',
      color:
        colors.textPrimary,
    },

    emptyMessage: {
      marginTop:
        spacing.xs,
      fontSize: 13,
      lineHeight: 19,
      color:
        colors.textSecondary,
    },

    footerLoader: {
      marginVertical:
        spacing.lg,
    },

    state: {
      flex: 1,
      paddingHorizontal:
        spacing.lg,
      alignItems:
        'flex-start',
      justifyContent:
        'center',
    },

    stateTitle: {
      fontSize: 24,
      fontWeight:
        '700',
      color:
        colors.textPrimary,
    },

    stateMessage: {
      maxWidth: 320,
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
      fontWeight:
        '700',
      color:
        colors.white,
    },

    skeleton: {
      flex: 1,
      paddingHorizontal:
        spacing.lg,
      paddingTop:
        spacing.xl,
    },

    skeletonBlock: {
      borderRadius:
        radius.sm,
      backgroundColor:
        colors.border,
    },

    skeletonMetrics: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    skeletonAvatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
    },

    skeletonName: {
      width: '68%',
      height: 14,
      marginTop:
        spacing.md,
    },

    skeletonMeta: {
      width: '78%',
      height: 10,
      marginTop:
        spacing.md,
    },

    skeletonStats: {
      flex: 1,
      minHeight: 88,
      marginLeft:
        spacing.lg,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    skeletonStat: {
      flex: 1,
      alignItems:
        'center',
    },

    skeletonStatValue: {
      width: 28,
      height: 14,
    },

    skeletonStatLabel: {
      width: 50,
      height: 8,
      marginTop:
        spacing.sm,
    },

    skeletonBio: {
      width: '86%',
      height: 12,
      marginTop:
        spacing.lg,
    },

    skeletonButton: {
      width: '100%',
      height: 38,
      marginTop:
        spacing.md,
      borderRadius:
        radius.sm,
    },

    skeletonDivider: {
      width: '100%',
      height: 1,
      marginTop:
        spacing.xl,
      backgroundColor:
        colors.borderSubtle,
    },

    skeletonPost: {
      width: '100%',
      paddingVertical:
        spacing.lg,
      flexDirection:
        'row',
    },

    skeletonPostAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },

    skeletonPostCopy: {
      flex: 1,
      marginLeft:
        spacing.md,
    },

    skeletonPostName: {
      width: 132,
      height: 11,
    },

    skeletonPostLine: {
      width: '88%',
      height: 12,
      marginTop:
        spacing.lg,
    },

    pressed: {
      opacity: 0.58,
    },
  });
