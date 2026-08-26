import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

type NotificationType =
  | 'badge_assigned'
  | 'post_comment'
  | 'event_cancelled'
  | 'post_like'
  | 'verification_approved'
  | 'verification_rejected';

type NotificationRecord = {
  actor_id: string | null;
  id: string;
  event_id: string | null;
  post_id: string | null;
  recipient_id: string;
  title: string;
  type: NotificationType;
};

type PushTokenRecord = {
  token: string;
};

const corsHeaders = {
  'Content-Type': 'application/json',
};

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  // The function is deployed with JWT verification and accepts only a trusted
  // service-role caller. A student session cannot use it to replay pushes.
  if (getJwtRole(request.headers.get('Authorization')) !== 'service_role') {
    return jsonResponse({ error: 'Forbidden.' }, 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const notificationId = getNotificationId(body);

  if (!notificationId) {
    return jsonResponse({ error: 'A valid notificationId is required.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration is incomplete.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: rawNotification, error: notificationError } = await supabase
    .from('notifications')
    .select('id, recipient_id, actor_id, type, title, post_id, event_id')
    .eq('id', notificationId)
    .single();

  if (notificationError || !isNotificationRecord(rawNotification)) {
    return jsonResponse({ error: 'Notification not found.' }, 404);
  }

  const notification: NotificationRecord = rawNotification;
  const { data: rawTokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', notification.recipient_id)
    .limit(100);

  if (tokenError) {
    return jsonResponse({ error: 'Could not load push destinations.' }, 500);
  }

  const tokens = (rawTokens ?? []).filter(isPushTokenRecord);

  if (tokens.length === 0) {
    return jsonResponse({ delivered: 0, requested: 0 });
  }

  const messages = tokens.map(({ token }) => ({
    body: getSafePushBody(notification),
    channelId: 'default',
    data: {
      notificationId: notification.id,
      eventId: notification.event_id,
      postId: notification.post_id,
      type: notification.type,
    },
    sound: 'default',
    title: 'Varta',
    to: token,
  }));
  const expoHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

  if (expoAccessToken) {
    expoHeaders.Authorization = `Bearer ${expoAccessToken}`;
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    body: JSON.stringify(messages),
    headers: expoHeaders,
    method: 'POST',
  });

  if (!response.ok) {
    return jsonResponse(
      { error: 'Expo rejected the push delivery request.' },
      502
    );
  }

  return jsonResponse({ delivered: messages.length, requested: messages.length });
});

function getSafePushBody(notification: NotificationRecord) {
  switch (notification.type) {
    case 'post_like':
    case 'post_comment':
      return notification.title;
    case 'badge_assigned':
      return 'You received a new badge.';
    case 'event_cancelled':
      return 'An event you saved has been cancelled.';
    case 'verification_approved':
      return 'Your Varta account is verified.';
    case 'verification_rejected':
      return 'Your verification needs attention.';
  }
}

function getJwtRole(authorization: string | null) {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length);
  const payload = token.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded: unknown = JSON.parse(atob(padded));

    return isRecord(decoded) && typeof decoded.role === 'string'
      ? decoded.role
      : null;
  } catch {
    return null;
  }
}

function getNotificationId(body: unknown) {
  if (!isRecord(body) || typeof body.notificationId !== 'string') {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    body.notificationId
  )
    ? body.notificationId
    : null;
}

function isNotificationRecord(value: unknown): value is NotificationRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.recipient_id === 'string' &&
    typeof value.title === 'string' &&
    isNotificationType(value.type) &&
    (value.actor_id === null || typeof value.actor_id === 'string') &&
    (value.post_id === null || typeof value.post_id === 'string')
    && (value.event_id === null || typeof value.event_id === 'string')
  );
}

function isPushTokenRecord(value: unknown): value is PushTokenRecord {
  return isRecord(value) && typeof value.token === 'string';
}

function isNotificationType(value: unknown): value is NotificationType {
  return (
    value === 'post_like' ||
    value === 'post_comment' ||
    value === 'event_cancelled' ||
    value === 'verification_approved' ||
    value === 'verification_rejected' ||
    value === 'badge_assigned'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}
