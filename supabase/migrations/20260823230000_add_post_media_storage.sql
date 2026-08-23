-- ============================================================
-- PRIVATE CAMPUS POST MEDIA
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'post-media',
  'post-media',
  false,
  8388608,
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
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- The secondary UUID order makes the existing newest-first index
-- deterministic for keyset pagination when timestamps match.

create index if not exists posts_feed_cursor_idx
on public.posts(created_at desc, id desc);


-- Only verified students can upload into their own UUID folder.
-- There is intentionally no UPDATE policy; post images are immutable.

create policy "Verified users can upload own post media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'

  and

  (select private.is_verified_user())

  and

  cardinality(storage.foldername(name)) = 1

  and

  (storage.foldername(name))[1] =
    (select auth.uid())::text

  and

  storage.filename(name) ~
    '^[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
);


-- The bucket remains private. A signed URL can only be created for
-- media referenced by a visible same-university post.

create policy "Verified users can view university post media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'post-media'

  and

  (select private.is_verified_user())

  and

  exists (
    select 1
    from public.posts as post
    where post.image_path = storage.objects.name
      and (
        select private.profile_is_in_current_university(post.author_id)
      )
  )
);


-- Post owners can clean up their own immutable media after deleting
-- the database row, or if a post insert fails after upload.

create policy "Users can delete own post media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-media'

  and

  owner_id = (select auth.uid()::text)

  and

  cardinality(storage.foldername(name)) = 1

  and

  (storage.foldername(name))[1] =
    (select auth.uid())::text
);
