-- ============================================================
-- HARDEN PROFILE FOLLOWING COUNT BLOCK PRIVACY
--
-- Student profiles do not have student-follow counts.
--
-- This RPC returns only the number of organizations a student
-- follows.
--
-- Because it is SECURITY DEFINER, it must reproduce the same
-- visibility guarantees as the student profile:
--
--   - self can always read own count
--   - other viewer must be verified
--   - target must be verified
--   - same university
--   - no block relationship in either direction
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

  from public.organization_follows
    as follow

  where follow.user_id =
    target_profile_id

    and (
      -- Own count remains available during
      -- onboarding/profile setup.
      target_profile_id =
        (select auth.uid())

      or

      (
        -- Other profiles require a verified
        -- authenticated viewer.
        (select private.is_verified_user())

        and

        -- Target itself must be verified.
        exists (
          select 1

          from public.profiles
            as target_profile

          where target_profile.id =
            target_profile_id

            and target_profile.is_verified =
              true
        )

        and

        -- Target must belong to the same
        -- university as the viewer.
        (
          select
            private.profile_is_in_current_university(
              target_profile_id
            )
        )

        and

        -- Blocking is a bidirectional privacy
        -- boundary.
        not (
          select
            private.users_have_block_relation(
              target_profile_id
            )
        )
      )
    );
$$;


revoke all
on function
public.get_profile_organization_following_count(uuid)
from public, anon, authenticated;


grant execute
on function
public.get_profile_organization_following_count(uuid)
to authenticated;


comment on function
public.get_profile_organization_following_count(uuid)
is
  'Returns organization-following count only when the target profile is visible under verified campus and bidirectional block privacy rules.';