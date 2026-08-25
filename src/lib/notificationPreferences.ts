import type { Tables, TablesInsert } from '../types/database';
import { supabase } from './supabase';

export type NotificationPreferences = Pick<
  Tables<'notification_preferences'>,
  'badges_enabled' | 'comments_enabled' | 'events_enabled' | 'likes_enabled'
>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  badges_enabled: true,
  comments_enabled: true,
  events_enabled: true,
  likes_enabled: true,
};

export async function getNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('likes_enabled, comments_enabled, badges_enabled, events_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences
) {
  const row: TablesInsert<'notification_preferences'> = {
    ...preferences,
    user_id: userId,
  };
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(row, { onConflict: 'user_id' });

  if (error) {
    throw error;
  }
}
