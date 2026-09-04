alter table public.notification_preferences
add column mentions_enabled boolean not null default true;

grant insert (mentions_enabled), update (mentions_enabled)
on public.notification_preferences to authenticated;

create or replace function private.mentioned_usernames(content text)
returns text[]
language sql immutable set search_path = ''
as $$
  -- Match the renderer: whitespace-separated tokens, surrounding punctuation,
  -- no email/URL fragments or Markdown links. Duplicate usernames collapse.
  select coalesce(array_agg(distinct lower(substring(candidate from 2))), array[]::text[])
  from (
    select regexp_replace(
      regexp_replace(token, '^[([{<"''“‘]+', ''),
      '[\])}>"''”’.,!?;:]+$', ''
    ) as candidate
    from regexp_split_to_table(
      regexp_replace(coalesce(content, ''), '\[[^\]]+\]\([^)\s]+\)', ' ', 'g'),
      '\s+'
    ) as token
  ) as tokens
  where candidate ~* '^@[a-z0-9._]{3,30}$';
$$;
revoke all on function private.mentioned_usernames(text) from public, anon, authenticated;

-- Only trusted triggers and the own-recipient wrappers below may call this.
-- Re-check the actual source on read/dispatch as blocks and scopes can change.
create or replace function private.mention_recipient_can_access(
  recipient uuid, target_post uuid, target_comment uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as viewer
    join public.institutes as viewer_institute on viewer_institute.id = viewer.institute_id
    join public.posts as post on post.id = target_post
    left join public.profiles as author on author.id = post.author_id
    left join public.institutes as author_institute on author_institute.id = author.institute_id
    left join public.organizations as organization on organization.id = post.organization_author_id
    left join public.comments as comment on comment.id = target_comment and comment.post_id = post.id
    left join public.comments as parent on parent.id = comment.parent_comment_id and parent.post_id = post.id
    where viewer.id = recipient and viewer.is_verified
      and post.post_kind = 'general'
      and (
        (post.author_id is not null and author_institute.university_id = viewer_institute.university_id)
        or (post.organization_author_id is not null and organization.is_active
          and organization.university_id = viewer_institute.university_id)
      )
      and not private.profiles_have_block_relation(recipient, post.author_id)
      and (
        target_comment is null
        or (comment.id is not null
          and not private.profiles_have_block_relation(recipient, comment.author_id)
          and (comment.parent_comment_id is null or (
            parent.id is not null and parent.parent_comment_id is null
            and not private.profiles_have_block_relation(recipient, parent.author_id)
          )))
      )
      and lower(viewer.username) = any(private.mentioned_usernames(
        case when target_comment is null then post.content else comment.content end
      ))
  );
$$;
revoke all on function private.mention_recipient_can_access(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function private.can_read_mention(target_post uuid, target_comment uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and private.mention_recipient_can_access((select auth.uid()), target_post, target_comment);
$$;
revoke all on function private.can_read_mention(uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_read_mention(uuid, uuid) to authenticated;

create policy "Mention notifications require visible source"
on public.notifications as restrictive for select to authenticated
using (
  case when type = 'mention' then
    (select private.can_read_mention(post_id, comment_id))
    and (actor_id is null or not (select private.users_have_block_relation(actor_id)))
  else true end
);

create unique index notifications_unique_post_mention_idx
on public.notifications(recipient_id, post_id)
where type = 'mention' and comment_id is null;

create unique index notifications_unique_comment_mention_idx
on public.notifications(recipient_id, comment_id)
where type = 'mention' and comment_id is not null;

create or replace function private.create_mention_notifications()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  source_post uuid;
  source_comment uuid;
  actor uuid;
  organization_actor uuid;
  actor_name text;
  old_names text[] := array[]::text[];
begin
  -- Service edits/imports do not impersonate students or generate alerts.
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'UPDATE' then
    if new.content is not distinct from old.content then return new; end if;
    old_names := private.mentioned_usernames(old.content);
  end if;

  if tg_table_name = 'posts' then
    source_post := new.id;
    actor := new.author_id;
    organization_actor := new.organization_author_id;
    if new.post_kind <> 'general' then return new; end if;
  else
    source_post := new.post_id;
    source_comment := new.id;
    actor := new.author_id;
  end if;

  if actor is not null then
    select full_name into actor_name from public.profiles where id = actor;
  else
    select name into actor_name from public.organizations where id = organization_actor;
  end if;

  insert into public.notifications(recipient_id, actor_id, type, post_id, comment_id, organization_id, title, body)
  select recipient.id, actor, 'mention', source_post, source_comment, organization_actor,
    left(coalesce(actor_name, 'Someone'), 70) || case when source_comment is null
      then ' mentioned you in a post' else ' mentioned you in a comment' end,
    'Open the post to see the mention.'
  from public.profiles as recipient
  left join public.notification_preferences as preference on preference.user_id = recipient.id
  where lower(recipient.username) = any(private.mentioned_usernames(new.content))
    and not (lower(recipient.username) = any(old_names))
    and recipient.id <> (select auth.uid())
    and recipient.id is distinct from actor
    and coalesce(preference.mentions_enabled, true)
    and not private.profiles_have_block_relation(recipient.id, (select auth.uid()))
    and private.mention_recipient_can_access(recipient.id, source_post, source_comment)
    -- The post owner may already have received the normal comment alert.
    and not exists (
      select 1 from public.notifications as existing
      where existing.recipient_id = recipient.id
        and existing.comment_id = source_comment and existing.type = 'post_comment'
    )
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.create_mention_notifications() from public, anon, authenticated;

create trigger posts_zz_create_mentions after insert or update of content on public.posts
for each row execute function private.create_mention_notifications();
create trigger comments_zz_create_mentions after insert or update of content on public.comments
for each row execute function private.create_mention_notifications();

-- The existing comment FK uses SET NULL; remove mention alerts before that can
-- turn a comment mention into a post mention or conflict with the post index.
create or replace function private.delete_comment_mention_notifications()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.notifications where comment_id = old.id and type = 'mention';
  return old;
end;
$$;
revoke all on function private.delete_comment_mention_notifications() from public, anon, authenticated;
create trigger comments_delete_mentions before delete on public.comments
for each row execute function private.delete_comment_mention_notifications();

-- Push dispatch uses a service-only RPC to check current access/preferences.
create or replace function public.can_deliver_mention_notification(target_notification_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.notifications as notification
    left join public.notification_preferences as preference on preference.user_id = notification.recipient_id
    where notification.id = target_notification_id and notification.type = 'mention'
      and coalesce(preference.mentions_enabled, true)
      and not private.profiles_have_block_relation(notification.recipient_id, notification.actor_id)
      and private.mention_recipient_can_access(notification.recipient_id, notification.post_id, notification.comment_id)
  );
$$;
revoke all on function public.can_deliver_mention_notification(uuid) from public, anon, authenticated;
grant execute on function public.can_deliver_mention_notification(uuid) to service_role;
