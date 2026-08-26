import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

type NotificationType =
  | 'badge_assigned'
  | 'event_cancelled'
  | 'event_updated'
  | 'organization_role_assigned'
  | 'post_comment'
  | 'post_like'
  | 'verification_approved'
  | 'verification_rejected';

type NotificationRecord = {
  actor_id: string | null;
  event_id: string | null;
  id: string;
  organization_id: string | null;
  post_id: string | null;
  recipient_id: string;
  title: string;
  type: NotificationType;
};

type PushTokenRecord = {
  id: string;
  token: string;
};

type ExpoPushTicket = {
  details?: { error?: string };
  id?: string;
  message?: string;
  status: 'error' | 'ok';
};

type PushReceiptRow = {
  id: string;
  push_token_id: string;
  receipt_id: string;
};

const FIVE_MINUTES = 5 * 60 * 1000;
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');

  if (!webhookSecret) {
    return jsonResponse({ error: 'Server configuration is incomplete.' }, 500);
  }

  if (
    !(await secretsMatch(
      request.headers.get('x-varta-push-secret'),
      webhookSecret
    ))
  ) {
    return jsonResponse({ error: 'Forbidden.' }, 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const notificationId = getNotificationId(body);
  const shouldProcessReceipts =
    isRecord(body) && body.processReceipts === true;

  if (!notificationId && !shouldProcessReceipts) {
    return jsonResponse(
      { error: 'A notificationId or receipt-processing request is required.' },
      400
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration is incomplete.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  if (shouldProcessReceipts) {
    return processPushReceipts(supabase, Deno.env.get('EXPO_ACCESS_TOKEN'));
  }

  if (!notificationId) {
    return jsonResponse({ error: 'A valid notificationId is required.' }, 400);
  }
  const claimedAt = new Date().toISOString();
  let hasClaim = false;

  try {
    // The endpoint accepts no message copy or destination. It can only claim a
    // trusted database notification that has not already been processed.
    const staleClaimBefore = new Date(Date.now() - FIVE_MINUTES).toISOString();
    const { data: rawNotification, error: claimError } = await supabase
      .from('notifications')
      .update({ push_claimed_at: claimedAt })
      .eq('id', notificationId)
      .is('push_sent_at', null)
      .or(`push_claimed_at.is.null,push_claimed_at.lt.${staleClaimBefore}`)
      .select(
        'id, recipient_id, actor_id, type, title, post_id, event_id, organization_id'
      )
      .maybeSingle();

    if (claimError) {
      console.error('[push] Notification claim failed.', claimError);
      return jsonResponse({ error: 'Push dispatch is temporarily unavailable.' }, 500);
    }

    if (!isNotificationRecord(rawNotification)) {
      return jsonResponse({ alreadyProcessed: true }, 202);
    }

    hasClaim = true;
    const notification = rawNotification;
    const staleTokenBefore = new Date(Date.now() - NINETY_DAYS).toISOString();
    const { error: pruneError } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', notification.recipient_id)
      .lt('updated_at', staleTokenBefore);

    if (pruneError) {
      console.warn('[push] Stale token pruning failed.', pruneError);
    }

    const { data: rawTokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('id, token')
      .eq('user_id', notification.recipient_id)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (tokenError) {
      throw tokenError;
    }

    const tokens = (rawTokens ?? []).filter(isPushTokenRecord);

    if (tokens.length === 0) {
      await markProcessed(supabase, notification.id, claimedAt);
      return jsonResponse({ delivered: 0, requested: 0 });
    }

    const messages = tokens.map(({ token }) => ({
      body: getSafePushBody(notification),
      channelId: 'default',
      data: {
        actorId: notification.actor_id,
        eventId: notification.event_id,
        notificationId: notification.id,
        organizationId: notification.organization_id,
        postId: notification.post_id,
        type: notification.type,
        userId: notification.actor_id ?? notification.recipient_id,
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
      throw new Error(`Expo push request failed with ${response.status}.`);
    }

    const responseBody: unknown = await response.json().catch(() => null);
    const tickets = getExpoPushTickets(responseBody);

    if (!tickets || tickets.length !== tokens.length) {
      throw new Error('Expo returned an invalid push ticket response.');
    }

    const staleTokenIds = tickets.flatMap((ticket, index) =>
      ticket.status === 'error' &&
      ticket.details?.error === 'DeviceNotRegistered'
        ? [tokens[index].id]
        : []
    );
    const receiptRows = tickets.flatMap((ticket, index) =>
      ticket.status === 'ok' && ticket.id
        ? [
            {
              notification_id: notification.id,
              push_token_id: tokens[index].id,
              receipt_id: ticket.id,
            },
          ]
        : []
    );

    if (receiptRows.length > 0) {
      const { error: receiptError } = await supabase
        .from('push_delivery_receipts')
        .upsert(receiptRows, { onConflict: 'receipt_id' });

      if (receiptError) {
        console.warn('[push] Receipt tracking failed.', receiptError);
      }
    }

    if (staleTokenIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('push_tokens')
        .delete()
        .in('id', staleTokenIds);

      if (deleteError) {
        console.warn('[push] DeviceNotRegistered cleanup failed.', deleteError);
      }
    }

    await markProcessed(supabase, notification.id, claimedAt);

    return jsonResponse({
      delivered: tickets.filter((ticket) => ticket.status === 'ok').length,
      requested: messages.length,
      staleTokensRemoved: staleTokenIds.length,
    });
  } catch (error) {
    console.error('[push] Delivery failed.', error);

    if (hasClaim) {
      const { error: releaseError } = await supabase
        .from('notifications')
        .update({ push_claimed_at: null })
        .eq('id', notificationId)
        .eq('push_claimed_at', claimedAt)
        .is('push_sent_at', null);

      if (releaseError) {
        console.error('[push] Notification claim release failed.', releaseError);
      }
    }

    return jsonResponse({ error: 'Push delivery failed.' }, 502);
  }
});

async function processPushReceipts(
  supabase: ReturnType<typeof createClient>,
  expoAccessToken: string | undefined
) {
  const expiredBefore = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { error: pruneError } = await supabase
    .from('push_delivery_receipts')
    .delete()
    .lt('created_at', expiredBefore);

  if (pruneError) {
    console.warn('[push] Expired receipt cleanup failed.', pruneError);
  }

  const { data: rawRows, error: loadError } = await supabase
    .from('push_delivery_receipts')
    .select('id, push_token_id, receipt_id')
    .lte('next_check_at', new Date().toISOString())
    .order('next_check_at', { ascending: true })
    .limit(500);

  if (loadError) {
    return jsonResponse({ error: 'Could not load push receipts.' }, 500);
  }

  const rows = (rawRows ?? []).filter(isPushReceiptRow);

  if (rows.length === 0) {
    return jsonResponse({ checked: 0, staleTokensRemoved: 0 });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };

  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }

  const response = await fetch(
    'https://exp.host/--/api/v2/push/getReceipts',
    {
      body: JSON.stringify({ ids: rows.map((row) => row.receipt_id) }),
      headers,
      method: 'POST',
    }
  );

  if (!response.ok) {
    return jsonResponse({ error: 'Expo receipt lookup failed.' }, 502);
  }

  const responseBody: unknown = await response.json().catch(() => null);
  const receiptData =
    isRecord(responseBody) && isRecord(responseBody.data)
      ? responseBody.data
      : null;

  if (!receiptData) {
    return jsonResponse({ error: 'Expo returned invalid receipts.' }, 502);
  }

  const resolvedReceiptIds: string[] = [];
  const staleTokenIds: string[] = [];
  const pendingReceiptIds: string[] = [];

  rows.forEach((row) => {
    const receipt = receiptData[row.receipt_id];

    if (!isRecord(receipt)) {
      pendingReceiptIds.push(row.id);
      return;
    }

    resolvedReceiptIds.push(row.id);

    if (
      receipt.status === 'error' &&
      isRecord(receipt.details) &&
      receipt.details.error === 'DeviceNotRegistered'
    ) {
      staleTokenIds.push(row.push_token_id);
    }
  });

  if (staleTokenIds.length > 0) {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .in('id', [...new Set(staleTokenIds)]);

    if (error) {
      console.warn('[push] Receipt token cleanup failed.', error);
    }
  }

  if (resolvedReceiptIds.length > 0) {
    const { error } = await supabase
      .from('push_delivery_receipts')
      .delete()
      .in('id', resolvedReceiptIds);

    if (error) {
      console.warn('[push] Resolved receipt cleanup failed.', error);
    }
  }

  if (pendingReceiptIds.length > 0) {
    const { error } = await supabase
      .from('push_delivery_receipts')
      .update({
        next_check_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .in('id', pendingReceiptIds);

    if (error) {
      console.warn('[push] Receipt reschedule failed.', error);
    }
  }

  return jsonResponse({
    checked: rows.length,
    pending: pendingReceiptIds.length,
    staleTokensRemoved: staleTokenIds.length,
  });
}

async function markProcessed(
  supabase: ReturnType<typeof createClient>,
  notificationId: string,
  claimedAt: string
) {
  const { error } = await supabase
    .from('notifications')
    .update({ push_claimed_at: null, push_sent_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('push_claimed_at', claimedAt)
    .is('push_sent_at', null);

  if (error) {
    throw error;
  }
}

function getSafePushBody(notification: NotificationRecord) {
  switch (notification.type) {
    case 'post_like':
    case 'post_comment':
      return notification.title;
    case 'badge_assigned':
      return 'You received a new badge.';
    case 'event_cancelled':
      return 'An event you saved has been cancelled.';
    case 'event_updated':
      return 'Details changed for an event you saved.';
    case 'organization_role_assigned':
      return 'You received a new organization role.';
    case 'verification_approved':
      return 'Your Varta account is verified.';
    case 'verification_rejected':
      return 'Your verification needs attention.';
  }
}

function getExpoPushTickets(value: unknown): ExpoPushTicket[] | null {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return null;
  }

  return value.data.every(isExpoPushTicket) ? value.data : null;
}

function isExpoPushTicket(value: unknown): value is ExpoPushTicket {
  return (
    isRecord(value) &&
    (value.status === 'ok' || value.status === 'error') &&
    (value.id === undefined || typeof value.id === 'string') &&
    (value.message === undefined || typeof value.message === 'string') &&
    (value.details === undefined || isRecord(value.details))
  );
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
    (value.post_id === null || typeof value.post_id === 'string') &&
    (value.event_id === null || typeof value.event_id === 'string') &&
    (value.organization_id === null ||
      typeof value.organization_id === 'string')
  );
}

function isPushTokenRecord(value: unknown): value is PushTokenRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.token === 'string'
  );
}

function isPushReceiptRow(value: unknown): value is PushReceiptRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.push_token_id === 'string' &&
    typeof value.receipt_id === 'string'
  );
}

function isNotificationType(value: unknown): value is NotificationType {
  return (
    value === 'badge_assigned' ||
    value === 'event_cancelled' ||
    value === 'event_updated' ||
    value === 'organization_role_assigned' ||
    value === 'post_comment' ||
    value === 'post_like' ||
    value === 'verification_approved' ||
    value === 'verification_rejected'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function secretsMatch(provided: string | null, expected: string) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided ?? '')),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;

  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }

  return difference === 0;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}
