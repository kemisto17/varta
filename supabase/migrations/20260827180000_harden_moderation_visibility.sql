-- ============================================================
-- HARDEN MODERATION VISIBILITY
--
-- 1. Students may only block verified, same-university profiles.
-- 2. Reports must target content that belongs to the current
--    university.
-- 3. Organization posts and comments on organization posts
--    must remain reportable.
-- 4. Profile reports must target verified campus profiles.
-- ============================================================


-- ------------------------------------------------------------
-- BLOCKS
-- ------------------------------------------------------------

drop policy if exists
  "Verified users can block university profiles"
on public.user_blocks;
create policy
  "Verified users can block visible university profiles"
on public.user_blocks
for insert
to authenticated
with check (
  blocker_id = (select auth.uid())

  and blocked_id <> (select auth.uid())

  and (select private.is_verified_user())

  and exists (
    select 1
    from public.profiles as blocked_profile
    where blocked_profile.id = blocked_id
      and blocked_profile.is_verified = true
  )

  and (
    select private.profile_is_in_current_university(
      blocked_id
    )
  )
);
-- ------------------------------------------------------------
-- REPORT TARGET VALIDATION
-- ------------------------------------------------------------

create or replace function private.can_report_target(
  submitted_reporter_id uuid,
  submitted_target_type public.report_target_type,
  submitted_post_id uuid,
  submitted_comment_id uuid,
  submitted_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    submitted_reporter_id = (select auth.uid())

    and submitted_reporter_id is not null

    and (select private.is_verified_user())

    and num_nonnulls(
      submitted_post_id,
      submitted_comment_id,
      submitted_profile_id
    ) = 1

    and case submitted_target_type

      when 'post' then
        submitted_post_id is not null

        and submitted_comment_id is null

        and submitted_profile_id is null

        and exists (
          select 1

          from public.posts as post

          where post.id = submitted_post_id

            -- Students cannot report their own student post.
            -- Organization posts have no individual author_id
            -- and remain reportable.
            and (
              post.author_id is null
              or post.author_id <> submitted_reporter_id
            )

            and (
              select private.post_is_in_current_university(
                post.id
              )
            )

            and not (
              select private.current_user_has_blocked_post_author(
                post.id
              )
            )
        )


      when 'comment' then
        submitted_post_id is null

        and submitted_comment_id is not null

        and submitted_profile_id is null

        and exists (
          select 1

          from public.comments as comment

          where comment.id = submitted_comment_id

            and comment.author_id <>
              submitted_reporter_id

            and (
              select private.post_is_in_current_university(
                comment.post_id
              )
            )

            and not (
              select private.current_user_has_blocked(
                comment.author_id
              )
            )

            and not (
              select private.current_user_has_blocked_post_author(
                comment.post_id
              )
            )
        )


      when 'profile' then
        submitted_post_id is null

        and submitted_comment_id is null

        and submitted_profile_id is not null

        and submitted_profile_id <>
          submitted_reporter_id

        and exists (
          select 1

          from public.profiles as target_profile

          where target_profile.id =
            submitted_profile_id

            and target_profile.is_verified = true
        )

        and (
          select private.profile_is_in_current_university(
            submitted_profile_id
          )
        )

    end;
$$;
revoke all
on function private.can_report_target(
  uuid,
  public.report_target_type,
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;
grant execute
on function private.can_report_target(
  uuid,
  public.report_target_type,
  uuid,
  uuid,
  uuid
)
to authenticated;
comment on function private.can_report_target(
  uuid,
  public.report_target_type,
  uuid,
  uuid,
  uuid
)
is
  'Validates report targets across student and organization posts while enforcing verified campus visibility.';
