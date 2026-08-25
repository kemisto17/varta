import type { Href } from 'expo-router';

type NotificationData = Record<string, unknown>;

export function getPushNotificationDestination(
  data: NotificationData | undefined
): Href | null {
  if (!data) {
    return null;
  }

  const type = typeof data.type === 'string' ? data.type : null;
  const postId = getIdentifier(data.postId);
  const eventId = getIdentifier(data.eventId);
  const profileId = getIdentifier(data.profileId);

  if ((type === 'post_like' || type === 'post_comment') && postId) {
    return { pathname: '/post/[id]', params: { id: postId } };
  }

  if (type === 'event_cancelled' && eventId) {
    return { pathname: '/event/[id]', params: { id: eventId } };
  }

  if (type === 'profile_follow' && profileId) {
    return { pathname: '/user/[id]', params: { id: profileId } };
  }

  if (type === 'verification_approved' || type === 'badge_assigned') {
    return '/(tabs)/profile';
  }

  return getIdentifier(data.notificationId) ? '/notifications' : null;
}

function getIdentifier(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
