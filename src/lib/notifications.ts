import type { Tables } from '../types/database';
import { supabase } from './supabase';

export const NOTIFICATION_PAGE_SIZE = 25;

export type AppNotification = Tables<'notifications'>;

export type NotificationCursor = Pick<AppNotification, 'created_at' | 'id'>;

export type NotificationPage = {
  cursor: NotificationCursor | null;
  hasMore: boolean;
  notifications: AppNotification[];
};

export async function getNotificationsPage(
  userId: string,
  cursor: NotificationCursor | null = null
): Promise<NotificationPage> {
  let query = supabase
    .from('notifications')
    .select(
      'id, recipient_id, actor_id, type, post_id, comment_id, badge_id, title, body, read_at, created_at'
    )
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(NOTIFICATION_PAGE_SIZE + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const hasMore = data.length > NOTIFICATION_PAGE_SIZE;
  const notifications = data.slice(0, NOTIFICATION_PAGE_SIZE);
  const lastNotification = notifications.at(-1);

  return {
    cursor: lastNotification
      ? {
          created_at: lastNotification.created_at,
          id: lastNotification.id,
        }
      : null,
    hasMore,
    notifications,
  };
}

export async function getUnreadNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
  readAt: string
) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: readAt })
    .eq('id', notificationId)
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsRead(
  userId: string,
  readAt: string
) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: readAt })
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }
}

export function getNotificationErrorMessage() {
  return 'We could not load your notifications. Check your connection and try again.';
}
