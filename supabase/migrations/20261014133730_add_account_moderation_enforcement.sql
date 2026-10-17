-- Account-level moderation is enforced at database and media boundaries.
-- Reports, blocks, and feedback are excluded from write triggers; their existing
-- RLS still applies. Suspended and banned users retain the external support path.

do $$
begin
  create type public.account_moderation_status as enum (
    'active',
    'warned',
    'restricted',
    'suspended',
    'banned'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.account_moderation (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  status public.account_moderation_status not null default 'active',
  user_message text,
  expires_at timestamptz,
  updated_by uuid not null
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_moderation_message_check check (
    (status = 'active' and user_message is null and expires_at is null)
    or (
      status <> 'active'
      and user_message is not null
      and char_length(btrim(user_message)) between 3 and 500
    )
  ),
  constraint account_moderation_ban_expiry_check check (
    status <> 'banned' or expires_at is null
  )
);

create index if not exists account_moderation_status_expiry_idx
  on public.account_moderation (status, expires_at, user_id)
  where status <> 'active';

alter table public.account_moderation enable row level security;

revoke all on table public.account_moderation
  from public, anon, authenticated;
grant select (
  user_id,
  status,
  user_message,
  expires_at,
  created_at,
  updated_at
) on table public.account_moderation to authenticated;
grant select, insert, update
  on table public.account_moderation to service_role;

drop policy if exists "Users can view own account moderation" on public.account_moderation;
create policy "Users can view own account moderation"
on public.account_moderation
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function private.effective_account_moderation_status(
  target_user_id uuid
)
returns public.account_moderation_status
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when moderation.expires_at is not null
          and moderation.expires_at <= now()
          then 'active'::public.account_moderation_status
        else moderation.status
      end
      from public.account_moderation as moderation
      where moderation.user_id = target_user_id
    ),
    'active'::public.account_moderation_status
  );
$$;

revoke all on function private.effective_account_moderation_status(uuid)
  from public, anon, authenticated;

create or replace function private.current_account_can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      select private.effective_account_moderation_status(
        (select auth.uid())
      ) not in ('restricted', 'suspended', 'banned')
    );
$$;

revoke all on function private.current_account_can_write()
  from public, anon, authenticated;
grant execute on function private.current_account_can_write()
  to authenticated;

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
    where verification.user_id = (select auth.uid())
      and verification.status = 'verified'
  )
  and (
    select private.effective_account_moderation_status(
      (select auth.uid())
    ) not in ('suspended', 'banned')
  );
$$;

revoke all on function private.is_verified_user()
  from public, anon, authenticated;
grant execute on function private.is_verified_user()
  to authenticated;

create or replace function private.enforce_current_account_write_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted server work has no end-user auth context and remains available.
  if (select auth.uid()) is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if not (select private.current_account_can_write()) then
    raise exception using
      errcode = '42501',
      message = 'account_write_restricted';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_current_account_write_access()
  from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'student_verifications',
    'posts',
    'comments',
    'post_likes',
    'post_saves',
    'lost_found_items',
    'organization_follows',
    'event_interests',
    'events',
    'organizations',
    'organization_members',
    'profile_links',
    'organization_links'
  ]
  loop
    execute format(
      'drop trigger if exists account_moderation_enforce_writes on public.%I',
      table_name
    );
    execute format(
      'create trigger account_moderation_enforce_writes before insert or update or delete on public.%I for each row execute function private.enforce_current_account_write_access()',
      table_name
    );
  end loop;
end
$$;

-- Legacy Supabase Storage paths remain read-compatible, but restricted users
-- cannot create, replace, or delete objects directly through the Data API.
drop policy if exists "Account moderation permits storage inserts" on storage.objects;
create policy "Account moderation permits storage inserts"
on storage.objects
as restrictive
for insert
to authenticated
with check ((select private.current_account_can_write()));

drop policy if exists "Account moderation permits storage updates" on storage.objects;
create policy "Account moderation permits storage updates"
on storage.objects
as restrictive
for update
to authenticated
using ((select private.current_account_can_write()))
with check ((select private.current_account_can_write()));

drop policy if exists "Account moderation permits storage deletes" on storage.objects;
create policy "Account moderation permits storage deletes"
on storage.objects
as restrictive
for delete
to authenticated
using ((select private.current_account_can_write()));

create table if not exists public.report_evidence (
  report_id uuid primary key
    references public.reports(id) on delete restrict,
  target_type public.report_target_type not null,
  target_id uuid not null,
  snapshot jsonb not null
    check (jsonb_typeof(snapshot) = 'object'),
  captured_at timestamptz not null default now()
);

create index if not exists report_evidence_target_idx
  on public.report_evidence (target_type, target_id, captured_at desc);

alter table public.report_evidence enable row level security;
revoke all on table public.report_evidence from public, anon, authenticated;
grant select on table public.report_evidence to service_role;

create or replace function private.capture_report_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_snapshot jsonb;
begin
  if new.target_type = 'post' then
    select jsonb_build_object(
      'id', post.id,
      'author_id', post.author_id,
      'organization_author_id', post.organization_author_id,
      'content', post.content,
      'image_path', post.image_path,
      'post_kind', post.post_kind,
      'created_at', post.created_at,
      'updated_at', post.updated_at
    )
    into target_snapshot
    from public.posts as post
    where post.id = new.target_id;
  elsif new.target_type = 'comment' then
    select jsonb_build_object(
      'id', comment.id,
      'author_id', comment.author_id,
      'post_id', comment.post_id,
      'parent_comment_id', comment.parent_comment_id,
      'content', comment.content,
      'created_at', comment.created_at,
      'updated_at', comment.updated_at
    )
    into target_snapshot
    from public.comments as comment
    where comment.id = new.target_id;
  elsif new.target_type = 'profile' then
    select jsonb_build_object(
      'id', profile.id,
      'username', profile.username,
      'full_name', profile.full_name,
      'bio', profile.bio,
      'avatar_path', profile.avatar_path,
      'institute_id', profile.institute_id,
      'created_at', profile.created_at,
      'updated_at', profile.updated_at
    )
    into target_snapshot
    from public.profiles as profile
    where profile.id = new.target_id;
  end if;

  insert into public.report_evidence (
    report_id,
    target_type,
    target_id,
    snapshot
  ) values (
    new.id,
    new.target_type,
    new.target_id,
    jsonb_build_object('capture_source', 'report_insert')
      || coalesce(
        target_snapshot,
        jsonb_build_object('target_missing_at_capture', true)
      )
  );

  return new;
end;
$$;

revoke all on function private.capture_report_evidence()
  from public, anon, authenticated;

-- Existing reports can only be snapshotted at migration time, so mark them
-- separately from evidence captured at the original report submission.
insert into public.report_evidence (
  report_id,
  target_type,
  target_id,
  snapshot
)
select
  report.id,
  report.target_type,
  report.target_id,
  jsonb_build_object('capture_source', 'migration_backfill')
    || coalesce(
      case report.target_type
        when 'post' then (
          select jsonb_build_object(
            'id', post.id,
            'author_id', post.author_id,
            'organization_author_id', post.organization_author_id,
            'content', post.content,
            'image_path', post.image_path,
            'post_kind', post.post_kind,
            'created_at', post.created_at,
            'updated_at', post.updated_at
          )
          from public.posts as post
          where post.id = report.target_id
        )
        when 'comment' then (
          select jsonb_build_object(
            'id', comment.id,
            'author_id', comment.author_id,
            'post_id', comment.post_id,
            'parent_comment_id', comment.parent_comment_id,
            'content', comment.content,
            'created_at', comment.created_at,
            'updated_at', comment.updated_at
          )
          from public.comments as comment
          where comment.id = report.target_id
        )
        when 'profile' then (
          select jsonb_build_object(
            'id', profile.id,
            'username', profile.username,
            'full_name', profile.full_name,
            'bio', profile.bio,
            'avatar_path', profile.avatar_path,
            'institute_id', profile.institute_id,
            'created_at', profile.created_at,
            'updated_at', profile.updated_at
          )
          from public.profiles as profile
          where profile.id = report.target_id
        )
      end,
      jsonb_build_object('target_missing_at_capture', true)
    )
from public.reports as report
on conflict (report_id) do nothing;

drop trigger if exists reports_capture_evidence on public.reports;
create trigger reports_capture_evidence
after insert on public.reports
for each row
execute function private.capture_report_evidence();

create or replace function private.prevent_report_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'report_evidence is append-only';
end;
$$;

revoke all on function private.prevent_report_evidence_mutation()
  from public, anon, authenticated;

drop trigger if exists report_evidence_prevent_mutation on public.report_evidence;
create trigger report_evidence_prevent_mutation
before update or delete on public.report_evidence
for each row
execute function private.prevent_report_evidence_mutation();

create or replace function public.apply_account_moderation_action(
  actor_user_id uuid,
  target_user_id uuid,
  next_status public.account_moderation_status,
  next_user_message text,
  next_expires_at timestamptz,
  internal_note text
)
returns public.account_moderation
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role public.admin_role;
  previous_moderation public.account_moderation;
  result public.account_moderation;
  action_name text;
begin
  if actor_user_id is null
    or target_user_id is null
    or next_status is null then
    raise exception using
      errcode = '22023',
      message = 'account_moderation_input_invalid';
  end if;

  select admin.role
  into actor_role
  from public.admin_users as admin
  where admin.user_id = actor_user_id
    and admin.is_active;

  if actor_role is null or actor_role = 'reviewer' then
    raise exception using
      errcode = '42501',
      message = 'account_moderation_not_authorized';
  end if;

  if not exists (
    select 1 from auth.users as account where account.id = target_user_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'account_moderation_target_not_found';
  end if;

  if next_status = 'active' then
    next_user_message := null;
    next_expires_at := null;
  elsif next_user_message is null
    or char_length(btrim(next_user_message)) not between 3 and 500 then
    raise exception using
      errcode = '22023',
      message = 'account_moderation_message_invalid';
  end if;

  if next_status = 'banned' and next_expires_at is not null then
    raise exception using
      errcode = '22023',
      message = 'account_moderation_ban_cannot_expire';
  end if;

  if next_expires_at is not null and next_expires_at <= now() then
    raise exception using
      errcode = '22023',
      message = 'account_moderation_expiry_invalid';
  end if;

  if internal_note is not null
    and char_length(btrim(internal_note)) not between 3 and 2000 then
    raise exception using
      errcode = '22023',
      message = 'account_moderation_internal_note_invalid';
  end if;

  select moderation.*
  into previous_moderation
  from public.account_moderation as moderation
  where moderation.user_id = target_user_id;

  insert into public.account_moderation (
    user_id,
    status,
    user_message,
    expires_at,
    updated_by
  ) values (
    target_user_id,
    next_status,
    case when next_status = 'active' then null else btrim(next_user_message) end,
    next_expires_at,
    actor_user_id
  )
  on conflict (user_id) do update set
    status = excluded.status,
    user_message = excluded.user_message,
    expires_at = excluded.expires_at,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into result;

  action_name := case next_status
    when 'active' then 'moderation.account_restore'
    when 'warned' then 'moderation.account_warn'
    when 'restricted' then 'moderation.account_restrict'
    when 'suspended' then 'moderation.account_suspend'
    when 'banned' then 'moderation.account_ban'
  end;

  insert into public.admin_audit_logs (
    actor_user_id,
    actor_role,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    actor_user_id,
    actor_role,
    action_name,
    'profile',
    target_user_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'previous_status', previous_moderation.status,
      'previous_expires_at', previous_moderation.expires_at,
      'next_status', result.status,
      'next_expires_at', result.expires_at,
      'internal_note', nullif(btrim(internal_note), '')
    ))
  );

  return result;
end;
$$;

revoke all on function public.apply_account_moderation_action(
  uuid,
  uuid,
  public.account_moderation_status,
  text,
  timestamptz,
  text
) from public, anon, authenticated;
grant execute on function public.apply_account_moderation_action(
  uuid,
  uuid,
  public.account_moderation_status,
  text,
  timestamptz,
  text
) to service_role;

comment on table public.account_moderation is
  'Current server-managed account moderation state. Historical actions live in admin_audit_logs.';
comment on table public.report_evidence is
  'Append-only server-visible snapshot captured when a report is submitted.';
comment on function public.apply_account_moderation_action(
  uuid,
  uuid,
  public.account_moderation_status,
  text,
  timestamptz,
  text
) is 'Service-role-only atomic account moderation and audit operation.';
