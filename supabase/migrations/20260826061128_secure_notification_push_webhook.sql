-- Authenticate database-triggered push requests without embedding a secret in
-- source control. The matching value is stored in Supabase Vault and in the
-- Edge Function's encrypted environment.

-- The unique owner/position constraints already provide these two indexes.
drop index if exists public.profile_links_profile_id_idx;
drop index if exists public.organization_links_organization_id_idx;

-- Postgres does not add indexes for foreign keys automatically. These support
-- receipt cleanup cascades and comment-notification joins.
create index push_delivery_receipts_notification_id_idx
on public.push_delivery_receipts(notification_id);

create index push_delivery_receipts_push_token_id_idx
on public.push_delivery_receipts(push_token_id);

create index notifications_comment_id_idx
on public.notifications(comment_id)
where comment_id is not null;

create or replace function private.enqueue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select secret.decrypted_secret
  into webhook_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'varta_push_webhook_secret';

  if webhook_secret is null then
    raise warning 'The Varta push webhook secret is not configured.';
    return new;
  end if;

  perform net.http_post(
    url := 'https://pbwlkdxukrbdvjfupewu.supabase.co/functions/v1/send-notification-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-varta-push-secret', webhook_secret
    ),
    body := jsonb_build_object('notificationId', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all
on function private.enqueue_notification_push()
from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select job.jobid
  into existing_job_id
  from cron.job as job
  where job.jobname = 'process-varta-push-receipts';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'process-varta-push-receipts',
    '*/15 * * * *',
    $job$
      select net.http_post(
        url := 'https://pbwlkdxukrbdvjfupewu.supabase.co/functions/v1/send-notification-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-varta-push-secret', (
            select secret.decrypted_secret
            from vault.decrypted_secrets as secret
            where secret.name = 'varta_push_webhook_secret'
          )
        ),
        body := jsonb_build_object('processReceipts', true),
        timeout_milliseconds := 10000
      );
    $job$
  );
end;
$$;
