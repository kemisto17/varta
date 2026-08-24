-- ============================================================
-- TRUSTED PROFILE VERIFICATION STATE
-- ============================================================

-- This value is readable with the safe campus profile, but students do
-- not receive INSERT or UPDATE privileges for it. The private trigger is
-- the only writer and mirrors the authoritative verification record.

alter table public.profiles
add column is_verified boolean not null default false;


update public.profiles as profile
set is_verified = exists (
  select 1
  from public.student_verifications as verification
  where verification.user_id = profile.id
    and verification.status = 'verified'
);


create or replace function private.sync_profile_verification_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  target_user_id := case
    when tg_op = 'DELETE' then old.user_id
    else new.user_id
  end;

  update public.profiles as profile
  set is_verified = exists (
    select 1
    from public.student_verifications as verification
    where verification.user_id = target_user_id
      and verification.status = 'verified'
  )
  where profile.id = target_user_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


revoke all
on function private.sync_profile_verification_status()
from public, anon, authenticated;


create trigger student_verifications_sync_profile_status
after insert or delete or update of status
on public.student_verifications
for each row
execute function private.sync_profile_verification_status();


-- Prevent a profile from pointing at another student's object or at an
-- arbitrary Storage path. Signed URLs are never persisted here.

alter table public.profiles
add constraint profile_avatar_path_format
check (
  avatar_path is null
  or avatar_path ~ (
    '^' || id::text ||
    '/[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'
  )
);


-- ============================================================
-- PRIVATE CAMPUS AVATARS
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
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
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- Avatar objects use an immutable generated filename under the student's
-- auth UUID. No username, enrollment number, or other PII enters the path.

create policy "Verified users can upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'

  and

  (select private.is_verified_user())

  and

  owner_id = (select auth.uid()::text)

  and

  cardinality(storage.foldername(name)) = 1

  and

  (storage.foldername(name))[1] =
    (select auth.uid())::text

  and

  storage.filename(name) ~
    '^[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'
);


-- The bucket remains private. Students can always render their own avatar;
-- other reads require a verified viewer and a profile in the same university.

create policy "Students can view permitted avatars"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'

  and

  cardinality(storage.foldername(name)) = 1

  and

  (
    (storage.foldername(name))[1] =
      (select auth.uid())::text

    or

    (
      (select private.is_verified_user())

      and

      exists (
        select 1
        from public.profiles as avatar_profile
        where avatar_profile.id::text =
          (storage.foldername(storage.objects.name))[1]
          and (
            select private.profile_is_in_current_university(
              avatar_profile.id
            )
          )
      )
    )
  )
);


-- The app replaces avatars with a new immutable object, but this policy also
-- makes any direct object update remain strictly scoped to the owner.

create policy "Users can update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(name) ~
    '^[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'
);


create policy "Users can delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'

  and

  owner_id = (select auth.uid()::text)

  and

  cardinality(storage.foldername(name)) = 1

  and

  (storage.foldername(name))[1] =
    (select auth.uid())::text
);
