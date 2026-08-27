-- Allow a user to view the limited identity details required by their own
-- Blocked users settings screen without reopening general profile visibility.

create or replace function public.get_my_blocked_users()
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_path text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.full_name,
    profile.username,
    profile.avatar_path,
    user_block.created_at as blocked_at
  from public.user_blocks as user_block
  join public.profiles as profile
    on profile.id = user_block.blocked_id
  where user_block.blocker_id = (select auth.uid())
  order by user_block.created_at desc, profile.id;
$$;

revoke all
on function public.get_my_blocked_users()
from public, anon, authenticated;

grant execute
on function public.get_my_blocked_users()
to authenticated;

comment on function public.get_my_blocked_users()
is
  'Returns limited identity details for profiles explicitly blocked by the authenticated user.';