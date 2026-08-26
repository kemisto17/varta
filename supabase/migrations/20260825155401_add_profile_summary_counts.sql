-- Small aggregate RPCs keep profile headers efficient without relaxing the
-- underlying row-level policies for relationship lists.

create or replace function public.get_profile_organization_following_count(
  target_profile_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.organization_follows as follow
  where follow.user_id = target_profile_id
    and (
      target_profile_id = (select auth.uid())
      or (
        (select private.is_verified_user())
        and (select private.profile_is_in_current_university(
          target_profile_id
        ))
        and not (select private.current_user_has_blocked(
          target_profile_id
        ))
      )
    );
$$;

revoke all
on function public.get_profile_organization_following_count(uuid)
from public, anon;

grant execute
on function public.get_profile_organization_following_count(uuid)
to authenticated;

create or replace function public.get_organization_profile_summary(
  target_organization_id uuid
)
returns table (
  follower_count bigint,
  event_count bigint
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
    )
  where (select private.can_view_organization(target_organization_id));
$$;

revoke all
on function public.get_organization_profile_summary(uuid)
from public, anon;

grant execute
on function public.get_organization_profile_summary(uuid)
to authenticated;

comment on function public.get_profile_organization_following_count(uuid) is
  'Visible student profile count of followed organizations; does not expose rows.';

comment on function public.get_organization_profile_summary(uuid) is
  'Visible organization follower and published event totals for profile headers.';
