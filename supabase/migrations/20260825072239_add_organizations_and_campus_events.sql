-- Minimal official-organization foundation plus structured campus events.
-- Organization creation and role assignment remain privileged SQL operations.
-- Mobile clients can follow organizations, manage authorized events, and save
-- visible events as Interested without receiving elevated credentials.

-- --------------------------------------------------------------------------
-- Organizations, roles, and follows
-- --------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null
    references public.universities(id) on delete cascade,
  institute_id uuid
    references public.institutes(id) on delete set null,
  name text not null
    check (char_length(trim(name)) between 2 and 100),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default ''
    check (char_length(description) <= 1000),
  avatar_path text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_university_name_idx
on public.organizations(university_id, name);

create index organizations_institute_id_idx
on public.organizations(institute_id)
where institute_id is not null;

create table public.organization_members (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  role text not null
    check (role in ('owner', 'admin', 'editor')),
  assigned_by uuid
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_role_idx
on public.organization_members(user_id, role, organization_id);

create index organization_members_assigned_by_idx
on public.organization_members(assigned_by)
where assigned_by is not null;

create table public.organization_follows (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_follows_user_id_idx
on public.organization_follows(user_id, organization_id);

-- Seed the official organization requested for the acceptance flow without
-- hard-coding a generated university UUID.
insert into public.organizations (
  university_id,
  name,
  slug,
  description,
  is_verified
)
select
  university.id,
  'Coding Club',
  'coding-club',
  'Official coding, software, and technology community.',
  true
from public.universities as university
where university.slug = 'svvv'
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    is_verified = excluded.is_verified,
    updated_at = now();

-- --------------------------------------------------------------------------
-- Events and student interest
-- --------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null
    references public.universities(id) on delete cascade,
  institute_id uuid
    references public.institutes(id) on delete set null,
  organization_id uuid
    references public.organizations(id) on delete restrict,
  created_by uuid not null
    references public.profiles(id) on delete restrict,
  title text not null
    check (char_length(trim(title)) between 3 and 120),
  description text not null default ''
    check (char_length(description) <= 5000),
  location text not null default ''
    check (char_length(location) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz,
  registration_url text
    check (
      registration_url is null
      or (
        char_length(registration_url) <= 500
        and registration_url ~ '^https://[^[:space:]]+$'
      )
    ),
  cover_path text
    check (
      cover_path is null
      or cover_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
    ),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index events_university_status_starts_at_idx
on public.events(university_id, status, starts_at, id)
where status in ('published', 'cancelled');

create index events_institute_status_starts_at_idx
on public.events(institute_id, status, starts_at, id)
where institute_id is not null
  and status in ('published', 'cancelled');

create index events_organization_starts_at_idx
on public.events(organization_id, starts_at desc, id desc)
where organization_id is not null;

create index events_created_by_idx
on public.events(created_by);

create table public.event_interests (
  event_id uuid not null
    references public.events(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_interests_user_id_idx
on public.event_interests(user_id, event_id);

-- --------------------------------------------------------------------------
-- Trusted role and visibility helpers
-- --------------------------------------------------------------------------

create or replace function private.has_organization_role(
  target_organization_id uuid,
  allowed_roles text[]
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
      from public.organization_members as membership
      where membership.organization_id = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.role = any(allowed_roles)
    );
$$;

create or replace function private.can_view_organization(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.organization_members as membership
        where membership.organization_id = target_organization_id
          and membership.user_id = (select auth.uid())
      )
      or (
        (select private.is_verified_user())
        and exists (
          select 1
          from public.organizations as organization
          where organization.id = target_organization_id
            and organization.university_id = (
              select private.current_university_id()
            )
        )
      )
    );
$$;

create or replace function private.can_create_organization_event(
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
        and membership.role in ('owner', 'admin', 'editor')
        and organization.university_id = (
          select private.current_university_id()
        )
    );
$$;

create or replace function private.can_view_event(
  target_event_id uuid
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
      from public.events as event
      where event.id = target_event_id
        and (
          (
            event.organization_id is not null
            and (select private.can_create_organization_event(
              event.organization_id
            ))
          )
          or (
            event.status in ('published', 'cancelled', 'completed')
            and (select private.is_verified_user())
            and event.university_id = (
              select private.current_university_id()
            )
            and (
              event.institute_id is null
              or event.institute_id = (
                select private.current_institute_id()
              )
            )
          )
        )
    );
$$;

create or replace function private.can_manage_event(
  target_event_id uuid
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
      from public.events as event
      join public.organization_members as membership
        on membership.organization_id = event.organization_id
      join public.organizations as organization
        on organization.id = membership.organization_id
      where event.id = target_event_id
        and membership.user_id = (select auth.uid())
        and organization.university_id = (
          select private.current_university_id()
        )
        and (
          membership.role in ('owner', 'admin')
          or (
            membership.role = 'editor'
            and event.created_by = (select auth.uid())
          )
        )
    );
$$;

create or replace function private.can_upload_event_media(
  target_organization_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select private.is_verified_user())
    and target_organization_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.organization_members as membership
      join public.organizations as organization
        on organization.id = membership.organization_id
      where membership.organization_id::text = target_organization_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'editor')
        and organization.university_id = (
          select private.current_university_id()
        )
    );
$$;

create or replace function private.can_view_event_media(
  target_path text
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
      from public.events as event
      where event.cover_path = target_path
        and (select private.can_view_event(event.id))
    );
$$;

create or replace function private.can_delete_event_media(
  target_path text,
  target_owner_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and cardinality(storage.foldername(target_path)) = 1
    and (select private.can_upload_event_media(
      (storage.foldername(target_path))[1]
    ))
    and (
      (
        target_owner_id = (select auth.uid())::text
        and not exists (
          select 1
          from public.events as event
          where event.cover_path = target_path
        )
      )
      or exists (
        select 1
        from public.events as event
        where event.cover_path = target_path
          and (select private.can_manage_event(event.id))
      )
      or exists (
        select 1
        from public.organization_members as membership
        join public.organizations as organization
          on organization.id = membership.organization_id
        where membership.organization_id::text =
          (storage.foldername(target_path))[1]
          and membership.user_id = (select auth.uid())
          and membership.role in ('owner', 'admin')
          and organization.university_id = (
            select private.current_university_id()
          )
      )
    );
$$;

revoke all
on function private.has_organization_role(uuid, text[])
from public, anon, authenticated;

revoke all
on function private.can_view_organization(uuid)
from public, anon, authenticated;

revoke all
on function private.can_create_organization_event(uuid)
from public, anon, authenticated;

revoke all
on function private.can_view_event(uuid)
from public, anon, authenticated;

revoke all
on function private.can_manage_event(uuid)
from public, anon, authenticated;

revoke all
on function private.can_upload_event_media(text)
from public, anon, authenticated;

revoke all
on function private.can_view_event_media(text)
from public, anon, authenticated;

revoke all
on function private.can_delete_event_media(text, text)
from public, anon, authenticated;

grant execute
on function private.has_organization_role(uuid, text[])
to authenticated;

grant execute
on function private.can_view_organization(uuid)
to authenticated;

grant execute
on function private.can_create_organization_event(uuid)
to authenticated;

grant execute
on function private.can_view_event(uuid)
to authenticated;

grant execute
on function private.can_manage_event(uuid)
to authenticated;

grant execute
on function private.can_upload_event_media(text)
to authenticated;

grant execute
on function private.can_view_event_media(text)
to authenticated;

grant execute
on function private.can_delete_event_media(text, text)
to authenticated;

-- --------------------------------------------------------------------------
-- RLS and least-privilege grants
-- --------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_follows enable row level security;
alter table public.events enable row level security;
alter table public.event_interests enable row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.organization_follows from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.event_interests from anon, authenticated;

grant select (
  id,
  university_id,
  institute_id,
  name,
  slug,
  description,
  avatar_path,
  is_verified,
  created_at,
  updated_at
)
on public.organizations
to authenticated;

grant select (organization_id, user_id, role, created_at)
on public.organization_members
to authenticated;

grant select, insert, delete
on public.organization_follows
to authenticated;

grant select
on public.events
to authenticated;

grant insert (
  university_id,
  institute_id,
  organization_id,
  created_by,
  title,
  description,
  location,
  starts_at,
  ends_at,
  registration_url,
  status
)
on public.events
to authenticated;

grant update (
  title,
  description,
  location,
  starts_at,
  ends_at,
  registration_url,
  cover_path,
  status,
  updated_at
)
on public.events
to authenticated;

grant delete
on public.events
to authenticated;

grant select, insert, delete
on public.event_interests
to authenticated;

create policy "Verified users can view university organizations"
on public.organizations
for select
to authenticated
using ((select private.can_view_organization(id)));

create policy "Users can view own organization roles"
on public.organization_members
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can view own organization follows"
on public.organization_follows
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can follow visible organizations"
on public.organization_follows
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.can_view_organization(organization_id))
);

create policy "Users can unfollow organizations"
on public.organization_follows
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can view scoped events"
on public.events
for select
to authenticated
using ((select private.can_view_event(id)));

create policy "Organization roles can create draft events"
on public.events
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'draft'
  and organization_id is not null
  and university_id = (select private.current_university_id())
  and (
    institute_id is null
    or institute_id = (select private.current_institute_id())
  )
  and (select private.can_create_organization_event(organization_id))
  and exists (
    select 1
    from public.organizations as organization
    where organization.id = events.organization_id
      and organization.university_id = events.university_id
  )
);

create policy "Organization roles can update managed events"
on public.events
for update
to authenticated
using ((select private.can_manage_event(id)))
with check ((select private.can_manage_event(id)));

create policy "Organization roles can delete managed drafts"
on public.events
for delete
to authenticated
using (
  status = 'draft'
  and (select private.can_manage_event(id))
);

create policy "Users can view own event interests"
on public.event_interests
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can save visible events"
on public.event_interests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.can_view_event(event_id))
  and exists (
    select 1
    from public.events as event
    where event.id = event_interests.event_id
      and event.status = 'published'
  )
);

create policy "Users can remove own event interests"
on public.event_interests
for delete
to authenticated
using (user_id = (select auth.uid()));

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function private.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row
execute function private.set_updated_at();

-- --------------------------------------------------------------------------
-- Private event media
-- --------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-media',
  'event-media',
  false,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Organization roles can upload event media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-media'
  and cardinality(storage.foldername(name)) = 1
  and (select private.can_upload_event_media(
    (storage.foldername(name))[1]
  ))
  and storage.filename(name) ~
    '^[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
);

create policy "Users can view visible event media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'event-media'
  and (select private.can_view_event_media(name))
);

create policy "Organization roles can delete managed event media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-media'
  and (select private.can_delete_event_media(name, owner_id))
);

-- --------------------------------------------------------------------------
-- Cancellation notifications and event deep-link data
-- --------------------------------------------------------------------------

alter type public.notification_type
add value if not exists 'event_cancelled';

alter table public.notifications
add column event_id uuid
  references public.events(id) on delete cascade;

create index notifications_event_id_idx
on public.notifications(event_id)
where event_id is not null;

create unique index notifications_unique_event_cancellation_idx
on public.notifications(recipient_id, event_id, type)
where event_id is not null;

create or replace function private.create_event_cancellation_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'cancelled' or new.status <> 'cancelled' then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    event_id,
    title,
    body
  )
  select
    interest.user_id,
    (select auth.uid()),
    'event_cancelled',
    new.id,
    'Event cancelled',
    left(new.title, 500)
  from public.event_interests as interest
  where interest.event_id = new.id
  on conflict do nothing;

  return new;
end;
$$;

revoke all
on function private.create_event_cancellation_notifications()
from public, anon, authenticated;

create trigger events_create_cancellation_notifications
after update of status on public.events
for each row
when (old.status is distinct from new.status)
execute function private.create_event_cancellation_notifications();

comment on table public.organizations is
  'Official university organizations. Creation and role assignment are privileged.';

comment on table public.organization_members is
  'Privileged organization role assignments. Mobile clients are read-only.';

comment on table public.events is
  'Structured official campus events with university and optional institute scope.';

comment on table public.event_interests is
  'Student event saves used by Varta and future reminder delivery.';

comment on column public.events.cover_path is
  'Private event-media object path. Signed URLs are generated at read time.';

;
