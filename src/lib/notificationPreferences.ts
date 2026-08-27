import type {
  Tables,
  TablesInsert,
} from '../types/database';
import { supabase } from './supabase';

export type NotificationPreferences =
  Pick<
    Tables<'notification_preferences'>,
    | 'badges_enabled'
    | 'comments_enabled'
    | 'events_enabled'
    | 'likes_enabled'
  >;

export const DEFAULT_NOTIFICATION_PREFERENCES:
  NotificationPreferences = {
    badges_enabled: true,
    comments_enabled: true,
    events_enabled: true,
    likes_enabled: true,
  };

export async function getNotificationPreferences(
  userId: string
) {
  const {
    data,
    error,
  } = await supabase
    .from(
      'notification_preferences'
    )
    .select(
      'likes_enabled, comments_enabled, badges_enabled, events_enabled'
    )
    .eq(
      'user_id',
      userId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data ??
    DEFAULT_NOTIFICATION_PREFERENCES
  );
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences
) {
  /*
   * Try updating first.
   *
   * We intentionally do not use upsert here.
   * The notification_preferences table gives
   * authenticated users UPDATE permission only
   * on the four preference columns, not user_id.
   *
   * Supabase upsert includes user_id in the
   * INSERT ... ON CONFLICT DO UPDATE statement,
   * which requires UPDATE permission on user_id
   * and causes PostgreSQL error 42501.
   */
  const {
    data: updatedRow,
    error: updateError,
  } = await supabase
    .from(
      'notification_preferences'
    )
    .update(
      preferences
    )
    .eq(
      'user_id',
      userId
    )
    .select(
      'user_id'
    )
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  /*
   * Preference row already existed.
   */
  if (updatedRow) {
    return;
  }

  /*
   * No preference row exists yet.
   * Create the user's own row.
   */
  const row:
    TablesInsert<'notification_preferences'> =
    {
      ...preferences,
      user_id: userId,
    };

  const {
    error: insertError,
  } = await supabase
    .from(
      'notification_preferences'
    )
    .insert(
      row
    );

  if (!insertError) {
    return;
  }

  /*
   * Two clients could theoretically create
   * the first preference row simultaneously.
   *
   * If another request inserted it between
   * our UPDATE and INSERT, PostgreSQL returns
   * a unique-key conflict. Retry the safe
   * preference-only UPDATE.
   */
  if (
    insertError.code ===
    '23505'
  ) {
    const {
      error: retryError,
    } = await supabase
      .from(
        'notification_preferences'
      )
      .update(
        preferences
      )
      .eq(
        'user_id',
        userId
      );

    if (retryError) {
      throw retryError;
    }

    return;
  }

  throw insertError;
}