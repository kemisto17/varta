import { createContext } from 'react';

import type { AppNotification } from '../lib/notifications';

export type NotificationStatus = 'idle' | 'loading' | 'ready' | 'error';

export type NotificationContextValue = {
  errorMessage: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  loadMore: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  notifications: AppNotification[];
  refreshNotifications: () => Promise<void>;
  status: NotificationStatus;
  unreadCount: number;
};

export const NotificationContext = createContext<
  NotificationContextValue | undefined
>(undefined);
