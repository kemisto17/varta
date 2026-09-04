-- ============================================================
-- HARDEN STUDENT PROFILE VISIBILITY
--
-- A student must always be able to read their own profile
-- during onboarding.
--
-- Other students may only read the profile when:
--   1. the viewer is verified
--   2. the target profile is verified
--   3. both belong to the same university
-- ============================================================

drop policy if exists
  "Users can view own or university profiles"
on public.profiles;
create policy
  "Users can view own or verified university profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())

  or

  (
    (select private.is_verified_user())

    and

    profiles.is_verified = true

    and

    (
      select private.profile_is_in_current_university(
        profiles.id
      )
    )
  )
);
comment on policy
  "Users can view own or verified university profiles"
on public.profiles
is
  'Users retain self-read access during onboarding. Other profiles require both a verified viewer and verified target in the same university.';
-- ============================================================
-- KEEP PROFILE SUMMARY VISIBILITY CONSISTENT WITH PROFILE RLS
-- ============================================================

create or replace function
public.get_profile_organization_following_count(
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

      or

      (
        (select private.is_verified_user())

        and exists (
          select 1

          from public.profiles as target_profile

          where target_profile.id =
            target_profile_id

            and target_profile.is_verified = true
        )

        and (
          select private.profile_is_in_current_university(
            target_profile_id
          )
        )

        and not (
          select private.current_user_has_blocked(
            target_profile_id
          )
        )
      )
    );
$$;
revoke all
on function
public.get_profile_organization_following_count(uuid)
from public, anon;
grant execute
on function
public.get_profile_organization_following_count(uuid)
to authenticated;
