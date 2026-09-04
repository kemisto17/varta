-- Push dispatch, safe structured links, and organization-authored posts.
-- Every client-facing table uses RLS and narrow grants. Push delivery is
-- initiated asynchronously from trusted notification rows; the Edge Function
-- receives no user-controlled copy or destination.

-- --------------------------------------------------------------------------
-- Structured links
-- --------------------------------------------------------------------------

-- Earlier organization administration work introduced this column remotely.
-- Keep the additive migration reproducible for fresh local databases too.
alter table public.organizations
add column if not exists is_active boolean not null default true;
create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.profiles(id) on delete cascade,
  label text not null
    check (char_length(trim(label)) between 1 and 40),
  url text not null
    check (
      char_length(url) <= 500
      and url ~ '^https://[^[:space:]]+$'
    ),
  position smallint not null
    check (position between 0 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, position)
);
create index profile_links_profile_id_idx
on public.profile_links(profile_id, position);
create table public.organization_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  label text not null
    check (char_length(trim(label)) between 1 and 40),
  url text not null
    check (
      char_length(url) <= 500
      and url ~ '^https://[^[:space:]]+$'
    ),
  position smallint not null
    check (position between 0 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, position)
);
create index organization_links_organization_id_idx
on public.organization_links(organization_id, position);
create trigger profile_links_set_updated_at
before update on public.profile_links
for each row
execute function private.set_updated_at();
create trigger organization_links_set_updated_at
before update on public.organization_links
for each row
execute function private.set_updated_at();
alter table public.profile_links enable row level security;
alter table public.organization_links enable row level security;
revoke all on table public.profile_links from anon, authenticated;
revoke all on table public.organization_links from anon, authenticated;
grant select, insert, update, delete
on public.profile_links
to authenticated;
grant select, insert, update, delete
on public.organization_links
to authenticated;
create policy "Users can view visible profile links"
on public.profile_links
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (
    (select private.is_verified_user())
    and (select private.profile_is_in_current_university(profile_id))
  )
);
create policy "Users can create own profile links"
on public.profile_links
for insert
to authenticated
with check (profile_id = (select auth.uid()));
create policy "Users can update own profile links"
on public.profile_links
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));
create policy "Users can delete own profile links"
on public.profile_links
for delete
to authenticated
using (profile_id = (select auth.uid()));
create policy "Users can view visible organization links"
on public.organization_links
for select
to authenticated
using ((select private.can_view_organization(organization_id)));
create policy "Owners and admins can create organization links"
on public.organization_links
for insert
to authenticated
with check ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::text[]
)));
create policy "Owners and admins can update organization links"
on public.organization_links
for update
to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::text[]
)))
with check ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::text[]
)));
create policy "Owners and admins can delete organization links"
on public.organization_links
for delete
to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::text[]
)));
-- --------------------------------------------------------------------------
-- Organization-authored posts
-- --------------------------------------------------------------------------

alter table public.posts
alter column author_id drop not null;
alter table public.posts
add column organization_author_id uuid
  references public.organizations(id) on delete cascade;
alter table public.posts
add constraint posts_exactly_one_author_check
check (num_nonnulls(author_id, organization_author_id) = 1);
create index posts_organization_author_created_at_idx
on public.posts(organization_author_id, created_at desc, id desc)
where organization_author_id is not null;
create or replace function private.post_is_in_current_university(
  target_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts as post
    left join public.profiles as profile
      on profile.id = post.author_id
    left join public.institutes as institute
      on institute.id = profile.institute_id
    left join public.organizations as organization
      on organization.id = post.organization_author_id
    where post.id = target_post_id
      and (
        (
          post.author_id is not null
          and institute.university_id = (
            select private.current_university_id()
          )
        )
        or (
          post.organization_author_id is not null
          and organization.university_id = (
            select private.current_university_id()
          )
          and organization.is_active
        )
      )
  );
$$;
create or replace function private.can_publish_for_organization(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_verified_user())
    and exists (
      select 1
      from public.organization_members as membership
      join public.organizations as organization
        on organization.id = membership.organization_id
      where membership.organization_id = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'editor')
        and organization.is_active
        and organization.university_id = (
          select private.current_university_id()
        )
    );
$$;
create or replace function private.can_manage_post(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts as post
    where post.id = target_post_id
      and (
        post.author_id = (select auth.uid())
        or (
          post.organization_author_id is not null
          and (select private.can_publish_for_organization(
            post.organization_author_id
          ))
        )
      )
  );
$$;
create or replace function private.preserve_post_author_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.author_id is distinct from new.author_id
    or old.organization_author_id is distinct from new.organization_author_id
  then
    raise exception 'A post author identity cannot be changed.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all
on function private.can_publish_for_organization(uuid)
from public, anon, authenticated;
revoke all
on function private.can_manage_post(uuid)
from public, anon, authenticated;
revoke all
on function private.preserve_post_author_identity()
from public, anon, authenticated;
create trigger posts_preserve_author_identity
before update on public.posts
for each row
execute function private.preserve_post_author_identity();
drop policy "Verified students can view university posts"
on public.posts;
drop policy "Verified students can create posts"
on public.posts;
drop policy "Verified students can update own posts"
on public.posts;
drop policy "Users can delete own posts"
on public.posts;
create policy "Verified users can view university posts"
on public.posts
for select
to authenticated
using (
  (select private.is_verified_user())
  and (select private.post_is_in_current_university(id))
  and (
    author_id is null
    or not (select private.current_user_has_blocked(author_id))
  )
);
create policy "Verified users can create authorized posts"
on public.posts
for insert
to authenticated
with check (
  (
    author_id = (select auth.uid())
    and organization_author_id is null
    and (select private.is_verified_user())
  )
  or (
    author_id is null
    and organization_author_id is not null
    and (select private.can_publish_for_organization(
      organization_author_id
    ))
  )
);
create policy "Authorized authors can update posts"
on public.posts
for update
to authenticated
using ((select private.can_manage_post(id)))
with check ((select private.can_manage_post(id)));
create policy "Authorized authors can delete posts"
on public.posts
for delete
to authenticated
using ((select private.can_manage_post(id)));
grant insert (
  author_id,
  organization_author_id,
  content,
  image_path
)
on public.posts
to authenticated;
drop policy "Verified users can upload own post media"
on storage.objects;
drop policy "Verified users can view university post media"
on storage.objects;
drop policy "Users can delete own post media"
on storage.objects;
create policy "Authorized authors can upload post media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and (select private.is_verified_user())
  and storage.filename(name) ~
    '^[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
  and (
    (
      cardinality(storage.foldername(name)) = 1
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or (
      cardinality(storage.foldername(name)) = 2
      and (storage.foldername(name))[2] = (select auth.uid())::text
      and case
        when (storage.foldername(name))[1] ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (select private.can_publish_for_organization(
          ((storage.foldername(name))[1])::uuid
        ))
        else false
      end
    )
  )
);
create policy "Verified users can view scoped post media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'post-media'
  and (select private.is_verified_user())
  and exists (
    select 1
    from public.posts as post
    where post.image_path = storage.objects.name
      and (select private.post_is_in_current_university(post.id))
      and (
        post.author_id is null
        or not (select private.current_user_has_blocked(post.author_id))
      )
  )
);
create policy "Authorized authors can delete post media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-media'
  and (
    (
      owner_id = (select auth.uid())::text
      and cardinality(storage.foldername(name)) = 1
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or (
      cardinality(storage.foldername(name)) = 2
      and case
        when (storage.foldername(name))[1] ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (select private.can_publish_for_organization(
          ((storage.foldername(name))[1])::uuid
        ))
        else false
      end
    )
  )
);
-- Add an official-post count without exposing post rows through the summary.
drop function public.get_organization_profile_summary(uuid);
create function public.get_organization_profile_summary(
  target_organization_id uuid
)
returns table (
  follower_count bigint,
  event_count bigint,
  post_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      select count(*)
      from public.organization_follows as follow
      where follow.organization_id = target_organization_id
    ),
    (
      select count(*)
      from public.events as event
      where event.organization_id = target_organization_id
        and event.status in ('published', 'cancelled')
    ),
    (
      select count(*)
      from public.posts as post
      where post.organization_author_id = target_organization_id
    )
  where (select private.can_view_organization(target_organization_id));
$$;
revoke all
on function public.get_organization_profile_summary(uuid)
from public, anon;
grant execute
on function public.get_organization_profile_summary(uuid)
to authenticated;
-- --------------------------------------------------------------------------
-- Notification expansion and preference-aware trusted producers
-- --------------------------------------------------------------------------

alter table public.notifications
add column organization_id uuid
  references public.organizations(id) on delete cascade;
alter table public.notifications
add column push_claimed_at timestamptz,
add column push_sent_at timestamptz;
create index notifications_organization_id_idx
on public.notifications(organization_id)
where organization_id is not null;
drop index notifications_unique_post_comment_idx;
create unique index notifications_unique_post_comment_idx
on public.notifications(recipient_id, comment_id)
where type = 'post_comment'
  and comment_id is not null;
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
        when 'event_updated' then preference.events_enabled
        else true
      end
      from public.notification_preferences as preference
      where preference.user_id = recipient_profile_id
    ),
    true
  );
$$;
create or replace function private.create_post_like_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_owner_id uuid;
  organization_owner_id uuid;
  organization_name text;
  actor_name text;
begin
  select
    post.author_id,
    post.organization_author_id,
    organization.name
  into student_owner_id, organization_owner_id, organization_name
  from public.posts as post
  left join public.organizations as organization
    on organization.id = post.organization_author_id
  where post.id = new.post_id;

  select coalesce(nullif(trim(profile.full_name), ''), 'A student')
  into actor_name
  from public.profiles as profile
  where profile.id = new.user_id;

  if student_owner_id is not null then
    if student_owner_id <> new.user_id
      and (select private.notification_preference_enabled(
        student_owner_id,
        'post_like'
      ))
    then
      insert into public.notifications (
        recipient_id, actor_id, type, post_id, title, body
      )
      values (
        student_owner_id,
        new.user_id,
        'post_like',
        new.post_id,
        actor_name || ' liked your post',
        'Open the post to see the activity.'
      )
      on conflict do nothing;
    end if;

    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    post_id,
    organization_id,
    title,
    body
  )
  select
    membership.user_id,
    new.user_id,
    'post_like',
    new.post_id,
    organization_owner_id,
    actor_name || ' liked ' || organization_name || '''s post',
    'Open the post to see the activity.'
  from public.organization_members as membership
  where membership.organization_id = organization_owner_id
    and membership.user_id <> new.user_id
    and (select private.notification_preference_enabled(
      membership.user_id,
      'post_like'
    ))
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
  student_owner_id uuid;
  organization_owner_id uuid;
  organization_name text;
  actor_name text;
  comment_preview text;
begin
  select
    post.author_id,
    post.organization_author_id,
    organization.name
  into student_owner_id, organization_owner_id, organization_name
  from public.posts as post
  left join public.organizations as organization
    on organization.id = post.organization_author_id
  where post.id = new.post_id;

  select coalesce(nullif(trim(profile.full_name), ''), 'A student')
  into actor_name
  from public.profiles as profile
  where profile.id = new.author_id;

  comment_preview := left(
    regexp_replace(trim(new.content), '[\n\r\t]+', ' ', 'g'),
    160
  );

  if student_owner_id is not null then
    if student_owner_id <> new.author_id
      and (select private.notification_preference_enabled(
        student_owner_id,
        'post_comment'
      ))
    then
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
        student_owner_id,
        new.author_id,
        'post_comment',
        new.post_id,
        new.id,
        actor_name || ' commented on your post',
        comment_preview
      )
      on conflict do nothing;
    end if;

    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    post_id,
    comment_id,
    organization_id,
    title,
    body
  )
  select
    membership.user_id,
    new.author_id,
    'post_comment',
    new.post_id,
    new.id,
    organization_owner_id,
    actor_name || ' commented on ' || organization_name || '''s post',
    comment_preview
  from public.organization_members as membership
  where membership.organization_id = organization_owner_id
    and membership.user_id <> new.author_id
    and (select private.notification_preference_enabled(
      membership.user_id,
      'post_comment'
    ))
  on conflict do nothing;

  return new;
end;
$$;
create or replace function private.create_event_update_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'published'
    or new.status <> 'published'
    or not (
      old.title is distinct from new.title
      or old.starts_at is distinct from new.starts_at
      or old.ends_at is distinct from new.ends_at
      or old.location is distinct from new.location
      or old.registration_url is distinct from new.registration_url
    )
  then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    event_id,
    organization_id,
    title,
    body
  )
  select
    interest.user_id,
    (select auth.uid()),
    'event_updated',
    new.id,
    new.organization_id,
    'Event updated',
    left(new.title, 500)
  from public.event_interests as interest
  where interest.event_id = new.id
    and (
      (select auth.uid()) is null
      or interest.user_id <> (select auth.uid())
    )
    and (select private.notification_preference_enabled(
      interest.user_id,
      'event_updated'
    ));

  return new;
end;
$$;
create or replace function private.create_organization_role_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_name text;
  notification_actor_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.role = new.role then
      return new;
    end if;
  end if;

  select organization.name
  into organization_name
  from public.organizations as organization
  where organization.id = new.organization_id;

  select profile.id
  into notification_actor_id
  from public.profiles as profile
  where profile.id = new.assigned_by;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    organization_id,
    title,
    body
  )
  values (
    new.user_id,
    notification_actor_id,
    'organization_role_assigned',
    new.organization_id,
    'Organization role assigned',
    'You are now ' || new.role || ' for ' || organization_name || '.'
  );

  return new;
end;
$$;
revoke all
on function private.create_event_update_notifications()
from public, anon, authenticated;
revoke all
on function private.create_organization_role_notification()
from public, anon, authenticated;
create trigger events_create_update_notifications
after update of title, starts_at, ends_at, location, registration_url, status
on public.events
for each row
execute function private.create_event_update_notifications();
create trigger organization_members_create_role_notification
after insert or update of role
on public.organization_members
for each row
execute function private.create_organization_role_notification();
-- --------------------------------------------------------------------------
-- Replay-safe asynchronous push dispatch and device-token ownership
-- --------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create table public.push_delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null
    references public.notifications(id) on delete cascade,
  push_token_id uuid not null
    references public.push_tokens(id) on delete cascade,
  receipt_id text not null unique
    check (char_length(receipt_id) between 8 and 200),
  next_check_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);
create index push_delivery_receipts_due_idx
on public.push_delivery_receipts(next_check_at, id);
alter table public.push_delivery_receipts enable row level security;
revoke all
on table public.push_delivery_receipts
from anon, authenticated;
create or replace function public.register_push_token(
  expo_token text,
  device_platform text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if char_length(expo_token) not between 20 and 512
    or expo_token !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$'
  then
    raise exception 'The Expo push token is invalid.' using errcode = '22023';
  end if;

  if device_platform not in ('android', 'ios') then
    raise exception 'The device platform is invalid.' using errcode = '22023';
  end if;

  insert into public.push_tokens (user_id, token, platform)
  values ((select auth.uid()), expo_token, device_platform)
  on conflict (token) do update
  set user_id = excluded.user_id,
      platform = excluded.platform,
      updated_at = now();
end;
$$;
revoke all
on function public.register_push_token(text, text)
from public, anon;
grant execute
on function public.register_push_token(text, text)
to authenticated;
revoke insert, update
on public.push_tokens
from authenticated;
create or replace function private.enqueue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://pbwlkdxukrbdvjfupewu.supabase.co/functions/v1/send-notification-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('notificationId', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;
revoke all
on function private.enqueue_notification_push()
from public, anon, authenticated;
create trigger notifications_enqueue_push
after insert on public.notifications
for each row
execute function private.enqueue_notification_push();
do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'process-varta-push-receipts'
  ) then
    perform cron.schedule(
      'process-varta-push-receipts',
      '*/15 * * * *',
      $job$
        select net.http_post(
          url := 'https://pbwlkdxukrbdvjfupewu.supabase.co/functions/v1/send-notification-push',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object('processReceipts', true),
          timeout_milliseconds := 10000
        );
      $job$
    );
  end if;
end;
$$;
comment on table public.profile_links is
  'Up to five HTTPS links displayed through a compact student profile entry.';
comment on table public.organization_links is
  'Up to five HTTPS links managed by organization owners and admins.';
comment on column public.posts.organization_author_id is
  'Official organization identity; exactly one of this or author_id is set.';
comment on function public.register_push_token(text, text) is
  'Atomically assigns one physical Expo token to the current authenticated user.';
