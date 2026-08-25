import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

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

export function NotificationsProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { session } = useAuth();
  const { status: verificationStatus } = useVerification();
  const userId = session?.user.id ?? null;
  const canLoadNotifications =
    userId !== null && verificationStatus === 'verified';
  const requestId = useRef(0);
  const cursorRef = useRef<NotificationCursor | null>(null);
  const loadingMoreRef = useRef(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<NotificationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadInitial = useCallback(
    async (showRefreshState = false) => {
      if (!userId || verificationStatus !== 'verified') {
        return;
      }

      const activeRequestId = requestId.current + 1;
      requestId.current = activeRequestId;

      if (showRefreshState) {
        setIsRefreshing(true);
      } else {
        setStatus('loading');
      }

      setErrorMessage(null);

      try {
        const [page, nextUnreadCount] = await Promise.all([
          getNotificationsPage(userId),
          getUnreadNotificationCount(userId),
        ]);

        if (requestId.current !== activeRequestId) {
          return;
        }

        cursorRef.current = page.cursor;
        setNotifications(page.notifications);
        setHasMore(page.hasMore);
        setUnreadCount(nextUnreadCount);
        setStatus('ready');
      } catch (error) {
        if (requestId.current !== activeRequestId) {
          return;
        }

        console.warn('[notifications] Could not load notifications.', error);
        setStatus('error');
        setErrorMessage(getNotificationErrorMessage());
      } finally {
        if (requestId.current === activeRequestId) {
          setIsRefreshing(false);
        }
      }
    },
    [userId, verificationStatus]
  );

  useEffect(() => {
    if (!canLoadNotifications || !userId) {
      requestId.current += 1;
      cursorRef.current = null;
      loadingMoreRef.current = false;
      setNotifications([]);
      setUnreadCount(0);
      setStatus('idle');
      setErrorMessage(null);
      setHasMore(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
      return;
    }

    void loadInitial();

    const channel = supabase
      .channel(`user-notifications:${userId}`)
      .on<AppNotification>(
        'postgres_changes',
        {
          event: 'INSERT',
          filter: `recipient_id=eq.${userId}`,
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const notification = payload.new;

          if (notification.recipient_id !== userId) {
            return;
          }

          setNotifications((current) => {
            if (current.some((item) => item.id === notification.id)) {
              return current;
            }

            return [notification, ...current];
          });

          if (notification.read_at === null) {
            setUnreadCount((current) => current + 1);
          }
        }
      )
      .subscribe();

    return () => {
      requestId.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [canLoadNotifications, loadInitial, userId]);

  useEffect(() => {
    if (!canLoadNotifications || !userId) {
      return;
    }

    let isActive = true;
    let removeTokenListener: (() => void) | undefined;

    void registerForPushNotifications(userId).then(async (result) => {
      if (!isActive || result.status !== 'registered') {
        return;
      }

      const removeListener = await subscribeToPushTokenChanges(userId);

      if (!isActive) {
        removeListener();
        return;
      }

      removeTokenListener = removeListener;
    });

    return () => {
      isActive = false;
      removeTokenListener?.();
    };
  }, [canLoadNotifications, userId]);

  useEffect(() => {
    if (!canLoadNotifications) {
      return;
    }

    let isActive = true;
    let removeResponseListener: (() => void) | undefined;

    void subscribeToPushNotificationResponses((destination) => {
      if (isActive) {
        router.push(destination);
      }
    })
      .then((removeListener) => {
        if (!isActive) {
          removeListener();
          return;
        }

        removeResponseListener = removeListener;
      })
      .catch((error: unknown) => {
        console.warn('[push] Could not listen for notification taps.', error);
      });

    return () => {
      isActive = false;
      removeResponseListener?.();
    };
  }, [canLoadNotifications, router]);

  const refreshNotifications = useCallback(
    () => loadInitial(status === 'ready'),
    [loadInitial, status]
  );

  const loadMore = useCallback(async () => {
    if (
      !userId ||
      !hasMore ||
      loadingMoreRef.current ||
      !cursorRef.current
    ) {
      return;
    }

    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const page = await getNotificationsPage(userId, cursorRef.current);
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
      setNotifications((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...page.notifications.filter((item) => !existingIds.has(item.id)),
        ];
      });
    } catch (error) {
      console.warn('[notifications] Could not load more notifications.', error);
      setErrorMessage(
        'We could not load older notifications. Pull down to try again.'
      );
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, userId]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!userId) {
        return;
      }

      const notification = notifications.find(
        (item) => item.id === notificationId
      );

      if (!notification || notification.read_at !== null) {
        return;
      }

      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read_at: readAt } : item
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        await markNotificationRead(notificationId, userId, readAt);
      } catch (error) {
        console.warn('[notifications] Could not mark notification read.', error);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId ? { ...item, read_at: null } : item
          )
        );
        setUnreadCount((current) => current + 1);
        throw error;
      }
    },
    [notifications, userId]
  );

  const markAllRead = useCallback(async () => {
    if (!userId || unreadCount === 0) {
      return;
    }

    const readAt = new Date().toISOString();
    const unreadIds = new Set(
      notifications
        .filter((notification) => notification.read_at === null)
        .map((notification) => notification.id)
    );
    const previousUnreadCount = unreadCount;

    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.has(notification.id)
          ? { ...notification, read_at: readAt }
          : notification
      )
    );
    setUnreadCount(0);

    try {
      await markAllNotificationsRead(userId, readAt);
    } catch (error) {
      console.warn('[notifications] Could not mark all notifications read.', error);
      setNotifications((current) =>
        current.map((notification) =>
          unreadIds.has(notification.id)
            ? { ...notification, read_at: null }
            : notification
        )
      );
      setUnreadCount(previousUnreadCount);
      throw error;
    }
  }, [notifications, unreadCount, userId]);

  const value = useMemo<NotificationContextValue>(
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
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
