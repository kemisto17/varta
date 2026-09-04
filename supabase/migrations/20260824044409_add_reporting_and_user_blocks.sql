-- ============================================================
-- REPORTING AND MODERATION FOUNDATION
--
-- Reports use one nullable foreign key per supported target.
-- This keeps referential integrity without relying on a loose
-- polymorphic target_id. When content is deleted, ON DELETE SET
-- NULL preserves the moderation record and its target type.
-- ============================================================

create type public.report_target_type as enum (
  'post',
  'comment',
  'profile'
);


create type public.report_reason as enum (
  'spam',
  'harassment',
  'hate',
  'impersonation',
  'inappropriate_content',
  'privacy',
  'other'
);


create type public.report_status as enum (
  'pending',
  'reviewing',
  'resolved',
  'dismissed'
);


create table public.reports (
  id uuid primary key default gen_random_uuid(),

  reporter_id uuid not null
    references public.profiles(id)
    on delete cascade,

  target_type public.report_target_type not null,

  post_id uuid
    references public.posts(id)
    on delete set null,

  comment_id uuid
    references public.comments(id)
    on delete set null,

  profile_id uuid
    references public.profiles(id)
    on delete set null,

  reason public.report_reason not null,
  details text,
  status public.report_status not null default 'pending',

  reviewed_by uuid
    references auth.users(id)
    on delete set null,

  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint report_target_alignment
    check (
      num_nonnulls(post_id, comment_id, profile_id) <= 1
      and (post_id is null or target_type = 'post')
      and (comment_id is null or target_type = 'comment')
      and (profile_id is null or target_type = 'profile')
    ),

  constraint report_details_length
    check (
      details is null
      or char_length(details) between 1 and 1000
    ),

  constraint report_resolution_note_length
    check (
      resolution_note is null
      or char_length(resolution_note) between 1 and 2000
    )
);


create table public.user_blocks (
  blocker_id uuid not null
    references public.profiles(id)
    on delete cascade,

  blocked_id uuid not null
    references public.profiles(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  primary key (blocker_id, blocked_id),

  constraint users_cannot_block_themselves
    check (blocker_id <> blocked_id)
);


-- ============================================================
-- INDEXES
-- ============================================================

create index reports_reporter_id_idx
on public.reports(reporter_id);


create index reports_post_id_idx
on public.reports(post_id)
where post_id is not null;


create index reports_comment_id_idx
on public.reports(comment_id)
where comment_id is not null;


create index reports_profile_id_idx
on public.reports(profile_id)
where profile_id is not null;


create index reports_reviewed_by_idx
on public.reports(reviewed_by)
where reviewed_by is not null;


create index reports_open_queue_idx
on public.reports(status, created_at)
where status in ('pending', 'reviewing');


create unique index reports_one_open_post_report_idx
on public.reports(reporter_id, post_id)
where post_id is not null
and status in ('pending', 'reviewing');


create unique index reports_one_open_comment_report_idx
on public.reports(reporter_id, comment_id)
where comment_id is not null
and status in ('pending', 'reviewing');


create unique index reports_one_open_profile_report_idx
on public.reports(reporter_id, profile_id)
where profile_id is not null
and status in ('pending', 'reviewing');


create index user_blocks_blocked_id_idx
on public.user_blocks(blocked_id);


create trigger reports_set_updated_at
before update on public.reports
for each row
execute function private.set_updated_at();


-- ============================================================
-- PRIVATE SECURITY HELPERS
-- ============================================================

create or replace function private.current_user_has_blocked(
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$

  select exists (
    select 1
    from public.user_blocks as user_block
    where user_block.blocker_id = (select auth.uid())
    and user_block.blocked_id = target_profile_id
  );

$$;


create or replace function private.current_user_has_blocked_post_author(
  target_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$

  select exists (
    select 1
    from public.posts as post
    join public.user_blocks as user_block
      on user_block.blocked_id = post.author_id
    where post.id = target_post_id
    and user_block.blocker_id = (select auth.uid())
  );

$$;


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
          join public.profiles as author
            on author.id = post.author_id
          join public.institutes as institute
            on institute.id = author.institute_id
          where post.id = submitted_post_id
          and post.author_id <> submitted_reporter_id
          and institute.university_id =
            (select private.current_university_id())
        )
      when 'comment' then
        submitted_post_id is null
        and submitted_comment_id is not null
        and submitted_profile_id is null
        and exists (
          select 1
          from public.comments as comment
          join public.posts as post
            on post.id = comment.post_id
          join public.profiles as post_author
            on post_author.id = post.author_id
          join public.institutes as institute
            on institute.id = post_author.institute_id
          where comment.id = submitted_comment_id
          and comment.author_id <> submitted_reporter_id
          and institute.university_id =
            (select private.current_university_id())
        )
      when 'profile' then
        submitted_post_id is null
        and submitted_comment_id is null
        and submitted_profile_id is not null
        and submitted_profile_id <> submitted_reporter_id
        and (select private.profile_is_in_current_university(
          submitted_profile_id
        ))
    end;

$$;


revoke all
on function private.current_user_has_blocked(uuid)
from public;


revoke all
on function private.current_user_has_blocked_post_author(uuid)
from public;


revoke all
on function private.can_report_target(
  uuid,
  public.report_target_type,
  uuid,
  uuid,
  uuid
)
from public;


grant execute
on function private.current_user_has_blocked(uuid)
to authenticated;


grant execute
on function private.current_user_has_blocked_post_author(uuid)
to authenticated;


grant execute
on function private.can_report_target(
  uuid,
  public.report_target_type,
  uuid,
  uuid,
  uuid
)
to authenticated;


-- ============================================================
-- TABLE PERMISSIONS AND RLS
-- ============================================================

alter table public.reports
enable row level security;


alter table public.user_blocks
enable row level security;


revoke all on table public.reports
from anon, authenticated;


grant insert (
  reporter_id,
  target_type,
  post_id,
  comment_id,
  profile_id,
  reason,
  details
)
on public.reports
to authenticated;


revoke all on table public.user_blocks
from anon, authenticated;


grant select
on table public.user_blocks
to authenticated;


grant insert (
  blocker_id,
  blocked_id
)
on public.user_blocks
to authenticated;


grant delete
on table public.user_blocks
to authenticated;


create policy "Verified users can submit reports"
on public.reports
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and resolution_note is null
  and (select private.can_report_target(
    reporter_id,
    target_type,
    post_id,
    comment_id,
    profile_id
  ))
);


create policy "Users can view own blocks"
on public.user_blocks
for select
to authenticated
using (
  blocker_id = (select auth.uid())
);


create policy "Verified users can block university profiles"
on public.user_blocks
for insert
to authenticated
with check (
  blocker_id = (select auth.uid())
  and blocked_id <> (select auth.uid())
  and (select private.is_verified_user())
  and (select private.profile_is_in_current_university(blocked_id))
);


create policy "Users can remove own blocks"
on public.user_blocks
for delete
to authenticated
using (
  blocker_id = (select auth.uid())
);


-- ============================================================
-- BLOCK-AWARE CONTENT POLICIES
-- ============================================================

drop policy "Verified students can view university posts"
on public.posts;


create policy "Verified students can view university posts"
on public.posts
for select
to authenticated
using (
  (select private.is_verified_user())
  and (select private.profile_is_in_current_university(author_id))
  and not (select private.current_user_has_blocked(author_id))
);


drop policy "Verified students can view university likes"
on public.post_likes;


create policy "Verified students can view university likes"
on public.post_likes
for select
to authenticated
using (
  (select private.is_verified_user())
  and (select private.post_is_in_current_university(post_id))
  and not (select private.current_user_has_blocked_post_author(post_id))
);


drop policy "Verified students can like university posts"
on public.post_likes;


create policy "Verified students can like university posts"
on public.post_likes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_verified_user())
  and (select private.post_is_in_current_university(post_id))
  and not (select private.current_user_has_blocked_post_author(post_id))
);


drop policy "Verified students can view university comments"
on public.comments;


create policy "Verified students can view university comments"
on public.comments
for select
to authenticated
using (
  (select private.is_verified_user())
  and (select private.post_is_in_current_university(post_id))
  and not (select private.current_user_has_blocked(author_id))
  and not (select private.current_user_has_blocked_post_author(post_id))
);


drop policy "Verified students can comment on university posts"
on public.comments;


create policy "Verified students can comment on university posts"
on public.comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (select private.is_verified_user())
  and (select private.post_is_in_current_university(post_id))
  and not (select private.current_user_has_blocked_post_author(post_id))
);

;
