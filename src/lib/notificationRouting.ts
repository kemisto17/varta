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
  const organizationId = getIdentifier(data.organizationId);
  const userId = getIdentifier(data.userId);

  if ((type === 'post_like' || type === 'post_comment') && postId) {
    return { pathname: '/post/[id]', params: { id: postId } };
  }

  if ((type === 'event_cancelled' || type === 'event_updated') && eventId) {
    return { pathname: '/event/[id]', params: { id: eventId } };
  }

  if (type === 'organization_role_assigned' && organizationId) {
    return { pathname: '/organization/[id]', params: { id: organizationId } };
  }

  if (type === 'badge_assigned' && userId) {
    return { pathname: '/user/[id]', params: { id: userId } };
  }

  if (type === 'verification_approved') {
    return '/(tabs)/profile';
  }

  return getIdentifier(data.notificationId) ? '/notifications' : null;
}

function getIdentifier(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
