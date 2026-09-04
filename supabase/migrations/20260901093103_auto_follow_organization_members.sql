insert into public.organization_follows (
  organization_id,
  user_id,
  created_at
)
select
  membership.organization_id,
  membership.user_id,
  membership.created_at
from public.organization_members as membership
on conflict (organization_id, user_id) do nothing;

create or replace function private.follow_organization_for_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_follows (
    organization_id,
    user_id
  )
  values (
    new.organization_id,
    new.user_id
  )
  on conflict (organization_id, user_id) do nothing;

  return new;
end;
$$;

revoke all
on function private.follow_organization_for_member()
from public, anon, authenticated;

create trigger organization_members_follow_organization
after insert or update of organization_id, user_id, role
on public.organization_members
for each row
execute function private.follow_organization_for_member();

comment on function private.follow_organization_for_member() is
  'Automatically follows an organization when a profile becomes an owner, admin, or editor.';
