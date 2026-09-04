-- ============================================================
-- COMMENT REPLIES
--
-- Adds one-level replies to post comments. Replies remain rows in
-- public.comments, so existing block/privacy/RLS behavior continues
-- to govern visibility and deletion.
-- ============================================================

alter table public.comments
add column if not exists parent_comment_id uuid
  references public.comments(id)
  on delete cascade;

alter table public.comments
drop constraint if exists comments_parent_not_self;

alter table public.comments
add constraint comments_parent_not_self
check (
  parent_comment_id is null
  or parent_comment_id <> id
);

create index if not exists comments_post_parent_created_at_idx
on public.comments(post_id, parent_comment_id, created_at, id);

create or replace function private.ensure_comment_parent_is_valid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_post_id uuid;
  parent_parent_comment_id uuid;
  parent_author_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select
    parent.post_id,
    parent.parent_comment_id,
    parent.author_id
  into
    parent_post_id,
    parent_parent_comment_id,
    parent_author_id
  from public.comments as parent
  where parent.id = new.parent_comment_id;

  if parent_post_id is null then
    raise exception 'Parent comment could not be found.'
      using errcode = '23503';
  end if;

  if parent_post_id <> new.post_id then
    raise exception 'Replies must belong to the same post.'
      using errcode = '23514';
  end if;

  if parent_parent_comment_id is not null then
    raise exception 'Replies can only be added to top-level comments.'
      using errcode = '23514';
  end if;

  if (
    select private.users_have_block_relation(parent_author_id)
  ) then
    raise exception 'You cannot reply to this comment.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all
on function private.ensure_comment_parent_is_valid()
from public, anon, authenticated;

drop trigger if exists comments_validate_parent
on public.comments;

create trigger comments_validate_parent
before insert or update of parent_comment_id, post_id
on public.comments
for each row
execute function private.ensure_comment_parent_is_valid();

-- Read the parent outside comments RLS to avoid a recursive SELECT policy.
-- Only return visibility to the authenticated viewer, never parent data.
create or replace function private.comment_parent_is_visible(
  target_parent_id uuid,
  target_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select private.is_verified_user())
    and exists (
      select 1
      from public.comments as parent
      where parent.id = target_parent_id
        and parent.post_id = target_post_id
        and parent.parent_comment_id is null
        and private.post_is_in_current_university(parent.post_id)
        and not private.users_have_block_relation(parent.author_id)
        and not private.current_user_has_block_relation_with_post_author(parent.post_id)
    );
$$;

revoke all
on function private.comment_parent_is_visible(uuid, uuid)
from public, anon, authenticated;

grant execute
on function private.comment_parent_is_visible(uuid, uuid)
to authenticated;

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

  and (
    comments.parent_comment_id is null
    or (
      select private.comment_parent_is_visible(
        comments.parent_comment_id,
        comments.post_id
      )
    )
  )
);

grant insert (
  post_id,
  author_id,
  content,
  parent_comment_id
)
on public.comments
to authenticated;

comment on column public.comments.parent_comment_id is
  'Optional parent comment for one-level threaded replies on post comments.';
