insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'organization-media',
  'organization-media',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.organizations
  add constraint organizations_avatar_path_format_check
  check (
    avatar_path is null
    or avatar_path ~ (
      '^' || id::text || '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
    )
  );

create or replace function private.can_view_organization_media(
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_path ~ (
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab]'
      || '[0-9a-f]{3}-[0-9a-f]{12}/[a-z0-9-]+[.]'
      || '(jpg|jpeg|png|webp|heic|heif)$'
    ) then exists (
      select 1
      from public.organizations as organization
      where organization.id = split_part(target_path, '/', 1)::uuid
        and organization.avatar_path = target_path
        and (select private.can_view_organization(organization.id))
    )
    else false
  end;
$$;

revoke all on function private.can_view_organization_media(text)
from public, anon;
grant execute on function private.can_view_organization_media(text)
to authenticated;

create policy "Students can view visible organization media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organization-media'
  and (select private.can_view_organization_media(name))
);

comment on function private.can_view_organization_media(text) is
  'Allows signed URLs only for the active avatar of an organization visible through RLS.';
