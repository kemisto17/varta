-- The Edge Function uses the service-role key so RLS remains bypassed, but
-- Postgres table privileges are still required. Grant only the operations and
-- notification columns used by the replay-safe push dispatcher.

grant select (
  id,
  recipient_id,
  actor_id,
  type,
  title,
  post_id,
  event_id,
  organization_id,
  push_claimed_at,
  push_sent_at
)
on public.notifications
to service_role;

grant update (push_claimed_at, push_sent_at)
on public.notifications
to service_role;

grant select (id, user_id, token, updated_at)
on public.push_tokens
to service_role;

grant delete
on public.push_tokens
to service_role;

grant select, insert, update, delete
on public.push_delivery_receipts
to service_role;
