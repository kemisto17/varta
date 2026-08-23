-- ============================================================
-- UNIQUE PRIVATE STUDENT VERIFICATION DOCUMENT PATHS
-- ============================================================

-- New submissions use an immutable, generated identifier instead of
-- repeatedly targeting student-id.<ext>. The authenticated user's UUID
-- remains the only folder component and no student PII enters the path.

alter policy "Users can submit own verification"
on public.student_verifications
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
    '/student-id-[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'
  )

  and

  exists (
    select 1
    from storage.objects as document
    where document.bucket_id = 'verification-documents'
      and document.name = id_document_path
  )
);


alter policy "Users can upload own verification document"
on storage.objects
with check (
  bucket_id = 'verification-documents'

  and

  cardinality(storage.foldername(name)) = 1

  and

  (storage.foldername(name))[1] =
    (select auth.uid())::text

  and

  storage.filename(name) ~
    '^student-id-[a-z0-9-]{8,}[.](jpg|jpeg|png|webp|heic|heif)$'

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
