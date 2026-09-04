import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useTheme';

import { PostCard } from '../../components/PostCard';
import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import { EventCard } from '../../components/events/EventCard';
import { LinkifiedText } from '../../components/links/LinkifiedText';
import { StructuredLinks } from '../../components/links/StructuredLinks';
import { ActionSheet } from '../../components/moderation/ActionSheet';
import { ReportSheet } from '../../components/moderation/ReportSheet';
import { OrganizationAvatar } from '../../components/organizations/OrganizationAvatar';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { getOrganizationProfileEvents, setEventInterest } from '../../lib/events';
import { isUuid } from '../../lib/identifiers';
import { getOrganizationLinks, type StructuredLink } from '../../lib/links';
import type { ReportTarget } from '../../lib/moderation';
import {
  getOrganizationById,
  getOrganizationErrorMessage,
  isOrganizationManagerRole,
  setOrganizationFollow,
} from '../../lib/organizations';
import {
  getInteractionErrorMessage,
  setPostLike,
} from '../../lib/postInteractions';
import {
  deletePost,
  getOrganizationPostsPage,
  getPostErrorMessage,
} from '../../lib/posts';
import type { CampusEvent } from '../../types/event';
import type { CampusOrganization } from '../../types/organization';
import type { FeedPost } from '../../types/post';

type PageStatus = 'loading' | 'ready' | 'unavailable' | 'error';
type ProfileTab = 'posts' | 'events';

export default function OrganizationScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      id: string | string[];
    }>();

  const organizationId =
    Array.isArray(params.id)
      ? params.id[0]
      : params.id;

  const { session } = useAuth();

  const userId =
    session?.user.id ?? null;

  const likeRequests =
    useRef(new Set<string>());

  const deleteRequests =
    useRef(new Set<string>());

  const interestRequests =
    useRef(new Set<string>());

  const followRequest =
    useRef(false);

  const activeUserIdRef =
    useRef<string | null>(null);

  const activeOrganizationIdRef =
    useRef<string | null>(null);

  const organizationRef =
    useRef<CampusOrganization | null>(null);

  const requestIdRef =
    useRef(0);

  const [activeTab, setActiveTab] =
    useState<ProfileTab>('posts');

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [events, setEvents] =
    useState<CampusEvent[]>([]);

  const [deletingPostIds, setDeletingPostIds] =
    useState<Set<string>>(
      () => new Set()
    );

  const [interestPendingIds, setInterestPendingIds] =
    useState<Set<string>>(
      () => new Set()
    );

  const [isFollowPending, setIsFollowPending] =
    useState(false);

  const [isOptionsVisible, setIsOptionsVisible] =
    useState(false);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [organization, setOrganization] =
    useState<CampusOrganization | null>(null);

  const [likePendingIds, setLikePendingIds] =
    useState<Set<string>>(
      () => new Set()
    );

  const [links, setLinks] =
    useState<StructuredLink[]>([]);

  const [posts, setPosts] =
    useState<FeedPost[]>([]);

  const [reportTarget, setReportTarget] =
    useState<ReportTarget | null>(null);

  const [status, setStatus] =
    useState<PageStatus>('loading');

  useEffect(() => {
    activeUserIdRef.current =
      userId;

    activeOrganizationIdRef.current =
      isUuid(organizationId)
        ? organizationId
        : null;

    requestIdRef.current += 1;

    likeRequests.current.clear();
    deleteRequests.current.clear();
    interestRequests.current.clear();
    followRequest.current = false;

    organizationRef.current =
      null;

    setOrganization(null);
    setPosts([]);
    setEvents([]);
    setLinks([]);
    setErrorMessage(null);
    setDeletingPostIds(new Set());
    setInterestPendingIds(new Set());
    setIsFollowPending(false);
    setIsOptionsVisible(false);
    setIsRefreshing(false);
    setLikePendingIds(new Set());
    setReportTarget(null);

    setStatus(
      isUuid(organizationId) &&
        userId
        ? 'loading'
        : 'unavailable'
    );
  }, [
    organizationId,
    userId,
  ]);

  const loadPage =
    useCallback(
      async (
        refreshing = false
      ) => {
        if (
          !isUuid(organizationId) ||
          !userId
        ) {
          setStatus('unavailable');
          return;
        }

        const requestId =
          requestIdRef.current + 1;

        requestIdRef.current =
          requestId;

        const hasExistingOrganization =
          organizationRef.current?.id ===
          organizationId;

        if (refreshing) {
          setIsRefreshing(true);
        } else if (
          !hasExistingOrganization
        ) {
          setStatus('loading');
        }

        setErrorMessage(null);

        try {
          const organizationPromise =
            getOrganizationById(
              organizationId,
              userId
            );

          const linksPromise =
            getOrganizationLinks(
              organizationId
            );

          const tabPromise =
            activeTab === 'posts'
              ? getOrganizationPostsPage(
                  organizationId,
                  userId
                )
              : getOrganizationProfileEvents(
                  organizationId,
                  userId
                );

          const [
            nextOrganization,
            nextLinks,
            tabResult,
          ] =
            await Promise.all([
              organizationPromise,
              linksPromise,
              tabPromise,
            ]);

          if (
            requestIdRef.current !==
            requestId
          ) {
            return;
          }

          if (
            !nextOrganization
          ) {
            organizationRef.current =
              null;

            setOrganization(null);
            setEvents([]);
            setPosts([]);
            setLinks([]);
            setStatus(
              'unavailable'
            );

            return;
          }

          organizationRef.current =
            nextOrganization;

          setOrganization(
            nextOrganization
          );

          setLinks(
            nextLinks
          );

          if (
            activeTab === 'posts'
          ) {
            setPosts(
              (
                tabResult as Awaited<
                  ReturnType<
                    typeof getOrganizationPostsPage
                  >
                >
              ).posts
            );
          } else {
            setEvents(
              tabResult as Awaited<
                ReturnType<
                  typeof getOrganizationProfileEvents
                >
              >
            );
          }

          setStatus('ready');
        } catch (error) {
          if (
            requestIdRef.current !==
            requestId
          ) {
            return;
          }

          console.warn(
            '[organization] Could not load page.',
            error
          );

          setErrorMessage(
            getOrganizationErrorMessage()
          );

          setStatus(
            hasExistingOrganization
              ? 'ready'
              : 'error'
          );
        } finally {
          if (
            requestIdRef.current ===
            requestId
          ) {
            setIsRefreshing(
              false
            );
          }
        }
      },
      [
        activeTab,
        organizationId,
        userId,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      void loadPage();

      return () => {
        requestIdRef.current +=
          1;
      };
    }, [loadPage])
  );

  const toggleFollow =
    useCallback(
      async () => {
        if (
          !organization ||
          !userId ||
          followRequest.current
        ) {
          return;
        }

        const previous =
          organization;

        const nextIsFollowed =
          !organization.isFollowed;

        followRequest.current =
          true;

        setIsFollowPending(
          true
        );

        setErrorMessage(
          null
        );

        setOrganization({
          ...organization,

          followerCount:
            Math.max(
              0,
              organization.followerCount +
                (
                  nextIsFollowed
                    ? 1
                    : -1
                )
            ),

          isFollowed:
            nextIsFollowed,
        });

        try {
          await setOrganizationFollow({
            isFollowed:
              nextIsFollowed,

            organizationId:
              organization.id,

            userId,
          });
        } catch (error) {
          if (
            activeUserIdRef.current !==
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
          ) {
            return;
          }

          console.warn(
            '[organization] Could not update follow.',
            error
          );

          setOrganization(
            (current) =>
              current?.id ===
              previous.id
                ? {
                    ...current,
                    followerCount:
                      previous.followerCount,
                    isFollowed:
                      previous.isFollowed,
                  }
                : current
          );

          setErrorMessage(
            'We could not update this follow. Please try again.'
          );
        } finally {
          if (
            activeUserIdRef.current !==
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
          ) {
            return;
          }

          followRequest.current =
            false;

          setIsFollowPending(
            false
          );
        }
      },
      [
        organization,
        organizationId,
        userId,
      ]
    );

  const toggleInterest =
    useCallback(
      async (
        event: CampusEvent
      ) => {
        if (
          !userId ||
          interestRequests.current.has(
            event.id
          )
        ) {
          return;
        }

        const nextIsInterested =
          !event.isInterested;

        interestRequests.current.add(
          event.id
        );

        setInterestPendingIds(
          (current) =>
            new Set(
              current
            ).add(
              event.id
            )
        );

        setEvents(
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
                            (nextIsInterested
                              ? 1
                              : -1)
                        ),
                      isInterested:
                        nextIsInterested,
                    }
                  : item
            )
        );

        try {
          await setEventInterest({
            eventId:
              event.id,

            isInterested:
              nextIsInterested,

            userId,
          });
        } catch (error) {
          if (
            activeUserIdRef.current !==
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
          ) {
            return;
          }

          console.warn(
            '[organization] Could not update event interest.',
            error
          );

          setEvents(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                    event.id &&
                  item.isInterested ===
                    nextIsInterested
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
            'We could not save this event. Please try again.'
          );
        } finally {
          if (
            activeUserIdRef.current !==
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
          ) {
            return;
          }

          interestRequests.current.delete(
            event.id
          );

          setInterestPendingIds(
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
        organizationId,
        userId,
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

  const togglePostLike =
    useCallback(
      async (
        post: FeedPost
      ) => {
        if (
          !userId ||
          likeRequests.current.has(
            post.id
          )
        ) {
          return;
        }

        const nextLiked =
          !post.isLikedByCurrentUser;

        likeRequests.current.add(
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

        setPosts(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                post.id
                  ? {
                      ...item,

                      isLikedByCurrentUser:
                        nextLiked,

                      likeCount:
                        Math.max(
                          0,
                          item.likeCount +
                            (
                              nextLiked
                                ? 1
                                : -1
                            )
                        ),
                    }
                  : item
            )
        );

        try {
          await setPostLike({
            isLiked:
              nextLiked,

            postId:
              post.id,

            userId,
          });
        } catch (error) {
          if (
            activeUserIdRef.current !==
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
          ) {
            return;
          }

          console.warn(
            '[organization] Could not update post like.',
            error
          );

          setPosts(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                    post.id &&
                  item.isLikedByCurrentUser ===
                    nextLiked
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
          if (
            activeUserIdRef.current !==
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
          ) {
            return;
          }

          likeRequests.current.delete(
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
        organizationId,
        userId,
      ]
    );

  const handleDeletePost =
    useCallback(
      async (
        post: FeedPost
      ) => {
        if (
          !userId ||
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
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
          ) {
            return;
          }

          setPosts(
            (current) =>
              current.filter(
                (item) =>
                  item.id !==
                  post.id
              )
          );

          setOrganization(
            (current) =>
              current
                ? {
                    ...current,

                    postCount:
                      Math.max(
                        0,
                        current.postCount -
                          1
                      ),
                  }
                : current
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
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
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
              userId ||
            activeOrganizationIdRef.current !==
              organizationId
          ) {
            return;
          }

          deleteRequests.current.delete(
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
        organizationId,
        userId,
      ]
    );

  const goBack =
    useCallback(
      () => {
        if (
          router.canGoBack()
        ) {
          router.back();
        } else {
          router.replace('/');
        }
      },
      [router]
    );

  const openManage =
    useCallback(
      () => {
        if (
          !organization
        ) {
          return;
        }

        router.push({
          pathname:
            '/organization/[id]/manage',

          params: {
            id:
              organization.id,
          },
        });
      },
      [
        organization,
        router,
      ]
    );

  return (
    <SafeAreaScreen
      style={
        styles.safeArea
      }
    >
      <OrganizationTopBar
        onBack={
          goBack
        }
        onMore={
          organization
            ? () =>
                setIsOptionsVisible(
                  true
                )
            : undefined
        }
        title={
          organization
            ? `@${organization.slug}`
            : 'Organization'
        }
      />

      {status ===
      'loading' ? (
        <OrganizationSkeleton />
      ) : status ===
        'unavailable' ? (
        <ProfileState
          message="This organization is not available."
          onAction={
            goBack
          }
          title="Organization unavailable"
        />
      ) : status ===
          'error' ||
        !organization ? (
        <ProfileState
          actionLabel="Try again"
          message={
            errorMessage ??
            getOrganizationErrorMessage()
          }
          onAction={() =>
            void loadPage()
          }
          title="Could not load organization"
        />
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          refreshControl={
            <RefreshControl
              colors={[
                colors.textPrimary,
              ]}
              onRefresh={() =>
                void loadPage(
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
          showsVerticalScrollIndicator={
            false
          }
        >
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
              <OrganizationAvatar
                name={
                  organization.name
                }
                size={
                  88
                }
                uri={
                  organization.avatarUrl
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
                    organization.postCount
                  }
                />

                <ProfileStat
                  label="Followers"
                  value={
                    organization.followerCount
                  }
                />

                <ProfileStat
                  label="Events"
                  value={
                    organization.eventCount
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
                style={
                  styles.name
                }
              >
                {
                  organization.name
                }
              </Text>

              {organization.isVerified ? (
                <SymbolView
                  name={{
                    android:
                      'verified',

                    ios:
                      'checkmark.seal.fill',

                    web:
                      'verified',
                  }}
                  size={
                    16
                  }
                  tintColor={
                    colors.success
                  }
                />
              ) : null}
            </View>

            <Text
              style={
                styles.identityLabel
              }
            >
              Official organization
            </Text>

            <Text
              style={
                styles.meta
              }
            >
              Club ·{' '}
              {
                organization.campusShortName
              }
            </Text>

            {organization.description ? (
              <LinkifiedText
                style={
                  styles.description
                }
              >
                {
                  organization.description
                }
              </LinkifiedText>
            ) : null}

            <StructuredLinks
              links={
                links
              }
              ownerName={
                organization.name
              }
            />

            {isOrganizationManagerRole(
              organization.role
            ) ? (
              <Pressable
                accessibilityRole="button"
                onPress={
                  openManage
                }
                style={({
                  pressed,
                }) => [
                  styles.actionButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.actionLabel
                  }
                >
                  Manage
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={
                  isFollowPending
                }
                onPress={() =>
                  void toggleFollow()
                }
                style={({
                  pressed,
                }) => [
                  styles.actionButton,

                  !organization.isFollowed &&
                    styles.actionButtonPrimary,

                  pressed &&
                    styles.pressed,
                ]}
              >
                {isFollowPending ? (
                  <ActivityIndicator
                    color={
                      organization.isFollowed
                        ? colors.textPrimary
                        : colors.primaryActionForeground
                    }
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.actionLabel,

                      !organization.isFollowed &&
                        styles.actionLabelPrimary,
                    ]}
                  >
                    {organization.isFollowed
                      ? 'Following'
                      : 'Follow'}
                  </Text>
                )}
              </Pressable>
            )}

            {errorMessage ? (
              <Text
                accessibilityRole="alert"
                style={
                  styles.error
                }
              >
                {
                  errorMessage
                }
              </Text>
            ) : null}
          </View>

          <View
            accessibilityRole="tablist"
            style={
              styles.tabs
            }
          >
            <ProfileTabButton
              active={
                activeTab ===
                'posts'
              }
              label="POSTS"
              onPress={() =>
                setActiveTab(
                  'posts'
                )
              }
            />

            <ProfileTabButton
              active={
                activeTab ===
                'events'
              }
              label="EVENTS"
              onPress={() =>
                setActiveTab(
                  'events'
                )
              }
            />
          </View>

          {activeTab ===
          'posts' ? (
            posts.length ===
            0 ? (
              <View
                style={
                  styles.emptyTab
                }
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  No organization posts yet.
                </Text>

                <Text
                  style={
                    styles.emptyMessage
                  }
                >
                  Official posts from this organization will appear here.
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.postList
                }
              >
                {posts.map(
                  (post) => (
                    <PostCard
                      currentUserId={
                        session
                          ?.user
                          .id ??
                        null
                      }
                      isDeleting={
                        deletingPostIds.has(
                          post.id
                        )
                      }
                      isLikePending={
                        likePendingIds.has(
                          post.id
                        )
                      }
                      key={
                        post.id
                      }
                      onCommentPress={
                        openPost
                      }
                      onDelete={
                        handleDeletePost
                      }
                      onEdit={(item) =>
                        router.push({
                          pathname:
                            '/post/[id]/edit',
                          params: {
                            id: item.id,
                          },
                        })
                      }
                      onOpenPost={
                        openPost
                      }
                      onReport={(
                        item
                      ) =>
                        setReportTarget(
                          {
                            id:
                              item.id,

                            label:
                              'Report this post',

                            type:
                              'post',
                          }
                        )
                      }
                      onToggleLike={
                        togglePostLike
                      }
                      post={
                        post
                      }
                    />
                  )
                )}
              </View>
            )
          ) : events.length ===
            0 ? (
            <View
              style={
                styles.emptyTab
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No events yet.
              </Text>

              <Text
                style={
                  styles.emptyMessage
                }
              >
                Published events from this organization will appear here.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.eventList
              }
            >
              {events.map(
                (event) => (
                  <EventCard
                    event={
                      event
                    }
                    interestPending={
                      interestPendingIds.has(
                        event.id
                      )
                    }
                    key={
                      event.id
                    }
                    onInterestToggle={
                      toggleInterest
                    }
                    onPress={(
                      item
                    ) =>
                      router.push(
                        {
                          pathname:
                            '/event/[id]',

                          params:
                            {
                              id:
                                item.id,
                            },
                        }
                      )
                    }
                  />
                )
              )}
            </View>
          )}
        </ScrollView>
      )}

      {organization ? (
        <ActionSheet
          actions={
            isOrganizationManagerRole(
              organization.role
            )
              ? [
                  {
                    label:
                      'Manage organization',

                    onPress:
                      openManage,
                  },
                ]
              : [
                  {
                    disabled:
                      isFollowPending,

                    label:
                      organization.isFollowed
                        ? 'Unfollow organization'
                        : 'Follow organization',

                    onPress:
                      () =>
                        void toggleFollow(),

                    tone:
                      organization.isFollowed
                        ? 'danger'
                        : 'default',
                  },
                ]
          }
          message={`Club · ${organization.campusShortName}`}
          onClose={() =>
            setIsOptionsVisible(
              false
            )
          }
          title="Organization options"
          visible={
            isOptionsVisible
          }
        />
      ) : null}

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
          reportTarget
        }
      />
    </SafeAreaScreen>
  );
}

function OrganizationTopBar({
  onBack,
  onMore,
  title,
}: {
  onBack:
    () => void;

  onMore?:
    () => void;

  title:
    string;
}) {
  const {
    colors,
    styles,
  } =
    useThemedStyles(
      createStyles
    );

  return (
    <View
      style={
        styles.topBar
      }
    >
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={
          12
        }
        onPress={
          onBack
        }
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
          size={
            22
          }
          tintColor={
            colors.textPrimary
          }
        />
      </Pressable>

      <Text
        numberOfLines={
          1
        }
        style={
          styles.topBarTitle
        }
      >
        {
          title
        }
      </Text>

      {onMore ? (
        <Pressable
          accessibilityLabel="Organization options"
          accessibilityRole="button"
          hitSlop={
            12
          }
          onPress={
            onMore
          }
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
            size={
              21
            }
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

function ProfileStat({
  label,
  value,
}: {
  label:
    string;

  value:
    number;
}) {
  const {
    styles,
  } =
    useThemedStyles(
      createStyles
    );

  return (
    <View
      style={
        styles.stat
      }
    >
      <Text
        style={
          styles.statValue
        }
      >
        {
          value
        }
      </Text>

      <Text
        style={
          styles.statLabel
        }
      >
        {
          label
        }
      </Text>
    </View>
  );
}

function ProfileTabButton({
  active,
  label,
  onPress,
}: {
  active:
    boolean;

  label:
    string;

  onPress:
    () => void;
}) {
  const {
    styles,
  } =
    useThemedStyles(
      createStyles
    );

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{
        selected:
          active,
      }}
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.tab,

        active &&
          styles.tabActive,

        pressed &&
          styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.tabLabel,

          active &&
            styles.tabLabelActive,
        ]}
      >
        {
          label
        }
      </Text>
    </Pressable>
  );
}

function OrganizationSkeleton() {
  const {
    styles,
  } =
    useThemedStyles(
      createStyles
    );

  return (
    <View
      accessibilityLabel="Loading organization profile"
      style={
        styles.skeleton
      }
    >
      <View
        style={
          styles.metricsRow
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
            styles.statsRow
          }
        >
          {[
            0,
            1,
            2,
          ].map(
            (item) => (
              <View
                key={
                  item
                }
                style={
                  styles.stat
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
          styles.skeletonDescription,
        ]}
      />

      <View
        style={[
          styles.skeletonBlock,
          styles.skeletonButton,
        ]}
      />

      <View
        style={[
          styles.skeletonBlock,
          styles.skeletonTabs,
        ]}
      />

      <View
        style={[
          styles.skeletonBlock,
          styles.skeletonCard,
        ]}
      />
    </View>
  );
}

function ProfileState({
  actionLabel = 'Go back',
  message,
  onAction,
  title,
}: {
  actionLabel?:
    string;

  message:
    string;

  onAction:
    () => void;

  title:
    string;
}) {
  const {
    styles,
  } =
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
        {
          title
        }
      </Text>

      <Text
        style={
          styles.stateMessage
        }
      >
        {
          message
        }
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={
          onAction
        }
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
            styles.stateButtonLabel
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

    topBar: {
      minHeight:
        56,

      paddingHorizontal:
        spacing.md,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.borderSubtle,
    },

    topBarButton: {
      width:
        44,

      height:
        44,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    topBarTitle: {
      flex:
        1,

      textAlign:
        'center',

      fontSize:
        15,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    content: {
      paddingHorizontal:
        spacing.lg,

      paddingBottom:
        spacing.xxl,
    },

    profileHeader: {
      paddingTop:
        spacing.lg,
    },

    metricsRow: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    statsRow: {
      flex:
        1,

      minHeight:
        88,

      marginLeft:
        spacing.md,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    stat: {
      flex:
        1,

      minHeight:
        56,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    statValue: {
      fontSize:
        17,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    statLabel: {
      marginTop:
        3,

      fontSize:
        10,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    nameRow: {
      marginTop:
        spacing.md,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        6,
    },

    name: {
      flexShrink:
        1,

      fontSize:
        17,

      lineHeight:
        23,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    identityLabel: {
      marginTop:
        3,

      fontSize:
        12,

      fontWeight:
        '600',

      color:
        colors.textPrimary,
    },

    meta: {
      marginTop:
        3,

      fontSize:
        12,

      color:
        colors.textSecondary,
    },

    description: {
      maxWidth:
        360,

      marginTop:
        spacing.sm,

      fontSize:
        14,

      lineHeight:
        20,

      color:
        colors.textPrimary,
    },

    actionButton: {
      minHeight:
        38,

      marginTop:
        spacing.md,

      paddingHorizontal:
        spacing.lg,

      borderWidth:
        1,

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

    actionButtonPrimary: {
      borderColor:
        colors.primaryActionBackground,

      backgroundColor:
        colors.primaryActionBackground,
    },

    actionLabel: {
      fontSize:
        13,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    actionLabelPrimary: {
      color:
        colors.primaryActionForeground,
    },

    error: {
      marginTop:
        spacing.md,

      padding:
        spacing.sm,

      borderRadius:
        radius.sm,

      textAlign:
        'center',

      fontSize:
        12,

      lineHeight:
        18,

      color:
        colors.danger,

      backgroundColor:
        colors.dangerSoft,
    },

    tabs: {
      minHeight:
        48,

      marginTop:
        spacing.lg,

      flexDirection:
        'row',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.borderSubtle,
    },

    tab: {
      flex:
        1,

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    tabActive: {
      borderBottomWidth:
        1,

      borderBottomColor:
        colors.textPrimary,
    },

    tabLabel: {
      fontSize:
        10,

      fontWeight:
        '700',

      letterSpacing:
        1.1,

      color:
        colors.textMuted,
    },

    tabLabelActive: {
      color:
        colors.textPrimary,
    },

    eventList: {
      paddingTop:
        spacing.md,
    },

    postList: {
      paddingTop:
        spacing.md,
    },

    emptyTab: {
      minHeight:
        190,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        spacing.lg,
    },

    emptyTitle: {
      textAlign:
        'center',

      fontSize:
        16,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    emptyMessage: {
      maxWidth:
        290,

      marginTop:
        spacing.xs,

      textAlign:
        'center',

      fontSize:
        13,

      lineHeight:
        19,

      color:
        colors.textSecondary,
    },

    state: {
      flex:
        1,

      padding:
        spacing.lg,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    stateTitle: {
      textAlign:
        'center',

      fontSize:
        21,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    stateMessage: {
      maxWidth:
        310,

      marginTop:
        spacing.sm,

      textAlign:
        'center',

      fontSize:
        14,

      lineHeight:
        21,

      color:
        colors.textSecondary,
    },

    stateButton: {
      minHeight:
        44,

      marginTop:
        spacing.lg,

      paddingHorizontal:
        spacing.lg,

      borderRadius:
        radius.sm,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primaryActionBackground,
    },

    stateButtonLabel: {
      fontSize:
        13,

      fontWeight:
        '700',

      color:
        colors.primaryActionForeground,
    },

    skeleton: {
      flex:
        1,

      paddingHorizontal:
        spacing.lg,

      paddingTop:
        spacing.lg,
    },

    skeletonBlock: {
      borderRadius:
        radius.sm,

      backgroundColor:
        colors.border,
    },

    skeletonAvatar: {
      width:
        88,

      height:
        88,

      borderRadius:
        radius.lg,
    },

    skeletonStatValue: {
      width:
        28,

      height:
        14,
    },

    skeletonStatLabel: {
      width:
        44,

      height:
        8,

      marginTop:
        spacing.sm,
    },

    skeletonName: {
      width:
        '70%',

      height:
        14,

      marginTop:
        spacing.md,
    },

    skeletonMeta: {
      width:
        '42%',

      height:
        9,

      marginTop:
        spacing.sm,
    },

    skeletonDescription: {
      width:
        '88%',

      height:
        12,

      marginTop:
        spacing.md,
    },

    skeletonButton: {
      width:
        '100%',

      height:
        38,

      marginTop:
        spacing.md,
    },

    skeletonTabs: {
      width:
        '100%',

      height:
        48,

      marginTop:
        spacing.lg,
    },

    skeletonCard: {
      width:
        '100%',

      height:
        180,

      marginTop:
        spacing.md,

      borderRadius:
        radius.lg,
    },

    pressed: {
      opacity:
        0.58,
    },
  });
