-- ============================================================
-- VARTA - INITIAL DATABASE SCHEMA
--
-- Structure:
--
-- auth.users
--     |
--     +---- profiles
--     |       |
--     |       +---- institute
--     |               |
--     |               +---- university
--     |
--     +---- student_verifications
--
-- profiles
--     |
--     +---- posts
--     +---- comments
--     +---- post_likes
--
-- Initial university:
-- SVVV
--   └── SVIIT
-- ============================================================


-- ============================================================
-- PRIVATE SCHEMA
-- ============================================================

create schema if not exists private;


-- ============================================================
-- UNIVERSITIES
-- ============================================================

create table public.universities (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  short_name text not null,
  slug text not null unique,

  email_domain text,

  created_at timestamptz not null default now(),

  constraint university_name_length
    check (char_length(name) between 2 and 150),

  constraint university_short_name_length
    check (char_length(short_name) between 2 and 30),

  constraint university_slug_format
    check (slug ~ '^[a-z0-9-]+$')
);


-- Add SVVV

insert into public.universities (
  name,
  short_name,
  slug,
  email_domain
)
values (
  'Shri Vaishnav Vidyapeeth Vishwavidyalaya',
  'SVVV',
  'svvv',
  'svvv.edu.in'
);


-- ============================================================
-- INSTITUTES
-- ============================================================

create table public.institutes (
  id uuid primary key default gen_random_uuid(),

  university_id uuid not null
    references public.universities(id)
    on delete cascade,

  name text not null,
  short_name text not null,
  slug text not null,

  created_at timestamptz not null default now(),

  constraint institute_name_length
    check (char_length(name) between 2 and 150),

  constraint institute_short_name_length
    check (char_length(short_name) between 2 and 30),

  constraint institute_slug_format
    check (slug ~ '^[a-z0-9-]+$'),

  unique (
    university_id,
    short_name
  ),

  unique (
    university_id,
    slug
  )
);


-- Add SVIIT under SVVV

insert into public.institutes (
  university_id,
  name,
  short_name,
  slug
)
select
  id,
  'Shri Vaishnav Institute of Information Technology',
  'SVIIT',
  'sviit'
from public.universities
where slug = 'svvv';


-- ============================================================
-- PROFILES
-- ============================================================

create table public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  institute_id uuid not null
    references public.institutes(id)
    on delete restrict,

  username text not null unique,

  full_name text not null,

  branch text not null,

  year smallint not null,

  bio text not null default '',

  avatar_path text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint username_length
    check (
      char_length(username) between 3 and 30
    ),

  constraint username_format
    check (
      username ~ '^[a-z0-9._]+$'
    ),

  constraint full_name_length
    check (
      char_length(full_name) between 2 and 80
    ),

  constraint branch_length
    check (
      char_length(branch) between 2 and 80
    ),

  constraint valid_year
    check (
      year between 1 and 6
    ),

  constraint bio_length
    check (
      char_length(bio) <= 160
    )
);


-- ============================================================
-- STUDENT VERIFICATION
--
-- This is intentionally separate from profiles because
-- enrollment numbers and ID documents are private information.
-- ============================================================

create table public.student_verifications (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  university_id uuid not null
    references public.universities(id)
    on delete restrict,

  enrollment_number text not null,

  id_document_path text,

  method text not null default 'student_id',

  status text not null default 'pending',

  rejection_reason text,

  submitted_at timestamptz not null default now(),

  reviewed_at timestamptz,

  reviewer_id uuid
    references auth.users(id)
    on delete set null,

  constraint enrollment_number_length
    check (
      char_length(enrollment_number) between 3 and 50
    ),

  constraint valid_verification_status
    check (
      status in (
        'pending',
        'verified',
        'rejected'
      )
    ),

  constraint valid_verification_method
    check (
      method in (
        'student_id',
        'admin',
        'ambassador',
        'college_email'
      )
    ),

  unique (
    university_id,
    enrollment_number
  )
);


-- ============================================================
-- POSTS
-- ============================================================

create table public.posts (
  id uuid primary key default gen_random_uuid(),

  author_id uuid not null
    references public.profiles(id)
    on delete cascade,

  content text not null default '',

  image_path text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint post_content_length
    check (
      char_length(content) <= 500
    ),

  constraint post_not_empty
    check (
      char_length(trim(content)) > 0
      or image_path is not null
    )
);


-- ============================================================
-- POST LIKES
-- ============================================================

create table public.post_likes (
  post_id uuid not null
    references public.posts(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  primary key (
    post_id,
    user_id
  )
);


-- ============================================================
-- COMMENTS
-- ============================================================

create table public.comments (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null
    references public.posts(id)
    on delete cascade,

  author_id uuid not null
    references public.profiles(id)
    on delete cascade,

  content text not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint comment_not_empty
    check (
      char_length(trim(content)) > 0
    ),

  constraint comment_length
    check (
      char_length(content) <= 500
    )
);


-- ============================================================
-- INDEXES
-- ============================================================

create index institutes_university_id_idx
on public.institutes(university_id);


create index profiles_institute_id_idx
on public.profiles(institute_id);


create index profiles_institute_branch_idx
on public.profiles(institute_id, branch);


create index verification_status_idx
on public.student_verifications(status);


create index verification_university_idx
on public.student_verifications(university_id);


create index posts_created_at_idx
on public.posts(created_at desc);


create index posts_author_created_at_idx
on public.posts(author_id, created_at desc);


create index post_likes_user_id_idx
on public.post_likes(user_id);


create index comments_post_created_at_idx
on public.comments(post_id, created_at);


create index comments_author_id_idx
on public.comments(author_id);


-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin

  new.updated_at = now();

  return new;

end;
$$;


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();


create trigger posts_set_updated_at
before update on public.posts
for each row
execute function private.set_updated_at();


create trigger comments_set_updated_at
before update on public.comments
for each row
execute function private.set_updated_at();


-- ============================================================
-- SECURITY HELPER FUNCTIONS
-- ============================================================


-- ------------------------------------------------------------
-- Get the logged-in user's institute
-- ------------------------------------------------------------

create or replace function private.current_institute_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$

  select p.institute_id

  from public.profiles as p

  where p.id = (select auth.uid())

  limit 1;

$$;


-- ------------------------------------------------------------
-- Get the logged-in user's university
-- ------------------------------------------------------------

create or replace function private.current_university_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$

  select i.university_id

  from public.profiles as p

  join public.institutes as i
    on i.id = p.institute_id

  where p.id = (select auth.uid())

  limit 1;

$$;


-- ------------------------------------------------------------
-- Is the logged-in student verified?
-- ------------------------------------------------------------

create or replace function private.is_verified_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$

  select exists (

    select 1

    from public.student_verifications as verification

    where verification.user_id =
      (select auth.uid())

    and verification.status = 'verified'

  );

$$;


-- ------------------------------------------------------------
-- Check whether a post belongs to the logged-in user's
-- university.
--
-- This is useful for likes/comments RLS.
-- ------------------------------------------------------------

create or replace function private.post_is_in_current_university(
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

    join public.profiles as profile
      on profile.id = post.author_id

    join public.institutes as institute
      on institute.id = profile.institute_id

    where post.id = target_post_id

    and institute.university_id =
      (select private.current_university_id())

  );

$$;


-- ------------------------------------------------------------
-- Check whether a profile belongs to the logged-in user's
-- university.
-- ------------------------------------------------------------

create or replace function private.profile_is_in_current_university(
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

    from public.profiles as profile

    join public.institutes as institute
      on institute.id = profile.institute_id

    where profile.id = target_profile_id

    and institute.university_id =
      (select private.current_university_id())

  );

$$;


-- ============================================================
-- PRIVATE SCHEMA PERMISSIONS
-- ============================================================

revoke all on schema private
from public;

grant usage on schema private
to authenticated;


revoke all
on function private.set_updated_at()
from public;


revoke all
on function private.current_institute_id()
from public;


revoke all
on function private.current_university_id()
from public;


revoke all
on function private.is_verified_user()
from public;


revoke all
on function private.post_is_in_current_university(uuid)
from public;


revoke all
on function private.profile_is_in_current_university(uuid)
from public;


grant execute
on function private.current_institute_id()
to authenticated;


grant execute
on function private.current_university_id()
to authenticated;


grant execute
on function private.is_verified_user()
to authenticated;


grant execute
on function private.post_is_in_current_university(uuid)
to authenticated;


grant execute
on function private.profile_is_in_current_university(uuid)
to authenticated;


-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.universities
enable row level security;


alter table public.institutes
enable row level security;


alter table public.profiles
enable row level security;


alter table public.student_verifications
enable row level security;


alter table public.posts
enable row level security;


alter table public.post_likes
enable row level security;


alter table public.comments
enable row level security;


-- ============================================================
-- TABLE PERMISSIONS
-- ============================================================


-- ------------------------------------------------------------
-- UNIVERSITIES
-- ------------------------------------------------------------

revoke all on table public.universities
from anon, authenticated;

grant select
on table public.universities
to authenticated;


-- ------------------------------------------------------------
-- INSTITUTES
-- ------------------------------------------------------------

revoke all on table public.institutes
from anon, authenticated;

grant select
on table public.institutes
to authenticated;


-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------

revoke all on table public.profiles
from anon, authenticated;


grant select
on table public.profiles
to authenticated;


grant insert (
  id,
  institute_id,
  username,
  full_name,
  branch,
  year,
  bio,
  avatar_path
)
on public.profiles
to authenticated;


grant update (
  username,
  full_name,
  branch,
  year,
  bio,
  avatar_path
)
on public.profiles
to authenticated;


-- ------------------------------------------------------------
-- STUDENT VERIFICATIONS
-- ------------------------------------------------------------

revoke all on table public.student_verifications
from anon, authenticated;


grant select
on table public.student_verifications
to authenticated;


grant insert (
  user_id,
  university_id,
  enrollment_number,
  id_document_path
)
on public.student_verifications
to authenticated;


grant delete
on table public.student_verifications
to authenticated;


-- ------------------------------------------------------------
-- POSTS
-- ------------------------------------------------------------

revoke all on table public.posts
from anon, authenticated;


grant select
on table public.posts
to authenticated;


grant insert (
  author_id,
  content,
  image_path
)
on public.posts
to authenticated;


grant update (
  content,
  image_path
)
on public.posts
to authenticated;


grant delete
on table public.posts
to authenticated;


-- ------------------------------------------------------------
-- POST LIKES
-- ------------------------------------------------------------

revoke all on table public.post_likes
from anon, authenticated;


grant select
on table public.post_likes
to authenticated;


grant insert (
  post_id,
  user_id
)
on public.post_likes
to authenticated;


grant delete
on table public.post_likes
to authenticated;


-- ------------------------------------------------------------
-- COMMENTS
-- ------------------------------------------------------------

revoke all on table public.comments
from anon, authenticated;


grant select
on table public.comments
to authenticated;


grant insert (
  post_id,
  author_id,
  content
)
on public.comments
to authenticated;


grant update (
  content
)
on public.comments
to authenticated;


grant delete
on table public.comments
to authenticated;


-- ============================================================
-- RLS: UNIVERSITIES
-- ============================================================

create policy "Authenticated users can view universities"
on public.universities
for select
to authenticated
using (
  true
);


-- ============================================================
-- RLS: INSTITUTES
-- ============================================================

create policy "Authenticated users can view institutes"
on public.institutes
for select
to authenticated
using (
  true
);


-- ============================================================
-- RLS: PROFILES
-- ============================================================


-- A student must always be able to view their own profile,
-- including while waiting for verification.

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
);


-- Verified students can see other profiles from the same
-- university.

create policy "Verified users can view university profiles"
on public.profiles
for select
to authenticated
using (

  (select private.is_verified_user())

  and

  (select private.profile_is_in_current_university(id))

);


-- A student can only create a profile belonging to their
-- authentication account.

create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
);


-- A student can only update their own profile.

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);


-- ============================================================
-- RLS: STUDENT VERIFICATIONS
-- ============================================================


-- Students can only see their own private verification data.

create policy "Users can view own verification"
on public.student_verifications
for select
to authenticated
using (
  user_id = (select auth.uid())
);


-- Students can submit their own verification.
--
-- university_id must match the university determined through:
--
-- profile -> institute -> university

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

);


-- If rejected, users may remove their submission and submit
-- again.

create policy "Users can delete rejected verification"
on public.student_verifications
for delete
to authenticated
using (

  user_id = (select auth.uid())

  and

  status = 'rejected'

);


-- ============================================================
-- RLS: POSTS
-- ============================================================


-- Verified students can see posts created by students within
-- their university.
--
-- Example:
--
-- SVIIT student -> SVVV
-- SVITS student -> SVVV
--
-- Both can participate in the SVVV campus feed.

create policy "Verified students can view university posts"
on public.posts
for select
to authenticated
using (

  (select private.is_verified_user())

  and

  (select private.profile_is_in_current_university(author_id))

);


-- Verified users may only create posts as themselves.

create policy "Verified students can create posts"
on public.posts
for insert
to authenticated
with check (

  author_id = (select auth.uid())

  and

  (select private.is_verified_user())

);


-- Users may only update their own posts.

create policy "Verified students can update own posts"
on public.posts
for update
to authenticated
using (

  author_id = (select auth.uid())

  and

  (select private.is_verified_user())

)
with check (

  author_id = (select auth.uid())

  and

  (select private.is_verified_user())

);


-- Users are allowed to delete their own posts even if their
-- verification is later revoked.

create policy "Users can delete own posts"
on public.posts
for delete
to authenticated
using (
  author_id = (select auth.uid())
);


-- ============================================================
-- RLS: POST LIKES
-- ============================================================


create policy "Verified students can view university likes"
on public.post_likes
for select
to authenticated
using (

  (select private.is_verified_user())

  and

  (
    select private.post_is_in_current_university(post_id)
  )

);


create policy "Verified students can like university posts"
on public.post_likes
for insert
to authenticated
with check (

  user_id = (select auth.uid())

  and

  (select private.is_verified_user())

  and

  (
    select private.post_is_in_current_university(post_id)
  )

);


-- Users can always remove their own like.

create policy "Users can remove own likes"
on public.post_likes
for delete
to authenticated
using (
  user_id = (select auth.uid())
);


-- ============================================================
-- RLS: COMMENTS
-- ============================================================


create policy "Verified students can view university comments"
on public.comments
for select
to authenticated
using (

  (select private.is_verified_user())

  and

  (
    select private.post_is_in_current_university(post_id)
  )

);


create policy "Verified students can comment on university posts"
on public.comments
for insert
to authenticated
with check (

  author_id = (select auth.uid())

  and

  (select private.is_verified_user())

  and

  (
    select private.post_is_in_current_university(post_id)
  )

);


create policy "Verified students can update own comments"
on public.comments
for update
to authenticated
using (

  author_id = (select auth.uid())

  and

  (select private.is_verified_user())

)
with check (

  author_id = (select auth.uid())

  and

  (select private.is_verified_user())

);


-- Users can delete their own comments even if verification
-- is later revoked.

create policy "Users can delete own comments"
on public.comments
for delete
to authenticated
using (
  author_id = (select auth.uid())
);