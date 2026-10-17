-- Organization owners can manage admin and editor roles from the mobile app.
-- Membership table writes remain unavailable to clients; these RPCs enforce
-- ownership, verification, and university scope at the database boundary.

create table private.organization_member_role_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  actor_user_id uuid not null,
  target_user_id uuid not null,
  previous_role text
    check (previous_role is null or previous_role in ('admin', 'editor')),
  next_role text
    check (next_role is null or next_role in ('admin', 'editor')),
  action text not null
    check (action in ('assigned', 'changed', 'removed')),
  created_at timestamptz not null default now(),
  check (
    (action = 'assigned' and previous_role is null and next_role is not null)
    or (action = 'changed' and previous_role is not null and next_role is not null)
    or (action = 'removed' and previous_role is not null and next_role is null)
  )
);

create index organization_member_role_audit_organization_created_idx
on private.organization_member_role_audit(organization_id, created_at desc);

alter table private.organization_member_role_audit enable row level security;

revoke all
on table private.organization_member_role_audit
from public, anon, authenticated;

create or replace function private.can_manage_organization_members(
  target_organization_id uuid
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
      from public.organization_members as membership
      join public.organizations as organization
        on organization.id = membership.organization_id
      where membership.organization_id = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and organization.is_active
        and organization.university_id = (
          select private.current_university_id()
        )
    );
$$;

revoke all
on function private.can_manage_organization_members(uuid)
from public, anon, authenticated;

create or replace function public.get_organization_members(
  target_organization_id uuid
)
returns table (
  user_id uuid,
  full_name text,
  username text,
  role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    select private.can_manage_organization_members(target_organization_id)
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only the organization owner can manage members.';
  end if;

  return query
  select
    membership.user_id,
    profile.full_name,
    profile.username,
    membership.role
  from public.organization_members as membership
  join public.profiles as profile
    on profile.id = membership.user_id
  where membership.organization_id = target_organization_id
    and membership.role in ('admin', 'editor')
  order by membership.role, profile.full_name, membership.user_id;
end;
$$;

create or replace function public.set_organization_member_role(
  target_organization_id uuid,
  target_user_id uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
  previous_role text;
begin
  if target_role is null or target_role not in ('admin', 'editor') then
    raise exception using
      errcode = '22023',
      message = 'Organization members can only be admins or editors.';
  end if;

  if not (
    select private.can_manage_organization_members(target_organization_id)
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only the organization owner can manage members.';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    join public.institutes as institute
      on institute.id = profile.institute_id
    where profile.id = target_user_id
      and profile.is_verified
      and institute.university_id = (
        select private.current_university_id()
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'The selected student is not eligible for this organization.';
  end if;

  select membership.role
  into previous_role
  from public.organization_members as membership
  where membership.organization_id = target_organization_id
    and membership.user_id = target_user_id
  for update;

  if previous_role = 'owner' then
    raise exception using
      errcode = '42501',
      message = 'Organization ownership cannot be changed here.';
  end if;

  if previous_role = target_role then
    return;
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    assigned_by
  )
  values (
    target_organization_id,
    target_user_id,
    target_role,
    (select auth.uid())
  )
  on conflict (organization_id, user_id)
  do update set
    role = excluded.role,
    assigned_by = excluded.assigned_by
  where organization_members.role in ('admin', 'editor');

  get diagnostics affected_rows = row_count;

  if affected_rows = 0 then
    raise exception using
      errcode = '42501',
      message = 'Organization ownership cannot be changed here.';
  end if;

  insert into private.organization_member_role_audit (
    organization_id,
    actor_user_id,
    target_user_id,
    previous_role,
    next_role,
    action
  )
  values (
    target_organization_id,
    (select auth.uid()),
    target_user_id,
    previous_role,
    target_role,
    case
      when previous_role is null then 'assigned'
      else 'changed'
    end
  );
end;
$$;

create or replace function public.remove_organization_member(
  target_organization_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_role text;
begin
  if not (
    select private.can_manage_organization_members(target_organization_id)
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only the organization owner can manage members.';
  end if;

  select membership.role
  into previous_role
  from public.organization_members as membership
  where membership.organization_id = target_organization_id
    and membership.user_id = target_user_id
  for update;

  if previous_role is null then
    return;
  end if;

  if previous_role = 'owner' then
    raise exception using
      errcode = '42501',
      message = 'Organization ownership cannot be changed here.';
  end if;

  delete from public.organization_members
  where organization_id = target_organization_id
    and user_id = target_user_id
    and role in ('admin', 'editor');

  insert into private.organization_member_role_audit (
    organization_id,
    actor_user_id,
    target_user_id,
    previous_role,
    next_role,
    action
  )
  values (
    target_organization_id,
    (select auth.uid()),
    target_user_id,
    previous_role,
    null,
    'removed'
  );
end;
$$;

revoke all
on function public.get_organization_members(uuid)
from public, anon;

revoke all
on function public.set_organization_member_role(uuid, uuid, text)
from public, anon;

revoke all
on function public.remove_organization_member(uuid, uuid)
from public, anon;

grant execute
on function public.get_organization_members(uuid)
to authenticated;

grant execute
on function public.set_organization_member_role(uuid, uuid, text)
to authenticated;

grant execute
on function public.remove_organization_member(uuid, uuid)
to authenticated;

comment on function public.get_organization_members(uuid) is
  'Lists admins and editors for an organization owner.';

comment on function public.set_organization_member_role(uuid, uuid, text) is
  'Lets an organization owner assign or change admin and editor roles.';

comment on function public.remove_organization_member(uuid, uuid) is
  'Lets an organization owner remove admin and editor roles.';
