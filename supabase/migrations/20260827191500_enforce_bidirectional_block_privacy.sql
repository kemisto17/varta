-- ============================================================
-- ENFORCE BIDIRECTIONAL BLOCK PRIVACY
--
-- If either student blocks the other:
--
--   - profiles are not mutually visible
--   - profile links/badges are hidden
--   - student posts are hidden
--   - comments from blocked users are hidden
--   - likes/comments cannot be added to blocked student posts
--   - people search excludes the relationship
--
-- Self access remains unaffected.
-- Organization-authored posts are unaffected because they do
-- not have a student author_id.
-- ============================================================


-- ============================================================
-- BLOCK RELATION HELPER
-- ============================================================

create or replace function
private.users_have_block_relation(
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null

    and target_profile_id is not null

    and exists (
      select 1

      from public.user_blocks as user_block

      where
        (
          user_block.blocker_id =
            (select auth.uid())

          and user_block.blocked_id =
            target_profile_id
        )

        or

        (
          user_block.blocker_id =
            target_profile_id

          and user_block.blocked_id =
            (select auth.uid())
        )
    );
$$;
revoke all
on function private.users_have_block_relation(uuid)
from public, anon, authenticated;
grant execute
on function private.users_have_block_relation(uuid)
to authenticated;
comment on function
private.users_have_block_relation(uuid)
is
  'Returns true when either the authenticated user or the target profile has blocked the other.';
-- ============================================================
-- POST AUTHOR BLOCK RELATION
-- ============================================================

create or replace function
private.current_user_has_block_relation_with_post_author(
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

    where post.id =
      target_post_id

      and post.author_id is not null

      and (
        select private.users_have_block_relation(
          post.author_id
        )
      )
  );
$$;
revoke all
on function
private.current_user_has_block_relation_with_post_author(uuid)
from public, anon, authenticated;
grant execute
on function
private.current_user_has_block_relation_with_post_author(uuid)
to authenticated;
-- ============================================================
-- PROFILES
-- ============================================================

drop policy if exists
  "Users can view own or verified university profiles"
on public.profiles;
create policy
  "Users can view own or verified university profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())

  or

  (
    (select private.is_verified_user())

    and profiles.is_verified = true

    and (
      select private.profile_is_in_current_university(
        profiles.id
      )
    )

    and not (
      select private.users_have_block_relation(
        profiles.id
      )
    )
  )
);
-- ============================================================
-- PROFILE LINKS
-- ============================================================

drop policy if exists
  "Users can view visible profile links"
on public.profile_links;
create policy
  "Users can view visible profile links"
on public.profile_links
for select
to authenticated
using (
  profile_id = (select auth.uid())

  or

  (
    (select private.is_verified_user())

    and exists (
      select 1

      from public.profiles as target_profile

      where target_profile.id =
        profile_links.profile_id

        and target_profile.is_verified = true
    )

    and (
      select private.profile_is_in_current_university(
        profile_links.profile_id
      )
    )

    and not (
      select private.users_have_block_relation(
        profile_links.profile_id
      )
    )
  )
);
-- ============================================================
-- PROFILE BADGES
-- ============================================================

drop policy if exists
  "Users can view visible profile badge assignments"
on public.profile_badges;
create policy
  "Users can view visible profile badge assignments"
on public.profile_badges
for select
to authenticated
using (
  profile_id = (select auth.uid())

  or

  (
    (
      select private.badge_is_public(
        profile_badges.badge_id
      )
    )

    and

    (select private.is_verified_user())

    and

    exists (
      select 1

      from public.profiles as target_profile

      where target_profile.id =
        profile_badges.profile_id

        and target_profile.is_verified = true
    )

    and

    (
      select private.profile_is_in_current_university(
        profile_badges.profile_id
      )
    )

    and

    not (
      select private.users_have_block_relation(
        profile_badges.profile_id
      )
    )
  )
);
-- ============================================================
-- POSTS
-- ============================================================

drop policy if exists
  "Verified users can view university posts"
on public.posts;
create policy
  "Verified users can view university posts"
on public.posts
for select
to authenticated
using (
  (select private.is_verified_user())

  and (
    select private.post_author_is_in_current_university(
      posts.author_id,
      posts.organization_author_id
    )
  )

  and (
    posts.author_id is null

    or

    not (
      select private.users_have_block_relation(
        posts.author_id
      )
    )
  )
);
-- ============================================================
-- COMMENTS
-- ============================================================

drop policy if exists
  "Verified students can view university comments"
on public.comments;
create policy
  "Verified students can view university comments"
on public.comments
for select
to authenticated
using (
  (select private.is_verified_user())

  and (
    select private.post_is_in_current_university(
      comments.post_id
    )
  )

  and not (
    select private.users_have_block_relation(
      comments.author_id
    )
  )

  and not (
    select
      private.current_user_has_block_relation_with_post_author(
        comments.post_id
      )
  )
);
drop policy if exists
  "Verified students can comment on university posts"
on public.comments;
create policy
  "Verified students can comment on university posts"
on public.comments
for insert
to authenticated
with check (
  comments.author_id =
    (select auth.uid())

  and

  (select private.is_verified_user())

  and

  (
    select private.post_is_in_current_university(
      comments.post_id
    )
  )

  and

  not (
    select
      private.current_user_has_block_relation_with_post_author(
        comments.post_id
      )
  )
);
-- ============================================================
-- POST LIKES
-- ============================================================

drop policy if exists
  "Verified students can view university likes"
on public.post_likes;
create policy
  "Verified students can view university likes"
on public.post_likes
for select
to authenticated
using (
  (select private.is_verified_user())

  and (
    select private.post_is_in_current_university(
      post_likes.post_id
    )
  )

  and not (
    select
      private.current_user_has_block_relation_with_post_author(
        post_likes.post_id
      )
  )
);
drop policy if exists
  "Verified students can like university posts"
on public.post_likes;
create policy
  "Verified students can like university posts"
on public.post_likes
for insert
to authenticated
with check (
  post_likes.user_id =
    (select auth.uid())

  and

  (select private.is_verified_user())

  and

  (
    select private.post_is_in_current_university(
      post_likes.post_id
    )
  )

  and

  not (
    select
      private.current_user_has_block_relation_with_post_author(
        post_likes.post_id
      )
  )
);
-- ============================================================
-- PEOPLE SEARCH
--
-- Directly reading reverse block rows cannot work through
-- user_blocks RLS, so use the trusted helper instead.
-- ============================================================

create or replace function
public.search_people(
  search_query text,
  result_limit integer default 8
)
returns table (
  id uuid,
  full_name text,
  username text,
  branch text,
  year smallint,
  avatar_path text,
  is_verified boolean,
  institute_id uuid,
  institute_name text,
  institute_short_name text
)
language sql
stable
set search_path = ''
as $$
  with input as (
    select
      trim(search_query) as term,

      least(
        greatest(
          coalesce(result_limit, 8),
          1
        ),
        12
      ) as row_limit
  )

  select
    profile.id,
    profile.full_name,
    profile.username,
    profile.branch,
    profile.year,
    profile.avatar_path,
    profile.is_verified,
    institute.id,
    institute.name,
    institute.short_name

  from public.profiles as profile

  join public.institutes as institute
    on institute.id =
      profile.institute_id

  cross join input

  where char_length(
    input.term
  ) >= 2

    and profile.is_verified = true

    and institute.university_id =
      (
        select private.current_university_id()
      )

    and not (
      select private.users_have_block_relation(
        profile.id
      )
    )

    and (
      profile.full_name ilike
        '%' || input.term || '%'

      or profile.username ilike
        '%' || input.term || '%'

      or profile.branch ilike
        '%' || input.term || '%'
    )

  order by
    case
      when lower(profile.username) =
        lower(input.term)
        then 0

      when profile.username ilike
        input.term || '%'
        then 1

      when profile.full_name ilike
        input.term || '%'
        then 2

      else 3
    end,

    greatest(
      extensions.similarity(
        profile.full_name,
        input.term
      ),

      extensions.similarity(
        profile.username,
        input.term
      ),

      extensions.similarity(
        profile.branch,
        input.term
      )
    ) desc,

    profile.full_name,
    profile.id

  limit (
    select row_limit
    from input
  );
$$;
revoke all
on function
public.search_people(text, integer)
from public, anon;
grant execute
on function
public.search_people(text, integer)
to authenticated;
