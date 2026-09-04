-- ============================================================
-- HARDEN ORGANIZATION SCOPE AND BADGE VISIBILITY
--
-- Organization visibility:
--   - organization must be active
--   - organization must always belong to the caller's university
--   - organization members may retain access before verification
--   - non-members must be verified
--
-- Profile badges:
--   - self remains visible
--   - other assignments require:
--       verified viewer
--       verified target
--       same university
--       public badge
-- ============================================================


-- ============================================================
-- ORGANIZATION VISIBILITY
-- ============================================================

create or replace function
private.can_view_organization(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null

    and exists (
      select 1

      from public.organizations as organization

      where organization.id =
        target_organization_id

        and organization.is_active = true

        -- Organization scope must always
        -- match the current user's university,
        -- including existing organization members.
        and organization.university_id =
          (
            select private.current_university_id()
          )

        and (
          -- Existing organization members may
          -- still access their organization while
          -- completing account verification.
          exists (
            select 1

            from public.organization_members
              as membership

            where membership.organization_id =
              organization.id

              and membership.user_id =
                (select auth.uid())
          )

          or

          -- Ordinary campus viewers must
          -- already be verified.
          (select private.is_verified_user())
        )
    );
$$;
revoke all
on function
private.can_view_organization(uuid)
from public, anon;
grant execute
on function
private.can_view_organization(uuid)
to authenticated;
comment on function
private.can_view_organization(uuid)
is
  'Allows active organizations only within the current user university. Members may view their organization during onboarding; non-members must be verified.';
-- ============================================================
-- PROFILE BADGE VISIBILITY
-- ============================================================

drop policy if exists
  "Users can view visible profile badge assignments"
on public.profile_badges;
create policy
  "Users can view visible profile badge assignments"
on public.profile_badges
for select
to authenticated
using (
  profile_id = (select auth.uid())

  or

  (
    (
      select private.badge_is_public(
        profile_badges.badge_id
      )
    )

    and

    (select private.is_verified_user())

    and

    exists (
      select 1

      from public.profiles as target_profile

      where target_profile.id =
        profile_badges.profile_id

        and target_profile.is_verified = true
    )

    and

    (
      select private.profile_is_in_current_university(
        profile_badges.profile_id
      )
    )
  )
);
comment on policy
  "Users can view visible profile badge assignments"
on public.profile_badges
is
  'Users may read their own badge assignments. Other assignments require a public badge, verified viewer, verified target, and same-university membership.';
