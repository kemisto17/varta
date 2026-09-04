-- ============================================================
-- LIMIT VERIFICATION DOCUMENT UPLOADS
--
-- A student may have at most one pending/orphan verification
-- document in Storage at a time.
--
-- This prevents authenticated users from repeatedly uploading
-- verification images without ever submitting verification.
-- ============================================================


-- ------------------------------------------------------------
-- TRUSTED STORAGE CHECK
-- ------------------------------------------------------------

create or replace function
private.current_user_has_verification_document()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1

    from storage.objects as document

    where document.bucket_id =
      'verification-documents'

      and cardinality(
        storage.foldername(
          document.name
        )
      ) = 1

      and (
        storage.foldername(
          document.name
        )
      )[1] =
        (select auth.uid())::text
  );
$$;
revoke all
on function
private.current_user_has_verification_document()
from public, anon, authenticated;
grant execute
on function
private.current_user_has_verification_document()
to authenticated;
-- ------------------------------------------------------------
-- REPLACE UPLOAD POLICY
-- ------------------------------------------------------------

drop policy if exists
  "Users can upload own verification document"
on storage.objects;
create policy
  "Users can upload own verification document"
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'verification-documents'

  and

  cardinality(
    storage.foldername(name)
  ) = 1

  and

  (
    storage.foldername(name)
  )[1] =
    (select auth.uid())::text

  and

  storage.filename(name) ~
    '^student-id-[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'

  and

  exists (
    select 1

    from public.profiles as profile

    where profile.id =
      (select auth.uid())
  )

  and

  not exists (
    select 1

    from public.student_verifications
      as verification

    where verification.user_id =
      (select auth.uid())
  )

  and

  not (
    select
      private.current_user_has_verification_document()
  )
);
comment on function
private.current_user_has_verification_document()
is
  'Returns whether the authenticated user already owns a verification document, preventing repeated pre-submission uploads.';
