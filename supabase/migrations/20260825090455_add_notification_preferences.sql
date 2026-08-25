-- User-owned notification controls. Verification outcomes remain essential
-- account messages and intentionally do not have an opt-out.

create table public.notification_preferences (
  user_id uuid primary key
    references public.profiles(id) on delete cascade,
  likes_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  badges_enabled boolean not null default true,
  events_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row
execute function private.set_updated_at();

alter table public.notification_preferences enable row level security;

revoke all on table public.notification_preferences from anon, authenticated;

grant select
on table public.notification_preferences
to authenticated;

grant insert (
  user_id,
  likes_enabled,
  comments_enabled,
  badges_enabled,
  events_enabled
)
on public.notification_preferences
to authenticated;

grant update (
  likes_enabled,
  comments_enabled,
  badges_enabled,
  events_enabled
)
on public.notification_preferences
to authenticated;

create policy "Users can view own notification preferences"
on public.notification_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create own notification preferences"
on public.notification_preferences
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update own notification preferences"
on public.notification_preferences
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.notification_preference_enabled(
  recipient_profile_id uuid,
  notification_kind public.notification_type
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select case notification_kind
        when 'post_like' then preference.likes_enabled
        when 'post_comment' then preference.comments_enabled
        when 'badge_assigned' then preference.badges_enabled
        when 'event_cancelled' then preference.events_enabled
        else true
      end
      from public.notification_preferences as preference
      where preference.user_id = recipient_profile_id
    ),
    true
  );
$$;

revoke all
on function private.notification_preference_enabled(
  uuid,
  public.notification_type
)
from public, anon, authenticated;

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

  if post_owner_id is null
    or post_owner_id = new.user_id
    or not (select private.notification_preference_enabled(
      post_owner_id,
      'post_like'
    ))
  then
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

  if post_owner_id is null
    or post_owner_id = new.author_id
    or not (select private.notification_preference_enabled(
      post_owner_id,
      'post_comment'
    ))
  then
    return new;
  end if;

  select coalesce(nullif(trim(profile.full_name), ''), 'A student')
  into actor_name
  from public.profiles as profile
  where profile.id = new.author_id;

  comment_preview := left(
    regexp_replace(trim(new.content), '[\n\r\t]+', ' ', 'g'),
    160
  );

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
    and badge.visibility = 'public';

  if badge_name is null
    or not (select private.notification_preference_enabled(
      new.profile_id,
      'badge_assigned'
    ))
  then
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
    new.profile_id,
    'badge_assigned',
    new.badge_id,
    'New badge',
    'You received the ' || badge_name || ' badge.'
  );

  return new;
end;
$$;

create or replace function private.create_event_cancellation_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'cancelled' or new.status <> 'cancelled' then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    event_id,
    title,
    body
  )
  select
    interest.user_id,
    (select auth.uid()),
    'event_cancelled',
    new.id,
    'Event cancelled',
    left(new.title, 500)
  from public.event_interests as interest
  where interest.event_id = new.id
    and (select private.notification_preference_enabled(
      interest.user_id,
      'event_cancelled'
    ))
  on conflict do nothing;

  return new;
end;
$$;

comment on table public.notification_preferences is
  'User-owned controls honored by trusted notification producer triggers.';
