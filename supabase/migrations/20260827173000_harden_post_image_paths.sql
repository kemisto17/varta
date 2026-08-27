-- ============================================================
-- HARDEN POST IMAGE PATHS
--
-- A post may only reference media belonging to its author.
--
-- Supported formats:
--
-- Student legacy Supabase Storage:
--   <user-id>/<file>
--
-- Student R2:
--   posts/users/<user-id>/<file>
--
-- Organization legacy Supabase Storage:
--   <organization-id>/<uploader-id>/<file>
--
-- Organization R2:
--   posts/organizations/<organization-id>/<uploader-id>/<file>
-- ============================================================


alter table public.posts
add constraint post_image_path_matches_author
check (
  image_path is null

  or

  (
    author_id is not null
    and organization_author_id is null

    and (
      image_path ~ (
        '^'
        || author_id::text
        || '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
      )

      or

      image_path ~ (
        '^posts/users/'
        || author_id::text
        || '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
      )
    )
  )

  or

  (
    author_id is null
    and organization_author_id is not null

    and (
      image_path ~ (
        '^'
        || organization_author_id::text
        || '/'
        || '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-'
        || '[89ab][0-9a-f]{3}-[0-9a-f]{12}'
        || '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
      )

      or

      image_path ~ (
        '^posts/organizations/'
        || organization_author_id::text
        || '/'
        || '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-'
        || '[89ab][0-9a-f]{3}-[0-9a-f]{12}'
        || '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
      )
    )
  )
);


comment on constraint post_image_path_matches_author
on public.posts
is
  'Prevents posts from referencing media belonging to another student or organization.';