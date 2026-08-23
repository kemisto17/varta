-- ============================================================
-- PRIVATE STUDENT VERIFICATION DOCUMENTS
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'verification-documents',
  'verification-documents',
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


-- A client-submitted verification must point to the authenticated
-- user's private student ID document. Status and method continue to
-- come exclusively from database defaults.

drop policy if exists "Users can submit own verification"
on public.student_verifications;

create policy "Users can submit own verification"
on public.student_verifications
for insert
to authenticated
with check (
  user_id = (select auth.uid())

  and

  university_id =
    (select private.current_university_id())

  and

  status = 'pending'

  and

  method = 'student_id'

  and

  reviewed_at is null

  and

  reviewer_id is null

  and

  id_document_path ~ (
    '^' || (select auth.uid())::text ||
    '/student-id[.](jpg|jpeg|png|webp|heic|heif)$'
  )

  and

  exists (
    select 1
    from storage.objects as document
    where document.bucket_id = 'verification-documents'
      and document.name = id_document_path
  )
);


-- Uploads are limited to one predictable file inside the user's own
-- UUID folder. There is intentionally no UPDATE policy, so the client
-- cannot overwrite a document that is already under review.

create policy "Users can upload own verification document"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification-documents'

  and

  cardinality(storage.foldername(name)) = 1

  and

  (storage.foldername(name))[1] =
    (select auth.uid())::text

  and

  storage.filename(name) ~
    '^student-id[.](jpg|jpeg|png|webp|heic|heif)$'

  and

  exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
  )

  and

  not exists (
    select 1
    from public.student_verifications as verification
    where verification.user_id = (select auth.uid())
  )
);


-- Students can view only the object inside their own private folder.
-- The bucket remains private, so there is no unauthenticated URL.

create policy "Users can view own verification document"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification-documents'

  and

  cardinality(storage.foldername(name)) = 1

  and

  (storage.foldername(name))[1] =
    (select auth.uid())::text
);


-- A user may remove a document only when cleaning up an upload whose
-- database insert failed, or when replacing a rejected submission.

create policy "Users can delete replaceable verification document"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'verification-documents'

  and

  cardinality(storage.foldername(name)) = 1

  and

  (storage.foldername(name))[1] =
    (select auth.uid())::text

  and

  (
    not exists (
      select 1
      from public.student_verifications as verification
      where verification.user_id = (select auth.uid())
    )

    or

    exists (
      select 1
      from public.student_verifications as verification
      where verification.user_id = (select auth.uid())
        and verification.status = 'rejected'
        and verification.id_document_path = storage.objects.name
    )
  )
);
