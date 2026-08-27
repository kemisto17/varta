import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  NotificationContextValue,
  NotificationStatus,
} from '../contexts/NotificationContext';
import { NotificationContext } from '../contexts/NotificationContext';
import { useAuth } from '../hooks/useAuth';
import { useVerification } from '../hooks/useVerification';
import {
  getNotificationErrorMessage,
  getNotificationsPage,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationCursor,
} from '../lib/notifications';
import {
  registerForPushNotifications,
  subscribeToPushNotificationResponses,
  subscribeToPushTokenChanges,
} from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';

export function NotificationsProvider({
  children,
}: PropsWithChildren) {
  const router = useRouter();

  const { session } = useAuth();

  const {
    status: verificationStatus,
  } = useVerification();

  const userId =
    session?.user.id ?? null;

  const canLoadNotifications =
    userId !== null &&
    verificationStatus ===
      'verified';

  const canUsePush =
    userId !== null &&
    verificationStatus !==
      'idle' &&
    verificationStatus !==
      'loading';

  /*
   * Request/version refs.
   */
  const requestId =
    useRef(0);

  const cursorRef =
    useRef<
      NotificationCursor | null
    >(null);

  const hasMoreRef =
    useRef(false);

  const hasLoadedRef =
    useRef(false);

  const loadingMoreRef =
    useRef(false);

  /*
   * Keep the latest notification
   * collection available to async
   * callbacks without depending on
   * stale React closures.
   */
  const notificationsRef =
    useRef<
      AppNotification[]
    >([]);

  /*
   * Prevent duplicate read mutations
   * from rapid taps.
   */
  const markingReadIdsRef =
    useRef(
      new Set<string>()
    );

  const markingAllReadRef =
    useRef(false);

  /*
   * Realtime inserts that arrive while
   * page 1 is being refreshed are kept
   * here so the completed page request
   * cannot accidentally overwrite
   * them.
   */
  const refreshBufferRef =
    useRef(
      new Map<
        string,
        AppNotification
      >()
    );

  const activeRefreshRequestRef =
    useRef<
      number | null
    >(null);

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      AppNotification[]
    >([]);

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const [
    status,
    setStatus,
  ] =
    useState<NotificationStatus>(
      'idle'
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
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const loadInitial =
    useCallback(
      async (
        showRefreshState =
          false
      ) => {
        if (
          !userId ||
          verificationStatus !==
            'verified'
        ) {
          return;
        }

        const activeRequestId =
          requestId.current +
          1;

        requestId.current =
          activeRequestId;

        activeRefreshRequestRef.current =
          activeRequestId;

        refreshBufferRef.current =
          new Map();

        const hasLoaded =
          hasLoadedRef.current;

        if (
          hasLoaded &&
          showRefreshState
        ) {
          setIsRefreshing(
            true
          );
        } else if (
          !hasLoaded
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
            page,
            nextUnreadCount,
          ] =
            await Promise.all([
              getNotificationsPage(
                userId
              ),

              getUnreadNotificationCount(
                userId
              ),
            ]);

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          /*
           * A notification may have been
           * inserted after the page query
           * started.
           *
           * Merge any realtime arrivals
           * so refreshing page 1 cannot
           * make them disappear.
           */
          const buffered =
            [
              ...refreshBufferRef.current.values(),
            ];

          const merged =
            mergeNotifications(
              page.notifications,
              buffered
            );

          notificationsRef.current =
            merged;

          cursorRef.current =
            page.cursor;

          hasMoreRef.current =
            page.hasMore;

          hasLoadedRef.current =
            true;

          setNotifications(
            merged
          );

          setHasMore(
            page.hasMore
          );

          /*
           * The exact unread count came
           * from the DB. Add unread
           * realtime rows that arrived
           * while that count request was
           * in progress only when they
           * were not already represented
           * by the fetched page/count
           * snapshot.
           *
           * Realtime UPDATE events below
           * will keep subsequent state in
           * sync.
           */
          setUnreadCount(
            nextUnreadCount
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
            '[notifications] Could not load notifications.',
            error
          );

          setErrorMessage(
            getNotificationErrorMessage()
          );

          /*
           * Keep already-loaded
           * notifications visible when
           * a background refresh fails.
           */
          setStatus(
            hasLoaded
              ? 'ready'
              : 'error'
          );
        } finally {
          if (
            requestId.current ===
            activeRequestId
          ) {
            activeRefreshRequestRef.current =
              null;

            refreshBufferRef.current.clear();

            setIsRefreshing(
              false
            );
          }
        }
      },
      [
        userId,
        verificationStatus,
      ]
    );

  useEffect(() => {
    if (
      !canLoadNotifications ||
      !userId
    ) {
      requestId.current += 1;

      cursorRef.current =
        null;

      hasMoreRef.current =
        false;

      hasLoadedRef.current =
        false;

      loadingMoreRef.current =
        false;

      notificationsRef.current =
        [];

      markingReadIdsRef.current.clear();

      markingAllReadRef.current =
        false;

      activeRefreshRequestRef.current =
        null;

      refreshBufferRef.current.clear();

      setNotifications(
        []
      );

      setUnreadCount(
        0
      );

      setStatus(
        'idle'
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

      return;
    }

    void loadInitial();

    const channel =
      supabase
        .channel(
          `user-notifications:${userId}`
        )

        /*
         * New notification.
         */
        .on<AppNotification>(
          'postgres_changes',
          {
            event:
              'INSERT',

            filter:
              `recipient_id=eq.${userId}`,

            schema:
              'public',

            table:
              'notifications',
          },
          (payload) => {
            const notification =
              payload.new;

            if (
              notification.recipient_id !==
              userId
            ) {
              return;
            }

            /*
             * Preserve this notification
             * if a page-1 refresh is
             * currently in flight.
             */
            if (
              activeRefreshRequestRef.current !==
              null
            ) {
              refreshBufferRef.current.set(
                notification.id,
                notification
              );
            }

            if (
              notificationsRef.current.some(
                (item) =>
                  item.id ===
                  notification.id
              )
            ) {
              return;
            }

            const nextNotifications =
              [
                notification,
                ...notificationsRef.current,
              ];

            notificationsRef.current =
              nextNotifications;

            setNotifications(
              nextNotifications
            );

            if (
              notification.read_at ===
              null
            ) {
              setUnreadCount(
                (current) =>
                  current + 1
              );
            }
          }
        )

        /*
         * Read state can change through
         * our own mutation or another
         * signed-in device.
         *
         * Listen for updates so the
         * unread badge remains correct.
         */
        .on<AppNotification>(
          'postgres_changes',
          {
            event:
              'UPDATE',

            filter:
              `recipient_id=eq.${userId}`,

            schema:
              'public',

            table:
              'notifications',
          },
          (payload) => {
            const updated =
              payload.new;

            const existing =
              notificationsRef.current.find(
                (item) =>
                  item.id ===
                  updated.id
              );

            if (!existing) {
              return;
            }

            const wasUnread =
              existing.read_at ===
              null;

            const isUnread =
              updated.read_at ===
              null;

            const nextNotifications =
              notificationsRef.current.map(
                (item) =>
                  item.id ===
                  updated.id
                    ? {
                        ...item,
                        ...updated,
                      }
                    : item
              );

            notificationsRef.current =
              nextNotifications;

            setNotifications(
              nextNotifications
            );

            if (
              wasUnread &&
              !isUnread
            ) {
              setUnreadCount(
                (current) =>
                  Math.max(
                    0,
                    current - 1
                  )
              );
            } else if (
              !wasUnread &&
              isUnread
            ) {
              setUnreadCount(
                (current) =>
                  current + 1
              );
            }
          }
        )
        .subscribe();

    return () => {
      requestId.current += 1;

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    canLoadNotifications,
    loadInitial,
    userId,
  ]);

  /*
   * Push token registration.
   */
  useEffect(() => {
    if (
      !canUsePush ||
      !userId
    ) {
      return;
    }

    let isActive =
      true;

    let removeTokenListener:
      | (() => void)
      | undefined;

    void registerForPushNotifications(
      userId
    ).then(
      async (result) => {
        if (
          !isActive ||
          result.status !==
            'registered'
        ) {
          return;
        }

        const removeListener =
          await subscribeToPushTokenChanges(
            userId
          );

        if (!isActive) {
          removeListener();

          return;
        }

        removeTokenListener =
          removeListener;
      }
    );

    return () => {
      isActive =
        false;

      removeTokenListener?.();
    };
  }, [
    canUsePush,
    userId,
  ]);

  /*
   * Push notification tap routing.
   */
  useEffect(() => {
    if (!canUsePush) {
      return;
    }

    let isActive =
      true;

    let removeResponseListener:
      | (() => void)
      | undefined;

    void subscribeToPushNotificationResponses(
      (destination) => {
        if (isActive) {
          router.push(
            destination
          );
        }
      }
    )
      .then(
        (
          removeListener
        ) => {
          if (!isActive) {
            removeListener();

            return;
          }

          removeResponseListener =
            removeListener;
        }
      )
      .catch(
        (
          error: unknown
        ) => {
          console.warn(
            '[push] Could not listen for notification taps.',
            error
          );
        }
      );

    return () => {
      isActive =
        false;

      removeResponseListener?.();
    };
  }, [
    canUsePush,
    router,
  ]);

  const refreshNotifications =
    useCallback(
      () =>
        loadInitial(
          hasLoadedRef.current
        ),
      [loadInitial]
    );

  const loadMore =
    useCallback(
      async () => {
        if (
          !userId ||
          !hasMoreRef.current ||
          loadingMoreRef.current ||
          !cursorRef.current
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

        /*
         * Do not increment requestId.
         *
         * A refresh/account reset that
         * happens during pagination will
         * increment it and invalidate
         * this response.
         */
        const activeRequestId =
          requestId.current;

        const activeCursor =
          cursorRef.current;

        try {
          const page =
            await getNotificationsPage(
              userId,
              activeCursor
            );

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          const existingIds =
            new Set(
              notificationsRef.current.map(
                (item) =>
                  item.id
              )
            );

          const newNotifications =
            page.notifications.filter(
              (item) =>
                !existingIds.has(
                  item.id
                )
            );

          const nextNotifications =
            [
              ...notificationsRef.current,
              ...newNotifications,
            ];

          notificationsRef.current =
            nextNotifications;

          cursorRef.current =
            page.cursor;

          hasMoreRef.current =
            page.hasMore;

          setNotifications(
            nextNotifications
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
              '[notifications] Could not load more notifications.',
              error
            );

            setErrorMessage(
              'We could not load older notifications. Pull down to try again.'
            );
          }
        } finally {
          /*
           * Only clear pagination state
           * if this request still
           * belongs to the current
           * provider state.
           */
          if (
            requestId.current ===
            activeRequestId
          ) {
            loadingMoreRef.current =
              false;

            setIsLoadingMore(
              false
            );
          }
        }
      },
      [userId]
    );

  const markRead =
    useCallback(
      async (
        notificationId:
          string
      ) => {
        if (
          !userId ||
          markingReadIdsRef.current.has(
            notificationId
          )
        ) {
          return;
        }

        const notification =
          notificationsRef.current.find(
            (item) =>
              item.id ===
              notificationId
          );

        if (
          !notification ||
          notification.read_at !==
            null
        ) {
          return;
        }

        markingReadIdsRef.current.add(
          notificationId
        );

        const readAt =
          new Date().toISOString();

        const nextNotifications =
          notificationsRef.current.map(
            (item) =>
              item.id ===
              notificationId
                ? {
                    ...item,
                    read_at:
                      readAt,
                  }
                : item
          );

        notificationsRef.current =
          nextNotifications;

        setNotifications(
          nextNotifications
        );

        setUnreadCount(
          (current) =>
            Math.max(
              0,
              current - 1
            )
        );

        try {
          await markNotificationRead(
            notificationId,
            userId,
            readAt
          );
        } catch (error) {
          console.warn(
            '[notifications] Could not mark notification read.',
            error
          );

          /*
           * Only roll back if this exact
           * optimistic read state is
           * still present.
           */
          const latest =
            notificationsRef.current.find(
              (item) =>
                item.id ===
                notificationId
            );

          if (
            latest?.read_at ===
            readAt
          ) {
            const rolledBack =
              notificationsRef.current.map(
                (item) =>
                  item.id ===
                  notificationId
                    ? {
                        ...item,
                        read_at:
                          null,
                      }
                    : item
              );

            notificationsRef.current =
              rolledBack;

            setNotifications(
              rolledBack
            );

            setUnreadCount(
              (current) =>
                current + 1
            );
          }

          throw error;
        } finally {
          markingReadIdsRef.current.delete(
            notificationId
          );
        }
      },
      [userId]
    );

  const markAllRead =
    useCallback(
      async () => {
        if (
          !userId ||
          markingAllReadRef.current
        ) {
          return;
        }

        const unreadIds =
          new Set(
            notificationsRef.current
              .filter(
                (
                  notification
                ) =>
                  notification.read_at ===
                  null
              )
              .map(
                (
                  notification
                ) =>
                  notification.id
              )
          );

        /*
         * unreadCount may include older
         * unloaded notifications, so do
         * not skip the DB mutation merely
         * because the currently loaded
         * page has no unread IDs.
         */
        markingAllReadRef.current =
          true;

        const readAt =
          new Date().toISOString();

        const nextNotifications =
          notificationsRef.current.map(
            (
              notification
            ) =>
              unreadIds.has(
                notification.id
              )
                ? {
                    ...notification,
                    read_at:
                      readAt,
                  }
                : notification
          );

        notificationsRef.current =
          nextNotifications;

        setNotifications(
          nextNotifications
        );

        setUnreadCount(
          0
        );

        try {
          await markAllNotificationsRead(
            userId,
            readAt
          );
        } catch (error) {
          console.warn(
            '[notifications] Could not mark all notifications read.',
            error
          );

          let rollbackCount =
            0;

          const rolledBack =
            notificationsRef.current.map(
              (
                notification
              ) => {
                if (
                  unreadIds.has(
                    notification.id
                  ) &&
                  notification.read_at ===
                    readAt
                ) {
                  rollbackCount +=
                    1;

                  return {
                    ...notification,
                    read_at:
                      null,
                  };
                }

                return notification;
              }
            );

          notificationsRef.current =
            rolledBack;

          setNotifications(
            rolledBack
          );

          /*
           * Add only the rows we actually
           * rolled back. This avoids
           * destroying unread realtime
           * notifications that may have
           * arrived while the request was
           * in flight.
           */
          setUnreadCount(
            (current) =>
              current +
              rollbackCount
          );

          throw error;
        } finally {
          markingAllReadRef.current =
            false;
        }
      },
      [userId]
    );

  const value =
    useMemo<NotificationContextValue>(
      () => ({
        errorMessage,
        hasMore,
        isLoadingMore,
        isRefreshing,
        loadMore,
        markAllRead,
        markRead,
        notifications,
        refreshNotifications,
        status,
        unreadCount,
      }),
      [
        errorMessage,
        hasMore,
        isLoadingMore,
        isRefreshing,
        loadMore,
        markAllRead,
        markRead,
        notifications,
        refreshNotifications,
        status,
        unreadCount,
      ]
    );

  return (
    <NotificationContext.Provider
      value={value}
    >
      {children}
    </NotificationContext.Provider>
  );
}

function mergeNotifications(
  primary: AppNotification[],
  secondary: AppNotification[]
) {
  const byId =
    new Map<
      string,
      AppNotification
    >();

  for (
    const notification
    of primary
  ) {
    byId.set(
      notification.id,
      notification
    );
  }

  for (
    const notification
    of secondary
  ) {
    if (
      !byId.has(
        notification.id
      )
    ) {
      byId.set(
        notification.id,
        notification
      );
    }
  }

  return [
    ...byId.values(),
  ].sort(
    (
      left,
      right
    ) => {
      const timeDifference =
        Date.parse(
          right.created_at
        ) -
        Date.parse(
          left.created_at
        );

      if (
        timeDifference !==
        0
      ) {
        return timeDifference;
      }

      return right.id.localeCompare(
        left.id
      );
    }
  );
}