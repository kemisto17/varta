-- Capture the organization profile permissions that were applied manually to
-- the linked project. Organization membership roles remain owner/admin/editor;
-- only owners and admins may edit profile fields or manage avatar objects.

create or replace function private.can_manage_organization_avatar(
  target_organization_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (select private.is_verified_user())
    and target_organization_id ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.organization_members as membership
      join public.organizations as organization
        on organization.id = membership.organization_id
      where membership.organization_id::text = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin')
        and organization.is_active
        and organization.university_id = (
          select private.current_university_id()
        )
    );
$$;
revoke all
on function private.can_manage_organization_avatar(text)
from public, anon, authenticated;
grant execute
on function private.can_manage_organization_avatar(text)
to authenticated;
grant update (name, description, avatar_path)
on public.organizations
to authenticated;
drop policy if exists "Organization admins can update organization profile"
on public.organizations;
create policy "Organization admins can update organization profile"
on public.organizations
for update
to authenticated
using (
  (select private.is_verified_user())
  and is_active
  and university_id = (select private.current_university_id())
  and (select private.has_organization_role(
    organizations.id,
    array['owner', 'admin']::text[]
  ))
)
with check (
  (select private.is_verified_user())
  and is_active
  and university_id = (select private.current_university_id())
  and (select private.has_organization_role(
    organizations.id,
    array['owner', 'admin']::text[]
  ))
);
drop policy if exists "Organization admins can upload organization avatars"
on storage.objects;
create policy "Organization admins can upload organization avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-media'
  and cardinality(storage.foldername(name)) = 1
  and (select private.can_manage_organization_avatar(
    (storage.foldername(name))[1]
  ))
  and storage.filename(name) ~
    '^[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'
);
drop policy if exists "Organization admins can delete organization avatars"
on storage.objects;
create policy "Organization admins can delete organization avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organization-media'
  and cardinality(storage.foldername(name)) = 1
  and (select private.can_manage_organization_avatar(
    (storage.foldername(name))[1]
  ))
);
comment on function private.can_manage_organization_avatar(text) is
  'Allows verified organization owners and admins to manage avatar objects for active same-university organizations.';
