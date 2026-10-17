-- Keep the service-role moderation RPC within schemas it can read. Admin
-- moderation targets student profiles, so querying auth.users is unnecessary.
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
    select 1 from public.profiles as profile where profile.id = target_user_id
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

comment on function public.apply_account_moderation_action(
  uuid,
  uuid,
  public.account_moderation_status,
  text,
  timestamptz,
  text
) is 'Service-role-only atomic account moderation and audit operation for student profiles.';
