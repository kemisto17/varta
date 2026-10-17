-- Varta admin foundation.
--
-- The browser never receives write access to these tables. The admin web app
-- validates a normal Supabase Auth session, looks up the user in admin_users
-- with a server-only secret key, and performs privileged work on the server.

do $$
begin
  create type public.admin_role as enum (
    'super_admin',
    'admin',
    'moderator',
    'reviewer'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.admin_users (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  role public.admin_role not null,
  is_active boolean not null default true,
  created_by uuid
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_users_active_role_idx
  on public.admin_users (role, user_id)
  where is_active;

drop trigger if exists admin_users_set_updated_at
  on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row
execute function private.set_updated_at();

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null
    references auth.users(id) on delete restrict,
  actor_role public.admin_role not null,
  action text not null
    check (action ~ '^[a-z][a-z0-9_.]{2,79}$'),
  target_type text not null
    check (target_type ~ '^[a-z][a-z0-9_]{1,39}$'),
  target_id text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc, id desc);

create index if not exists admin_audit_logs_actor_created_at_idx
  on public.admin_audit_logs (actor_user_id, created_at desc);

create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs (target_type, target_id, created_at desc)
  where target_id is not null;

create or replace function private.prevent_admin_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin_audit_logs is append-only';
end;
$$;

revoke all on function private.prevent_admin_audit_log_mutation()
  from public, anon, authenticated;

drop trigger if exists admin_audit_logs_prevent_mutation
  on public.admin_audit_logs;
create trigger admin_audit_logs_prevent_mutation
before update or delete on public.admin_audit_logs
for each row
execute function private.prevent_admin_audit_log_mutation();

alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on table public.admin_users from public, anon, authenticated;
revoke all on table public.admin_audit_logs from public, anon, authenticated;

-- Supabase's 2026 Data API defaults require explicit server-role grants for
-- newly-created tables. No browser role receives a grant or RLS policy.
grant select, insert, update, delete
  on table public.admin_users to service_role;
grant select, insert
  on table public.admin_audit_logs to service_role;
grant usage, select
  on sequence public.admin_audit_logs_id_seq to service_role;

comment on table public.admin_users is
  'Server-only authorization registry for the separate Varta admin panel.';
comment on table public.admin_audit_logs is
  'Append-only log of privileged actions performed through the Varta admin panel.';

-- Organization deactivation is intentionally additive. Existing mobile
-- column grants stay unchanged, so the new administrative fields are not
-- exposed to authenticated mobile clients.
alter table public.organizations
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid
    references auth.users(id) on delete set null;

alter table public.organizations
  drop constraint if exists organizations_deactivation_state_check;
alter table public.organizations
  add constraint organizations_deactivation_state_check
  check (
    (is_active and deactivated_at is null and deactivated_by is null)
    or (not is_active and deactivated_at is not null)
  );

create index if not exists organizations_active_university_name_idx
  on public.organizations (university_id, name, id)
  where is_active;

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
    and exists (
      select 1
      from public.organizations as organization
      where organization.id = target_organization_id
        and organization.is_active
        and (
          exists (
            select 1
            from public.organization_members as membership
            where membership.organization_id = organization.id
              and membership.user_id = (select auth.uid())
          )
          or (
            (select private.is_verified_user())
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
        and organization.is_active
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
      join public.organizations as organization
        on organization.id = event.organization_id
      where event.id = target_event_id
        and organization.is_active
        and (
          (select private.can_create_organization_event(organization.id))
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
        and organization.is_active
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
        and organization.is_active
        and organization.university_id = (
          select private.current_university_id()
        )
    );
$$;

drop policy if exists "Users can view scoped events" on public.events;
create policy "Users can view scoped events"
on public.events
for select
to authenticated
using (
  exists (
    select 1
    from public.organizations as organization
    where organization.id = events.organization_id
      and organization.is_active
  )
  and (
    (
      organization_id is not null
      and (select private.can_create_organization_event(organization_id))
    )
    or (
      status in ('published', 'cancelled', 'completed')
      and (select private.is_verified_user())
      and university_id = (select private.current_university_id())
      and (
        institute_id is null
        or institute_id = (select private.current_institute_id())
      )
    )
  )
);

-- These functions were converted to SECURITY INVOKER by the existing Varta
-- hardening migration. Explicit active filters are defense in depth and make
-- their intent clear even when called with the server role.
create or replace function public.search_organizations(
  search_query text,
  result_limit integer default 8
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  avatar_path text,
  is_verified boolean,
  institute_id uuid,
  institute_name text,
  institute_short_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select trim(search_query) as term,
      least(greatest(coalesce(result_limit, 8), 1), 12) as row_limit
  )
  select organization.id, organization.name, organization.slug,
    organization.description, organization.avatar_path,
    organization.is_verified, institute.id, institute.name,
    institute.short_name
  from public.organizations as organization
  left join public.institutes as institute
    on institute.id = organization.institute_id
  cross join input
  where char_length(input.term) >= 2
    and organization.is_active
    and organization.university_id = (
      select private.current_university_id()
    )
    and (
      organization.name ilike '%' || input.term || '%'
      or organization.slug ilike '%' || input.term || '%'
    )
  order by
    case
      when lower(organization.slug) = lower(input.term) then 0
      when organization.slug ilike input.term || '%' then 1
      when organization.name ilike input.term || '%' then 2
      else 3
    end,
    greatest(
      extensions.similarity(organization.name, input.term),
      extensions.similarity(organization.slug, input.term)
    ) desc,
    organization.is_verified desc,
    organization.name,
    organization.id
  limit (select row_limit from input);
$$;

create or replace function public.search_events(
  search_query text,
  result_limit integer default 8
)
returns table (
  id uuid,
  title text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  cover_path text,
  organization_id uuid,
  organization_name text,
  organization_is_verified boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select trim(search_query) as term,
      least(greatest(coalesce(result_limit, 8), 1), 12) as row_limit
  )
  select event.id, event.title, event.location, event.starts_at,
    event.ends_at, event.cover_path, organization.id, organization.name,
    organization.is_verified
  from public.events as event
  join public.organizations as organization
    on organization.id = event.organization_id
  cross join input
  where char_length(input.term) >= 2
    and organization.is_active
    and event.status = 'published'
    and event.university_id = (select private.current_university_id())
    and (
      event.institute_id is null
      or event.institute_id = (select private.current_institute_id())
    )
    and coalesce(event.ends_at, event.starts_at) >= now()
    and (
      event.title ilike '%' || input.term || '%'
      or organization.name ilike '%' || input.term || '%'
    )
  order by
    case
      when lower(event.title) = lower(input.term) then 0
      when event.title ilike input.term || '%' then 1
      when organization.name ilike input.term || '%' then 2
      else 3
    end,
    greatest(
      extensions.similarity(event.title, input.term),
      extensions.similarity(organization.name, input.term)
    ) desc,
    event.starts_at,
    event.id
  limit (select row_limit from input);
$$;

create or replace function public.get_discovery_organizations(
  result_limit integer default 5
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  avatar_path text,
  is_verified boolean,
  institute_id uuid,
  institute_name text,
  institute_short_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select organization.id, organization.name, organization.slug,
    organization.description, organization.avatar_path,
    organization.is_verified, institute.id, institute.name,
    institute.short_name
  from public.organizations as organization
  left join public.institutes as institute
    on institute.id = organization.institute_id
  where organization.is_active
    and organization.is_verified
    and organization.university_id = (
      select private.current_university_id()
    )
    and not exists (
      select 1
      from public.organization_follows as follow
      where follow.organization_id = organization.id
        and follow.user_id = (select auth.uid())
    )
  order by organization.name, organization.id
  limit least(greatest(coalesce(result_limit, 5), 1), 10);
$$;

revoke all on function public.search_organizations(text, integer)
  from public, anon;
revoke all on function public.search_events(text, integer)
  from public, anon;
revoke all on function public.get_discovery_organizations(integer)
  from public, anon;
grant execute on function public.search_organizations(text, integer)
  to authenticated;
grant execute on function public.search_events(text, integer)
  to authenticated;
grant execute on function public.get_discovery_organizations(integer)
  to authenticated;

comment on column public.organizations.is_active is
  'Server-managed lifecycle flag. Inactive organizations are hidden from mobile RLS and discovery.';

