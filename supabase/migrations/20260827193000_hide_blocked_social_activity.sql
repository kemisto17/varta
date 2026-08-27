-- ============================================================
-- HIDE BLOCKED SOCIAL ACTIVITY
--
-- Bidirectional blocking must also hide social activity that
-- happens on third-party or organization-authored posts.
--
-- This closes two remaining leaks:
--
--   1. Likes made by a blocked user on another post.
--   2. Organization-post notifications revealing a blocked
--      user's like/comment activity.
-- ============================================================


-- ============================================================
-- GENERIC BLOCK RELATION
--
-- Unlike users_have_block_relation(), this helper compares any
-- two explicit profile IDs and is intended only for trusted
-- server-side database functions.
-- ============================================================

create or replace function
private.profiles_have_block_relation(
  profile_a_id uuid,
  profile_b_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile_a_id is not null

    and profile_b_id is not null

    and profile_a_id <> profile_b_id

    and exists (
      select 1

      from public.user_blocks as user_block

      where
        (
          user_block.blocker_id =
            profile_a_id

          and user_block.blocked_id =
            profile_b_id
        )

        or

        (
          user_block.blocker_id =
            profile_b_id

          and user_block.blocked_id =
            profile_a_id
        )
    );
$$;


revoke all
on function
private.profiles_have_block_relation(uuid, uuid)
from public, anon, authenticated;


comment on function
private.profiles_have_block_relation(uuid, uuid)
is
  'Trusted server-side helper returning true when either of two profiles has blocked the other.';


-- ============================================================
-- LIKE VISIBILITY
--
-- Existing policy already hides likes when the viewer has a
-- block relationship with the post author.
--
-- Also hide the individual like when the viewer and liker have
-- blocked one another.
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

  and not (
    select private.users_have_block_relation(
      post_likes.user_id
    )
  )
);


-- ============================================================
-- COMMENT NOTIFICATIONS
--
-- Student-post interactions are already blocked at INSERT when
-- the actor and post author have a block relationship.
--
-- Organization posts notify multiple organization members, so
-- exclude members who have a block relationship with the
-- commenting student.
-- ============================================================

create or replace function
private.create_post_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_owner_id uuid;
  organization_owner_id uuid;
  organization_name text;
  actor_name text;
  comment_preview text;
begin
  select
    post.author_id,
    post.organization_author_id,
    organization.name

  into
    student_owner_id,
    organization_owner_id,
    organization_name

  from public.posts as post

  left join public.organizations as organization
    on organization.id =
      post.organization_author_id

  where post.id =
    new.post_id;


  select
    coalesce(
      nullif(
        trim(profile.full_name),
        ''
      ),
      'A student'
    )

  into actor_name

  from public.profiles as profile

  where profile.id =
    new.author_id;


  comment_preview :=
    left(
      regexp_replace(
        trim(new.content),
        '[\n\r\t]+',
        ' ',
        'g'
      ),
      160
    );


  -- ----------------------------------------------------------
  -- STUDENT POST
  -- ----------------------------------------------------------

  if student_owner_id is not null then

    if
      student_owner_id <>
        new.author_id

      and (
        select
          private.notification_preference_enabled(
            student_owner_id,
            'post_comment'
          )
      )

    then

      insert into public.notifications (
        recipient_id,
        actor_id,
        type,
        post_id,
        comment_id,
        title,
        body
      )
      values (
        student_owner_id,
        new.author_id,
        'post_comment',
        new.post_id,
        new.id,
        actor_name ||
          ' commented on your post',
        comment_preview
      )

      on conflict do nothing;

    end if;

    return new;

  end if;


  -- ----------------------------------------------------------
  -- ORGANIZATION POST
  -- ----------------------------------------------------------

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    post_id,
    comment_id,
    organization_id,
    title,
    body
  )

  select
    membership.user_id,
    new.author_id,
    'post_comment',
    new.post_id,
    new.id,
    organization_owner_id,
    actor_name ||
      ' commented on ' ||
      organization_name ||
      '''s post',
    comment_preview

  from public.organization_members
    as membership

  where membership.organization_id =
    organization_owner_id

    and membership.user_id <>
      new.author_id

    and not (
      select
        private.profiles_have_block_relation(
          membership.user_id,
          new.author_id
        )
    )

    and (
      select
        private.notification_preference_enabled(
          membership.user_id,
          'post_comment'
        )
    )

  on conflict do nothing;


  return new;
end;
$$;


revoke all
on function
private.create_post_comment_notification()
from public, anon, authenticated;


-- ============================================================
-- LIKE NOTIFICATIONS
--
-- Apply the same blocked-recipient filtering to organization
-- post likes.
-- ============================================================

create or replace function
private.create_post_like_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_owner_id uuid;
  organization_owner_id uuid;
  organization_name text;
  actor_name text;
begin
  select
    post.author_id,
    post.organization_author_id,
    organization.name

  into
    student_owner_id,
    organization_owner_id,
    organization_name

  from public.posts as post

  left join public.organizations as organization
    on organization.id =
      post.organization_author_id

  where post.id =
    new.post_id;


  select
    coalesce(
      nullif(
        trim(profile.full_name),
        ''
      ),
      'A student'
    )

  into actor_name

  from public.profiles as profile

  where profile.id =
    new.user_id;


  -- ----------------------------------------------------------
  -- STUDENT POST
  -- ----------------------------------------------------------

  if student_owner_id is not null then

    if
      student_owner_id <>
        new.user_id

      and (
        select
          private.notification_preference_enabled(
            student_owner_id,
            'post_like'
          )
      )

    then

      insert into public.notifications (
        recipient_id,
        actor_id,
        type,
        post_id,
        title,
        body
      )
      values (
        student_owner_id,
        new.user_id,
        'post_like',
        new.post_id,
        actor_name ||
          ' liked your post',
        'Open the post to see the activity.'
      )

      on conflict do nothing;

    end if;

    return new;

  end if;


  -- ----------------------------------------------------------
  -- ORGANIZATION POST
  -- ----------------------------------------------------------

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    post_id,
    organization_id,
    title,
    body
  )

  select
    membership.user_id,
    new.user_id,
    'post_like',
    new.post_id,
    organization_owner_id,
    actor_name ||
      ' liked ' ||
      organization_name ||
      '''s post',
    'Open the post to see the activity.'

  from public.organization_members
    as membership

  where membership.organization_id =
    organization_owner_id

    and membership.user_id <>
      new.user_id

    and not (
      select
        private.profiles_have_block_relation(
          membership.user_id,
          new.user_id
        )
    )

    and (
      select
        private.notification_preference_enabled(
          membership.user_id,
          'post_like'
        )
    )

  on conflict do nothing;


  return new;
end;
$$;


revoke all
on function
private.create_post_like_notification()
from public, anon, authenticated;