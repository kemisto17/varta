-- Remove the accidental student-to-student follow graph without changing the
-- independent organization_follows feature or its organization-only paging RPC.

drop trigger if exists user_blocks_remove_profile_follows
on public.user_blocks;

drop function if exists private.remove_profile_follows_on_block();

drop function if exists public.get_profile_connections(
  uuid,
  text,
  timestamptz,
  uuid,
  integer
);

drop function if exists public.get_profile_social_summary(uuid);

drop table if exists public.profile_follows;

drop function if exists private.create_profile_follow_notification();
drop function if exists private.can_view_profile_follow(uuid, uuid);
drop function if exists private.can_follow_profile(uuid);
drop function if exists private.profiles_are_blocked(uuid, uuid);
drop function if exists private.profile_is_verified(uuid);

alter table public.notification_preferences
drop column if exists follows_enabled;

delete from public.notifications
where type = 'profile_follow';

drop function if exists private.notification_preference_enabled(
  uuid,
  public.notification_type
);

drop index if exists public.notifications_unique_profile_follow_idx;
drop index if exists public.notifications_unique_post_like_idx;
drop index if exists public.notifications_unique_post_comment_idx;
drop index if exists public.notifications_unique_verification_transition_idx;
drop index if exists public.notifications_unique_badge_assignment_idx;
drop index if exists public.notifications_unique_event_cancellation_idx;

alter type public.notification_type
rename to notification_type_with_profile_follow;

create type public.notification_type as enum (
  'post_like',
  'post_comment',
  'verification_approved',
  'verification_rejected',
  'badge_assigned',
  'event_cancelled'
);

alter table public.notifications
alter column type type public.notification_type
using type::text::public.notification_type;

drop type public.notification_type_with_profile_follow;

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

create unique index notifications_unique_event_cancellation_idx
on public.notifications(recipient_id, event_id, type)
where event_id is not null;

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

comment on function public.get_followed_organizations_page(
  timestamptz,
  uuid,
  integer
) is
  'Current user organization follows, kept independently of student profiles.';;
