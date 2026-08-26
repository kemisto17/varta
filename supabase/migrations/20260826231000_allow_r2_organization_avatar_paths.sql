alter table public.organizations
drop constraint if exists organizations_avatar_path_format_check;

alter table public.organizations
add constraint organizations_avatar_path_format_check
check (
  avatar_path is null
  or avatar_path ~ (
    '^' || id::text ||
    '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
  )
  or avatar_path ~ (
    '^avatars/organizations/' ||
    id::text ||
    '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
  )
);