-- ============================================================
-- HARDEN PROFILE AND ORGANIZATION LINKS
--
-- Profile links:
--   - self remains readable during onboarding
--   - other users must be verified
--   - target profile must also be verified
--   - target must belong to the same university
--
-- Organization links:
--   - owner/admin only
--   - caller must be verified
--   - organization must be active
--   - organization must belong to caller's university
-- ============================================================


-- ============================================================
-- PROFILE LINKS
-- ============================================================

drop policy if exists
  "Users can view visible profile links"
on public.profile_links;


create policy
  "Users can view visible profile links"
on public.profile_links
for select
to authenticated
using (
  profile_id = (select auth.uid())

  or

  (
    (select private.is_verified_user())

    and exists (
      select 1
      from public.profiles as target_profile
      where target_profile.id =
        profile_links.profile_id
        and target_profile.is_verified = true
    )

    and (
      select private.profile_is_in_current_university(
        profile_links.profile_id
      )
    )
  )
);


comment on policy
  "Users can view visible profile links"
on public.profile_links
is
  'Users may read their own links during onboarding. Other profile links require a verified viewer, verified target, and same-university membership.';


-- ============================================================
-- ORGANIZATION LINKS
--
-- Keep the existing owner/admin role system.
-- Editors must not manage organization profile links.
-- ============================================================

drop policy if exists
  "Owners and admins can create organization links"
on public.organization_links;

drop policy if exists
  "Owners and admins can update organization links"
on public.organization_links;

drop policy if exists
  "Owners and admins can delete organization links"
on public.organization_links;


create policy
  "Owners and admins can create organization links"
on public.organization_links
for insert
to authenticated
with check (
  (select private.is_verified_user())

  and (
    select private.can_view_organization(
      organization_links.organization_id
    )
  )

  and (
    select private.has_organization_role(
      organization_links.organization_id,
      array['owner', 'admin']
    )
  )
);


create policy
  "Owners and admins can update organization links"
on public.organization_links
for update
to authenticated
using (
  (select private.is_verified_user())

  and (
    select private.can_view_organization(
      organization_links.organization_id
    )
  )

  and (
    select private.has_organization_role(
      organization_links.organization_id,
      array['owner', 'admin']
    )
  )
)
with check (
  (select private.is_verified_user())

  and (
    select private.can_view_organization(
      organization_links.organization_id
    )
  )

  and (
    select private.has_organization_role(
      organization_links.organization_id,
      array['owner', 'admin']
    )
  )
);


create policy
  "Owners and admins can delete organization links"
on public.organization_links
for delete
to authenticated
using (
  (select private.is_verified_user())

  and (
    select private.can_view_organization(
      organization_links.organization_id
    )
  )

  and (
    select private.has_organization_role(
      organization_links.organization_id,
      array['owner', 'admin']
    )
  )
);


comment on policy
  "Owners and admins can create organization links"
on public.organization_links
is
  'Only verified owner/admin members of active same-university organizations may create organization links.';


comment on policy
  "Owners and admins can update organization links"
on public.organization_links
is
  'Only verified owner/admin members of active same-university organizations may update organization links.';


comment on policy
  "Owners and admins can delete organization links"
on public.organization_links
is
  'Only verified owner/admin members of active same-university organizations may delete organization links.';