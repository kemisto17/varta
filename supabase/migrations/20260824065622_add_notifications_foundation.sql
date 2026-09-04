-- In-app notifications and the storage foundation for Expo push tokens.
-- Notification creation is deliberately restricted to trusted database
-- triggers. Authenticated clients can read and mark only their own rows.

create type public.notification_type as enum (
  'post_like',
  'post_comment',
  'verification_approved',
  'verification_rejected',
  'badge_assigned'
);

-- The current repository did not contain the badge tables described by the
-- milestone preconditions. These minimal public-badge tables restore that
-- prerequisite. Only privileged SQL/server code can create badges or assign
-- them; students receive read access only.
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (char_length(trim(name)) between 2 and 60),
  description text not null default ''
    check (char_length(description) <= 240),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profile_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  badge_id uuid not null
    references public.badges(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index profile_badges_user_created_at_idx
on public.profile_badges(user_id, created_at desc);

create index profile_badges_badge_id_idx
on public.profile_badges(badge_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null
    references public.profiles(id) on delete cascade,
  actor_id uuid
    references public.profiles(id) on delete set null,
  type public.notification_type not null,
  post_id uuid
    references public.posts(id) on delete cascade,
  comment_id uuid
    references public.comments(id) on delete set null,
  badge_id uuid
    references public.badges(id) on delete set null,
  title text not null
    check (char_length(title) between 1 and 120),
  body text not null default ''
    check (char_length(body) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_at_idx
on public.notifications(recipient_id, created_at desc, id desc);

create index notifications_recipient_read_at_idx
on public.notifications(recipient_id, read_at);

create index notifications_actor_id_idx
on public.notifications(actor_id)
where actor_id is not null;

create index notifications_post_id_idx
on public.notifications(post_id)
where post_id is not null;

create index notifications_badge_id_idx
on public.notifications(badge_id)
where badge_id is not null;

-- One historical notification per actor/post like prevents notification spam
-- from repeated like/unlike cycles. Unlike does not delete notification history.
create unique index notifications_unique_post_like_idx
on public.notifications(recipient_id, actor_id, post_id)
where type = 'post_like'
  and actor_id is not null
  and post_id is not null;

create unique index notifications_unique_post_comment_idx
on public.notifications(comment_id)
where type = 'post_comment'
  and comment_id is not null;

create unique index notifications_unique_verification_transition_idx
on public.notifications(recipient_id, type)
where type in ('verification_approved', 'verification_rejected');

create unique index notifications_unique_badge_assignment_idx
on public.notifications(recipient_id, badge_id)
where type = 'badge_assigned'
  and badge_id is not null;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  token text not null unique
    check (char_length(token) between 20 and 512),
  platform text not null
    check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx
on public.push_tokens(user_id);

-- --------------------------------------------------------------------------
-- Trusted notification producers
-- --------------------------------------------------------------------------

create or replace function private.create_post_like_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner_id uuid;
  actor_name text;
begin
  select post.author_id
  into post_owner_id
  from public.posts as post
  where post.id = new.post_id;

  if post_owner_id is null or post_owner_id = new.user_id then
    return new;
  end if;

  select coalesce(nullif(trim(profile.full_name), ''), 'A student')
  into actor_name
  from public.profiles as profile
  where profile.id = new.user_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    post_id,
    title,
    body
  )
  values (
    post_owner_id,
    new.user_id,
    'post_like',
    new.post_id,
    actor_name || ' liked your post',
    'Open the post to see the activity.'
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function private.create_post_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner_id uuid;
  actor_name text;
  comment_preview text;
begin
  select post.author_id
  into post_owner_id
  from public.posts as post
  where post.id = new.post_id;

  if post_owner_id is null or post_owner_id = new.author_id then
    return new;
  end if;

  select coalesce(nullif(trim(profile.full_name), ''), 'A student')
  into actor_name
  from public.profiles as profile
  where profile.id = new.author_id;

  comment_preview := left(regexp_replace(trim(new.content), '[\n\r\t]+', ' ', 'g'), 160);

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    post_id,
    comment_id,
    title,
    body
  )
  values (
    post_owner_id,
    new.author_id,
    'post_comment',
    new.post_id,
    new.id,
    actor_name || ' commented on your post',
    comment_preview
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function private.create_verification_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'pending' or new.status not in ('verified', 'rejected') then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    type,
    title,
    body
  )
  select
    new.user_id,
    case
      when new.status = 'verified'
        then 'verification_approved'::public.notification_type
      else 'verification_rejected'::public.notification_type
    end,
    case
      when new.status = 'verified' then 'You''re verified'
      else 'Verification needs attention'
    end,
    case
      when new.status = 'verified'
        then 'You now have full access to Varta.'
      else 'Review your verification details and submit again.'
    end
  from public.profiles as profile
  where profile.id = new.user_id
  on conflict do nothing;

  return new;
end;
$$;

create or replace function private.create_badge_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  badge_name text;
begin
  select badge.name
  into badge_name
  from public.badges as badge
  where badge.id = new.badge_id
    and badge.is_public;

  if badge_name is null then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    type,
    badge_id,
    title,
    body
  )
  values (
    new.user_id,
    'badge_assigned',
    new.badge_id,
    'New badge',
    'You received the ' || badge_name || ' badge.'
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all
on function private.create_post_like_notification()
from public, anon, authenticated;

revoke all
on function private.create_post_comment_notification()
from public, anon, authenticated;

revoke all
on function private.create_verification_notification()
from public, anon, authenticated;

revoke all
on function private.create_badge_assignment_notification()
from public, anon, authenticated;

create trigger post_likes_create_notification
after insert on public.post_likes
for each row
execute function private.create_post_like_notification();

create trigger comments_create_notification
after insert on public.comments
for each row
execute function private.create_post_comment_notification();

create trigger student_verifications_create_notification
after update of status on public.student_verifications
for each row
when (old.status is distinct from new.status)
execute function private.create_verification_notification();

create trigger profile_badges_create_notification
after insert on public.profile_badges
for each row
execute function private.create_badge_assignment_notification();

-- --------------------------------------------------------------------------
-- RLS and least-privilege grants
-- --------------------------------------------------------------------------

alter table public.badges enable row level security;
alter table public.profile_badges enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

revoke all on table public.badges from anon, authenticated;
revoke all on table public.profile_badges from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.push_tokens from anon, authenticated;

grant select (id, name, description, is_public, created_at)
on public.badges
to authenticated;

grant select (id, user_id, badge_id, created_at)
on public.profile_badges
to authenticated;

grant select, delete
on public.notifications
to authenticated;

grant update (read_at)
on public.notifications
to authenticated;

grant select, delete
on public.push_tokens
to authenticated;

grant insert (user_id, token, platform)
on public.push_tokens
to authenticated;

grant update (platform, updated_at)
on public.push_tokens
to authenticated;

create policy "Authenticated users can view public badges"
on public.badges
for select
to authenticated
using (is_public);

create policy "Verified students can view public profile badges"
on public.profile_badges
for select
to authenticated
using (
  exists (
    select 1
    from public.badges as badge
    where badge.id = profile_badges.badge_id
      and badge.is_public
  )
  and (
    user_id = (select auth.uid())
    or (
      (select private.is_verified_user())
      and (select private.profile_is_in_current_university(user_id))
    )
  )
);

create policy "Users can view own notifications"
on public.notifications
for select
to authenticated
using (recipient_id = (select auth.uid()));

create policy "Users can mark own notifications read"
on public.notifications
for update
to authenticated
using (recipient_id = (select auth.uid()))
with check (
  recipient_id = (select auth.uid())
  and read_at is not null
);

create policy "Users can delete own notifications"
on public.notifications
for delete
to authenticated
using (recipient_id = (select auth.uid()));

create policy "Users can view own push tokens"
on public.push_tokens
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can register own push tokens"
on public.push_tokens
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can refresh own push tokens"
on public.push_tokens
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete own push tokens"
on public.push_tokens
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Postgres Changes honors notifications RLS. This publication entry is used
-- only with a recipient_id filter in the mobile client.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

comment on table public.notifications is
  'Trusted in-app notification history. Mobile clients cannot insert rows.';

comment on table public.push_tokens is
  'Per-device Expo push tokens owned and managed by the authenticated user.';

comment on column public.notifications.body is
  'Safe in-app copy. Push delivery uses a stricter type-based content allowlist.';

;
