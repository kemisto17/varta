-- Preserve legacy Supabase avatar paths while allowing the new R2 object-key
-- format. Both formats remain bound to the profile's immutable auth UUID.

alter table public.profiles
drop constraint profile_avatar_path_format;

alter table public.profiles
add constraint profile_avatar_path_format
check (
  avatar_path is null
  or avatar_path ~ (
    '^' || id::text
    || '/[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'
  )
  or avatar_path ~ (
    '^avatars/users/' || id::text
    || '/[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'
  )
);
