alter table public.notification_preferences
add column follows_enabled boolean not null default true;
grant insert (follows_enabled)
on public.notification_preferences
to authenticated;
grant update (follows_enabled)
on public.notification_preferences
to authenticated;
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
        when 'profile_follow' then preference.follows_enabled
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
create table public.profile_follows (
  follower_id uuid not null
    references public.profiles(id) on delete cascade,
  following_id uuid not null
    references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint profile_follows_prevent_self_follow
    check (follower_id <> following_id)
);
-- Keyset pagination for both directions of the people graph.
create index profile_follows_follower_created_at_idx
on public.profile_follows(follower_id, created_at desc, following_id desc);
create index profile_follows_following_created_at_idx
on public.profile_follows(following_id, created_at desc, follower_id desc);
create or replace function private.profile_is_verified(
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_verifications as verification
    where verification.user_id = target_profile_id
      and verification.status = 'verified'
  );
$$;
create or replace function private.profiles_are_blocked(
  first_profile_id uuid,
  second_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_blocks as user_block
    where (
      user_block.blocker_id = first_profile_id
      and user_block.blocked_id = second_profile_id
    )
    or (
      user_block.blocker_id = second_profile_id
      and user_block.blocked_id = first_profile_id
    )
  );
$$;
create or replace function private.can_follow_profile(
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and target_profile_id <> (select auth.uid())
    and (select private.is_verified_user())
    and (select private.profile_is_verified(target_profile_id))
    and (select private.profile_is_in_current_university(target_profile_id))
    and not (select private.profiles_are_blocked(
      (select auth.uid()),
      target_profile_id
    ));
$$;
create or replace function private.can_view_profile_follow(
  relationship_follower_id uuid,
  relationship_following_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select private.is_verified_user())
    and (select private.profile_is_verified(relationship_follower_id))
    and (select private.profile_is_verified(relationship_following_id))
    and (select private.profile_is_in_current_university(
      relationship_follower_id
    ))
    and (select private.profile_is_in_current_university(
      relationship_following_id
    ))
    and not (select private.profiles_are_blocked(
      relationship_follower_id,
      relationship_following_id
    ))
    and not (select private.profiles_are_blocked(
      (select auth.uid()),
      relationship_follower_id
    ))
    and not (select private.profiles_are_blocked(
      (select auth.uid()),
      relationship_following_id
    ));
$$;
revoke all
on function private.profile_is_verified(uuid)
from public, anon, authenticated;
revoke all
on function private.profiles_are_blocked(uuid, uuid)
from public, anon, authenticated;
revoke all
on function private.can_follow_profile(uuid)
from public, anon, authenticated;
revoke all
on function private.can_view_profile_follow(uuid, uuid)
from public, anon, authenticated;
grant execute
on function private.can_follow_profile(uuid)
to authenticated;
grant execute
on function private.can_view_profile_follow(uuid, uuid)
to authenticated;
grant execute
on function private.profile_is_verified(uuid)
to authenticated;
grant execute
on function private.profiles_are_blocked(uuid, uuid)
to authenticated;
alter table public.profile_follows enable row level security;
revoke all on table public.profile_follows from anon, authenticated;
grant select (follower_id, following_id, created_at)
on public.profile_follows
to authenticated;
grant insert (follower_id, following_id)
on public.profile_follows
to authenticated;
grant delete
on public.profile_follows
to authenticated;
create policy "Verified users can view university profile follows"
on public.profile_follows
for select
to authenticated
using ((select private.can_view_profile_follow(
  follower_id,
  following_id
)));
create policy "Verified users can follow university profiles"
on public.profile_follows
for insert
to authenticated
with check (
  follower_id = (select auth.uid())
  and (select private.can_follow_profile(following_id))
);
create policy "Users can remove own profile follows"
on public.profile_follows
for delete
to authenticated
using (follower_id = (select auth.uid()));
-- One call supplies the social header state without a sequence of count/status
-- queries. Security-invoker semantics preserve table RLS for every count.
create or replace function public.get_profile_social_summary(
  target_profile_id uuid
)
returns table (
  follower_count bigint,
  following_count bigint,
  is_followed_by_current_user boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (
      select count(*)
      from public.profile_follows as follow
      where follow.following_id = target_profile_id
    ) as follower_count,
    (
      select count(*)
      from public.profile_follows as follow
      where follow.follower_id = target_profile_id
    ) as following_count,
    exists (
      select 1
      from public.profile_follows as follow
      where follow.follower_id = (select auth.uid())
        and follow.following_id = target_profile_id
    ) as is_followed_by_current_user
  where target_profile_id = (select auth.uid())
    or (
      (select private.is_verified_user())
      and (select private.profile_is_verified(target_profile_id))
      and (select private.profile_is_in_current_university(target_profile_id))
      and not (select private.profiles_are_blocked(
        (select auth.uid()),
        target_profile_id
      ))
    );
$$;
revoke all
on function public.get_profile_social_summary(uuid)
from public, anon;
grant execute
on function public.get_profile_social_summary(uuid)
to authenticated;
create or replace function public.get_profile_connections(
  target_profile_id uuid,
  connection_kind text,
  cursor_created_at timestamptz default null,
  cursor_profile_id uuid default null,
  result_limit integer default 24
)
returns table (
  created_at timestamptz,
  profile_id uuid,
  full_name text,
  username text,
  branch text,
  year integer,
  avatar_path text,
  is_verified boolean,
  institute_short_name text,
  is_followed_by_current_user boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with connections as (
    select
      follow.created_at,
      case connection_kind
        when 'followers' then follow.follower_id
        when 'following' then follow.following_id
      end as profile_id
    from public.profile_follows as follow
    where connection_kind in ('followers', 'following')
      and (
        (connection_kind = 'followers'
          and follow.following_id = target_profile_id)
        or
        (connection_kind = 'following'
          and follow.follower_id = target_profile_id)
      )
  )
  select
    connection.created_at,
    profile.id,
    profile.full_name,
    profile.username,
    profile.branch,
    profile.year,
    profile.avatar_path,
    profile.is_verified,
    institute.short_name,
    exists (
      select 1
      from public.profile_follows as viewer_follow
      where viewer_follow.follower_id = (select auth.uid())
        and viewer_follow.following_id = profile.id
    )
  from connections as connection
  join public.profiles as profile
    on profile.id = connection.profile_id
  join public.institutes as institute
    on institute.id = profile.institute_id
  where cursor_created_at is null
    or connection.created_at < cursor_created_at
    or (
      connection.created_at = cursor_created_at
      and connection.profile_id < cursor_profile_id
    )
  order by connection.created_at desc, connection.profile_id desc
  limit least(greatest(result_limit, 1), 50);
$$;
revoke all
on function public.get_profile_connections(
  uuid,
  text,
  timestamptz,
  uuid,
  integer
)
from public, anon;
grant execute
on function public.get_profile_connections(
  uuid,
  text,
  timestamptz,
  uuid,
  integer
)
to authenticated;
create or replace function public.get_followed_organizations_page(
  cursor_created_at timestamptz default null,
  cursor_organization_id uuid default null,
  result_limit integer default 24
)
returns table (
  created_at timestamptz,
  organization_id uuid,
  name text,
  avatar_path text,
  is_verified boolean,
  campus_short_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    follow.created_at,
    organization.id,
    organization.name,
    organization.avatar_path,
    organization.is_verified,
    coalesce(institute.short_name, university.short_name)
  from public.organization_follows as follow
  join public.organizations as organization
    on organization.id = follow.organization_id
  join public.universities as university
    on university.id = organization.university_id
  left join public.institutes as institute
    on institute.id = organization.institute_id
  where follow.user_id = (select auth.uid())
    and (
      cursor_created_at is null
      or follow.created_at < cursor_created_at
      or (
        follow.created_at = cursor_created_at
        and follow.organization_id < cursor_organization_id
      )
    )
  order by follow.created_at desc, follow.organization_id desc
  limit least(greatest(result_limit, 1), 50);
$$;
revoke all
on function public.get_followed_organizations_page(
  timestamptz,
  uuid,
  integer
)
from public, anon;
grant execute
on function public.get_followed_organizations_page(
  timestamptz,
  uuid,
  integer
)
to authenticated;
create or replace function private.create_profile_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
begin
  if not (select private.notification_preference_enabled(
    new.following_id,
    'profile_follow'
  )) then
    return new;
  end if;

  select coalesce(nullif(trim(profile.full_name), ''), 'A student')
  into actor_name
  from public.profiles as profile
  where profile.id = new.follower_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title,
    body
  )
  values (
    new.following_id,
    new.follower_id,
    'profile_follow',
    actor_name || ' started following you',
    'Open their student profile.'
  )
  on conflict do nothing;

  return new;
end;
$$;
create unique index notifications_unique_profile_follow_idx
on public.notifications(recipient_id, actor_id)
where type = 'profile_follow'
  and actor_id is not null;
create trigger profile_follows_create_notification
after insert on public.profile_follows
for each row
execute function private.create_profile_follow_notification();
-- Blocking is the source of truth: relationship edges are removed in both
-- directions in the same transaction as the new block.
create or replace function private.remove_profile_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profile_follows as follow
  where (
    follow.follower_id = new.blocker_id
    and follow.following_id = new.blocked_id
  )
  or (
    follow.follower_id = new.blocked_id
    and follow.following_id = new.blocker_id
  );

  return new;
end;
$$;
create trigger user_blocks_remove_profile_follows
after insert on public.user_blocks
for each row
execute function private.remove_profile_follows_on_block();
revoke all
on function private.create_profile_follow_notification()
from public, anon, authenticated;
revoke all
on function private.remove_profile_follows_on_block()
from public, anon, authenticated;
comment on table public.profile_follows is
  'Student-to-student follows, separate from organization_follows.';
comment on function public.get_profile_social_summary(uuid) is
  'RLS-aware people follower/following totals and current-user follow state.';
comment on function public.get_profile_connections(
  uuid,
  text,
  timestamptz,
  uuid,
  integer
) is
  'Keyset-paginated RLS-aware people follower or following rows.';
comment on function public.get_followed_organizations_page(
  timestamptz,
  uuid,
  integer
) is
  'Keyset-paginated organizations followed by the current user.';
