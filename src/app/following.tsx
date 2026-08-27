import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../hooks/useTheme';

import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { OrganizationAvatar } from '../components/organizations/OrganizationAvatar';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import {
  getFollowedOrganizationsPage,
  setOrganizationFollow,
} from '../lib/organizations';
import type {
  FollowedOrganization,
  FollowedOrganizationCursor,
} from '../types/organization';

type PageStatus = 'loading' | 'ready' | 'error';

export default function FollowingScreen() {
  const { colors, styles } =
    useThemedStyles(createStyles);

  const { session } =
    useAuth();

  const router =
    useRouter();

  const userId =
    session?.user.id ?? null;

  const loadMorePendingRef =
    useRef(false);

  const firstPagePendingRef =
    useRef(false);

  const requestIdRef =
    useRef(0);

  const hasLoadedRef =
    useRef(false);

  const pendingIdsRef =
    useRef(
      new Set<string>()
    );

  const activeUserIdRef =
    useRef<string | null>(
      null
    );

  const [
    stateUserId,
    setStateUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    cursor,
    setCursor,
  ] =
    useState<
      FollowedOrganizationCursor | null
    >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null
    );

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
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    organizations,
    setOrganizations,
  ] =
    useState<
      FollowedOrganization[]
    >([]);

  const [
    pendingIds,
    setPendingIds,
  ] =
    useState<Set<string>>(
      () => new Set()
    );

  const [
    status,
    setStatus,
  ] =
    useState<PageStatus>(
      'loading'
    );

  /*
   * Following data belongs to the
   * authenticated account.
   *
   * Immediately invalidate all
   * asynchronous work and cached UI
   * state when the account changes.
   */
  useEffect(() => {
    activeUserIdRef.current =
      userId;

    requestIdRef.current +=
      1;

    firstPagePendingRef.current =
      false;

    loadMorePendingRef.current =
      false;

    hasLoadedRef.current =
      false;

    pendingIdsRef.current.clear();

    setStateUserId(
      userId
    );

    setCursor(
      null
    );

    setErrorMessage(
      null
    );

    setHasMore(
      false
    );

    setIsLoadingMore(
      false
    );

    setIsRefreshing(
      false
    );

    setOrganizations(
      []
    );

    setPendingIds(
      new Set()
    );

    setStatus(
      'loading'
    );
  }, [userId]);

  const loadPage =
    useCallback(
      async (
        refreshing =
          false
      ) => {
        if (!userId) {
          return;
        }

        /*
         * A new first-page request
         * invalidates any pagination
         * request currently in flight.
         */
        const requestId =
          requestIdRef.current +
          1;

        requestIdRef.current =
          requestId;

        firstPagePendingRef.current =
          true;

        loadMorePendingRef.current =
          false;

        setIsLoadingMore(
          false
        );

        if (
          refreshing &&
          hasLoadedRef.current
        ) {
          setIsRefreshing(
            true
          );
        } else if (
          !hasLoadedRef.current
        ) {
          setStatus(
            'loading'
          );
        }

        setErrorMessage(
          null
        );

        try {
          const page =
            await getFollowedOrganizationsPage();

          if (
            requestIdRef.current !==
              requestId ||
            activeUserIdRef.current !==
              userId
          ) {
            return;
          }

          /*
           * An unfollow mutation may
           * still be pending while this
           * request is resolving.
           *
           * Do not reinsert those rows
           * from an older server
           * snapshot.
           */
          const visibleOrganizations =
            page.organizations.filter(
              (
                organization
              ) =>
                !pendingIdsRef.current.has(
                  organization.id
                )
            );

          hasLoadedRef.current =
            true;

          setOrganizations(
            visibleOrganizations
          );

          setCursor(
            page.cursor
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
            '[following] Could not load organizations.',
            error
          );

          setErrorMessage(
            'We could not load the organizations you follow.'
          );

          setStatus(
            hasLoadedRef.current
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
            firstPagePendingRef.current =
              false;

            setIsRefreshing(
              false
            );
          }
        }
      },
      [userId]
    );

  useFocusEffect(
    useCallback(() => {
      void loadPage();

      return () => {
        /*
         * Leaving the screen makes all
         * outstanding page requests
         * stale.
         */
        requestIdRef.current +=
          1;

        firstPagePendingRef.current =
          false;

        loadMorePendingRef.current =
          false;

        setIsLoadingMore(
          false
        );

        setIsRefreshing(
          false
        );
      };
    }, [loadPage])
  );

  const loadMore =
    useCallback(
      async () => {
        if (
          !userId ||
          firstPagePendingRef.current ||
          loadMorePendingRef.current ||
          !cursor ||
          !hasMore
        ) {
          return;
        }

        loadMorePendingRef.current =
          true;

        setIsLoadingMore(
          true
        );

        setErrorMessage(
          null
        );

        const requestId =
          requestIdRef.current;

        const activeCursor =
          cursor;

        try {
          const page =
            await getFollowedOrganizationsPage(
              activeCursor
            );

          if (
            requestIdRef.current !==
              requestId ||
            activeUserIdRef.current !==
              userId
          ) {
            return;
          }

          setOrganizations(
            (
              current
            ) => {
              const existingIds =
                new Set(
                  current.map(
                    (
                      organization
                    ) =>
                      organization.id
                  )
                );

              const newOrganizations =
                page.organizations.filter(
                  (
                    organization
                  ) =>
                    !existingIds.has(
                      organization.id
                    ) &&
                    !pendingIdsRef.current.has(
                      organization.id
                    )
                );

              return [
                ...current,
                ...newOrganizations,
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
            requestIdRef.current !==
              requestId ||
            activeUserIdRef.current !==
              userId
          ) {
            return;
          }

          console.warn(
            '[following] Could not load more organizations.',
            error
          );

          setErrorMessage(
            'More organizations could not be loaded. Pull down to retry.'
          );
        } finally {
          if (
            requestIdRef.current ===
              requestId &&
            activeUserIdRef.current ===
              userId
          ) {
            loadMorePendingRef.current =
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
        userId,
      ]
    );

  const unfollow =
    useCallback(
      async (
        organization:
          FollowedOrganization
      ) => {
        if (
          !userId ||
          pendingIdsRef.current.has(
            organization.id
          )
        ) {
          return;
        }

        const previousIndex =
          organizations.findIndex(
            (
              item
            ) =>
              item.id ===
              organization.id
          );

        /*
         * Invalidate any page request
         * already using a server snapshot
         * from before this optimistic
         * unfollow.
         *
         * Otherwise an in-flight
         * pagination/refresh response
         * could reinsert the organization
         * after we remove it locally.
         */
        requestIdRef.current +=
          1;

        firstPagePendingRef.current =
          false;

        loadMorePendingRef.current =
          false;

        setIsRefreshing(
          false
        );

        setIsLoadingMore(
          false
        );

        pendingIdsRef.current.add(
          organization.id
        );

        setPendingIds(
          (
            current
          ) =>
            new Set(
              current
            ).add(
              organization.id
            )
        );

        setOrganizations(
          (
            current
          ) =>
            current.filter(
              (
                item
              ) =>
                item.id !==
                organization.id
            )
        );

        setErrorMessage(
          null
        );

        try {
          await setOrganizationFollow({
            isFollowed:
              false,

            organizationId:
              organization.id,

            userId,
          });
        } catch (error) {
          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          console.warn(
            '[following] Could not unfollow organization.',
            error
          );

          setOrganizations(
            (
              current
            ) => {
              if (
                current.some(
                  (
                    item
                  ) =>
                    item.id ===
                    organization.id
                )
              ) {
                return current;
              }

              const next =
                [
                  ...current,
                ];

              const insertionIndex =
                Math.min(
                  Math.max(
                    0,
                    previousIndex
                  ),
                  next.length
                );

              next.splice(
                insertionIndex,
                0,
                organization
              );

              return next;
            }
          );

          setErrorMessage(
            'We could not unfollow this organization. Try again.'
          );
        } finally {
          /*
           * Check account identity before
           * touching the shared lock.
           *
           * Account A's request must not
           * clear Account B's pending
           * state for the same
           * organization.
           */
          if (
            activeUserIdRef.current !==
            userId
          ) {
            return;
          }

          pendingIdsRef.current.delete(
            organization.id
          );

          setPendingIds(
            (
              current
            ) => {
              const next =
                new Set(
                  current
                );

              next.delete(
                organization.id
              );

              return next;
            }
          );
        }
      },
      [
        organizations,
        userId,
      ]
    );

  /*
   * Account changes render once before
   * the reset effect executes.
   *
   * Do not expose the previous
   * account's following list during
   * that render.
   */
  const isCurrentUserState =
    stateUserId ===
    userId;

  const displayedOrganizations =
    isCurrentUserState
      ? organizations
      : [];

  const displayedErrorMessage =
    isCurrentUserState
      ? errorMessage
      : null;

  const displayedStatus:
    PageStatus =
      isCurrentUserState
        ? status
        : 'loading';

  return (
    <SafeAreaScreen
      style={
        styles.safeArea
      }
    >
      <ScreenHeader
        title="Following"
      />

      {displayedStatus ===
      'loading' ? (
        <FollowingSkeleton />
      ) : displayedStatus ===
          'error' &&
        displayedOrganizations.length ===
          0 ? (
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
            Could not load Following
          </Text>

          <Text
            style={
              styles.stateMessage
            }
          >
            {
              displayedErrorMessage
            }
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void loadPage()
            }
            style={({
              pressed,
            }) => [
              styles.retryButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.retryLabel
              }
            >
              Try again
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[
            styles.list,

            displayedOrganizations.length ===
              0 &&
              styles.emptyList,
          ]}
          data={
            displayedOrganizations
          }
          keyExtractor={(
            organization
          ) =>
            organization.id
          }
          ListEmptyComponent={
            <View
              style={
                styles.empty
              }
            >
              <Text
                style={
                  styles.stateTitle
                }
              >
                You&apos;re not following any organizations yet.
              </Text>

              <Text
                style={
                  styles.stateMessage
                }
              >
                Explore campus organizations to stay updated.
              </Text>

              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  router.push(
                    '/(tabs)/explore'
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.exploreLink,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.exploreLabel
                  }
                >
                  Explore organizations
                </Text>

                <SymbolView
                  name={{
                    android:
                      'arrow_forward',

                    ios:
                      'arrow.right',

                    web:
                      'arrow_forward',
                  }}
                  size={
                    16
                  }
                  tintColor={
                    colors.textPrimary
                  }
                />
              </Pressable>
            </View>
          }
          ListFooterComponent={
            isCurrentUserState &&
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
                void loadPage(
                  true
                )
              }
              progressBackgroundColor={
                colors.surfaceElevated
              }
              refreshing={
                isCurrentUserState &&
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
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname:
                    '/organization/[id]',

                  params: {
                    id:
                      item.id,
                  },
                })
              }
              style={({
                pressed,
              }) => [
                styles.row,

                pressed &&
                  styles.rowPressed,
              ]}
            >
              <OrganizationAvatar
                name={
                  item.name
                }
                size={
                  52
                }
                uri={
                  item.avatarUrl
                }
              />

              <View
                style={
                  styles.rowCopy
                }
              >
                <View
                  style={
                    styles.rowNameLine
                  }
                >
                  <Text
                    numberOfLines={
                      1
                    }
                    style={
                      styles.rowName
                    }
                  >
                    {
                      item.name
                    }
                  </Text>

                  {item.isVerified ? (
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
                        15
                      }
                      tintColor={
                        colors.success
                      }
                    />
                  ) : null}
                </View>

                <Text
                  numberOfLines={
                    1
                  }
                  style={
                    styles.rowMeta
                  }
                >
                  Club ·{' '}
                  {
                    item.campusShortName
                  }
                </Text>
              </View>

              <Pressable
                accessibilityLabel={`Unfollow ${item.name}`}
                accessibilityRole="button"
                disabled={
                  pendingIds.has(
                    item.id
                  )
                }
                onPress={(
                  event
                ) => {
                  event.stopPropagation();

                  void unfollow(
                    item
                  );
                }}
                style={({
                  pressed,
                }) => [
                  styles.followingButton,

                  pressed &&
                    styles.pressed,
                ]}
              >
                {pendingIds.has(
                  item.id
                ) ? (
                  <ActivityIndicator
                    color={
                      colors.textPrimary
                    }
                    size="small"
                  />
                ) : (
                  <Text
                    style={
                      styles.followingLabel
                    }
                  >
                    Following
                  </Text>
                )}
              </Pressable>
            </Pressable>
          )}
          showsVerticalScrollIndicator={
            false
          }
        />
      )}

      {displayedErrorMessage &&
      displayedStatus !==
        'error' ? (
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
    </SafeAreaScreen>
  );
}

function FollowingSkeleton() {
  const { styles } =
    useThemedStyles(
      createStyles
    );

  return (
    <View
      accessibilityLabel="Loading followed organizations"
      style={
        styles.skeleton
      }
    >
      {[0, 1, 2, 3].map(
        (
          item
        ) => (
          <View
            key={
              item
            }
            style={
              styles.skeletonRow
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
                styles.skeletonCopy
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

            <View
              style={[
                styles.skeletonBlock,
                styles.skeletonButton,
              ]}
            />
          </View>
        )
      )}
    </View>
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

    list: {
      paddingHorizontal:
        spacing.md,

      paddingBottom:
        spacing.xxl,
    },

    emptyList: {
      flexGrow: 1,
    },

    row: {
      minHeight: 76,

      paddingVertical: 12,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 12,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.borderSubtle,
    },

    rowPressed: {
      backgroundColor:
        colors.surfaceMuted,
    },

    rowCopy: {
      flex: 1,

      minWidth: 0,
    },

    rowNameLine: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 5,
    },

    rowName: {
      flexShrink: 1,

      fontSize: 14,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    rowMeta: {
      marginTop: 4,

      fontSize: 12,

      color:
        colors.textSecondary,
    },

    followingButton: {
      minWidth: 78,

      minHeight: 36,

      paddingHorizontal: 14,

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

    followingLabel: {
      fontSize: 12,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    state: {
      flex: 1,

      padding:
        spacing.lg,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    empty: {
      flex: 1,

      padding:
        spacing.xl,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    stateTitle: {
      maxWidth: 320,

      textAlign:
        'center',

      fontSize: 19,

      lineHeight: 25,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    stateMessage: {
      maxWidth: 310,

      marginTop:
        spacing.sm,

      textAlign:
        'center',

      fontSize: 14,

      lineHeight: 21,

      color:
        colors.textSecondary,
    },

    retryButton: {
      minHeight: 44,

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
        colors.textPrimary,
    },

    retryLabel: {
      fontSize: 13,

      fontWeight:
        '700',

      color:
        colors.white,
    },

    exploreLink: {
      minHeight: 44,

      marginTop:
        spacing.md,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.sm,
    },

    exploreLabel: {
      fontSize: 14,

      fontWeight:
        '700',

      color:
        colors.textPrimary,
    },

    inlineError: {
      paddingHorizontal:
        spacing.md,

      paddingVertical:
        spacing.sm,

      textAlign:
        'center',

      fontSize: 12,

      color:
        colors.danger,

      backgroundColor:
        colors.dangerSoft,
    },

    loader: {
      marginVertical:
        spacing.lg,
    },

    pressed: {
      opacity: 0.58,
    },

    skeleton: {
      paddingHorizontal:
        spacing.md,
    },

    skeletonRow: {
      minHeight: 76,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 12,
    },

    skeletonBlock: {
      backgroundColor:
        colors.border,

      borderRadius:
        radius.sm,
    },

    skeletonAvatar: {
      width: 52,

      height: 52,

      borderRadius:
        radius.md,
    },

    skeletonCopy: {
      flex: 1,
    },

    skeletonName: {
      width:
        '72%',

      height: 12,
    },

    skeletonMeta: {
      width:
        '46%',

      height: 9,

      marginTop:
        spacing.sm,
    },

    skeletonButton: {
      width: 78,

      height: 36,
    },
  });