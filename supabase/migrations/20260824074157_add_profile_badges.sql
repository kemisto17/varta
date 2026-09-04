-- Evolve the notification foundation's minimal badge tables into the complete
-- profile badge model. Badge definitions and assignments remain privileged;
-- the mobile client receives narrowly scoped read access only.

-- Drop policies and the notification trigger before renaming their columns.
drop policy if exists "Authenticated users can view public badges"
on public.badges;

drop policy if exists "Verified students can view public profile badges"
on public.profile_badges;

drop trigger if exists profile_badges_create_notification
on public.profile_badges;

-- --------------------------------------------------------------------------
-- Badge definitions
-- --------------------------------------------------------------------------

alter table public.badges
add column slug text,
add column icon text not null default '•',
add column priority integer not null default 0,
add column visibility text;

-- Existing badge rows receive collision-safe slugs before the unique
-- constraint is installed. The canonical seed below replaces matching names
-- with their stable public slugs.
update public.badges
set slug = concat(
  coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'badge'
  ),
  '-',
  left(id::text, 8)
),
visibility = case when is_public then 'public' else 'owner_only' end
where slug is null or visibility is null;

alter table public.badges
alter column slug set not null,
alter column visibility set not null,
alter column visibility set default 'public',
add constraint badges_slug_key unique (slug),
add constraint badges_slug_format_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
add constraint badges_icon_length_check
  check (char_length(icon) between 1 and 16),
add constraint badges_priority_range_check
  check (priority between -1000 and 1000),
add constraint badges_visibility_check
  check (visibility in ('public', 'owner_only'));

alter table public.badges
drop column is_public;

create index badges_visibility_priority_idx
on public.badges(visibility, priority desc, name);

-- --------------------------------------------------------------------------
-- Badge assignments
-- --------------------------------------------------------------------------

drop index if exists public.profile_badges_user_created_at_idx;

alter table public.profile_badges
drop constraint profile_badges_pkey,
drop constraint profile_badges_user_id_badge_id_key;

alter table public.profile_badges
rename column user_id to profile_id;

alter table public.profile_badges
rename column created_at to assigned_at;

alter table public.profile_badges
rename constraint profile_badges_user_id_fkey
to profile_badges_profile_id_fkey;

alter table public.profile_badges
add column assigned_by uuid default auth.uid()
  references auth.users(id) on delete set null;

alter table public.profile_badges
drop column id;

alter table public.profile_badges
add constraint profile_badges_pkey primary key (profile_id, badge_id);

create index profile_badges_assigned_by_idx
on public.profile_badges(assigned_by)
where assigned_by is not null;

-- profile_badges_badge_id_idx from the foundation migration remains useful
-- for reverse assignment lookups.

-- --------------------------------------------------------------------------
-- Canonical badge catalog
-- --------------------------------------------------------------------------

insert into public.badges (
  name,
  slug,
  description,
  icon,
  priority,
  visibility
)
values
  (
    'Coordinator',
    'coordinator',
    'Coordinates an official campus community or initiative.',
    '◇',
    100,
    'public'
  ),
  (
    'Class Representative',
    'class-representative',
    'Represents a class in official student communication.',
    '◆',
    80,
    'public'
  ),
  (
    'Group Leader',
    'group-leader',
    'Leads a recognized student group or project team.',
    '●',
    90,
    'public'
  ),
  (
    'Club Lead',
    'club-lead',
    'Leads an official campus club or society.',
    '○',
    70,
    'public'
  ),
  (
    'Organizer',
    'organizer',
    'Organizes campus events and student activities.',
    '△',
    60,
    'public'
  ),
  (
    'Founding Member',
    'founding-member',
    'Helped establish the Varta campus community.',
    '◈',
    50,
    'public'
  ),
  (
    'Early User',
    'early-user',
    'Joined Varta during its early campus rollout.',
    '✦',
    40,
    'public'
  ),
  (
    'Friend',
    'friend',
    'A private account label visible only to its owner.',
    '♡',
    10,
    'owner_only'
  )
on conflict (name) do update
set slug = excluded.slug,
    description = excluded.description,
    icon = excluded.icon,
    priority = excluded.priority,
    visibility = excluded.visibility;

-- --------------------------------------------------------------------------
-- RLS helpers
-- --------------------------------------------------------------------------

-- SECURITY DEFINER avoids circular RLS evaluation between badge definitions
-- and assignments. Both helpers derive the caller from auth.uid(), are kept in
-- the private schema, and are executable only by authenticated clients.
create or replace function private.current_user_has_badge(
  target_badge_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profile_badges as assignment
      where assignment.profile_id = (select auth.uid())
        and assignment.badge_id = target_badge_id
    );
$$;

create or replace function private.badge_is_public(
  target_badge_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.badges as badge
      where badge.id = target_badge_id
        and badge.visibility = 'public'
    );
$$;

revoke all
on function private.current_user_has_badge(uuid)
from public, anon, authenticated;

revoke all
on function private.badge_is_public(uuid)
from public, anon, authenticated;

grant execute
on function private.current_user_has_badge(uuid)
to authenticated;

grant execute
on function private.badge_is_public(uuid)
to authenticated;

-- --------------------------------------------------------------------------
-- Public-only assignment notifications
-- --------------------------------------------------------------------------

-- An active assignment is already unique by (profile_id, badge_id), so this
-- older history-level unique index is unnecessary. Removing and later
-- reassigning a public badge can now produce a fresh notification.
drop index if exists public.notifications_unique_badge_assignment_idx;

create or replace function private.create_badge_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  badge_name text;
begin
  select badge.name
  into badge_name
  from public.badges as badge
  where badge.id = new.badge_id
    and badge.visibility = 'public';

  if badge_name is null then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    type,
    badge_id,
    title,
    body
  )
  values (
    new.profile_id,
    'badge_assigned',
    new.badge_id,
    'New badge',
    'You received the ' || badge_name || ' badge.'
  );

  return new;
end;
$$;

revoke all
on function private.create_badge_assignment_notification()
from public, anon, authenticated;

create trigger profile_badges_create_notification
after insert on public.profile_badges
for each row
execute function private.create_badge_assignment_notification();

-- --------------------------------------------------------------------------
-- Least-privilege grants and visibility policies
-- --------------------------------------------------------------------------

revoke all on table public.badges from anon, authenticated;
revoke all on table public.profile_badges from anon, authenticated;

grant select (
  id,
  name,
  slug,
  description,
  icon,
  priority,
  visibility,
  created_at
)
on public.badges
to authenticated;

-- assigned_by is intentionally omitted from mobile read privileges.
grant select (profile_id, badge_id, assigned_at)
on public.profile_badges
to authenticated;

create policy "Verified users can view public or owned badge definitions"
on public.badges
for select
to authenticated
using (
  (
    visibility = 'public'
    and (select private.is_verified_user())
  )
  or (select private.current_user_has_badge(id))
);

create policy "Users can view visible profile badge assignments"
on public.profile_badges
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (
    (select private.badge_is_public(badge_id))
    and (select private.is_verified_user())
    and (select private.profile_is_in_current_university(profile_id))
  )
);

comment on table public.badges is
  'Privileged badge catalog. visibility controls assignment disclosure.';

comment on table public.profile_badges is
  'Privileged profile badge assignments. Mobile clients are read-only.';

comment on column public.profile_badges.assigned_by is
  'Auth user that assigned the badge. NULL denotes a privileged SQL migration or manual SQL Editor action.';

;
