create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_full_name_trgm_idx
  on public.profiles
  using gin (full_name extensions.gin_trgm_ops);

create index if not exists profiles_username_trgm_idx
  on public.profiles
  using gin (username extensions.gin_trgm_ops);

create index if not exists profiles_branch_trgm_idx
  on public.profiles
  using gin (branch extensions.gin_trgm_ops);

create index if not exists organizations_name_trgm_idx
  on public.organizations
  using gin (name extensions.gin_trgm_ops);

create index if not exists organizations_slug_trgm_idx
  on public.organizations
  using gin (slug extensions.gin_trgm_ops);

create index if not exists events_title_trgm_idx
  on public.events
  using gin (title extensions.gin_trgm_ops);

create or replace function public.search_people(
  search_query text,
  result_limit integer default 8
)
returns table (
  id uuid,
  full_name text,
  username text,
  branch text,
  year smallint,
  avatar_path text,
  is_verified boolean,
  institute_id uuid,
  institute_name text,
  institute_short_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with input as (
    select
      trim(search_query) as term,
      least(greatest(coalesce(result_limit, 8), 1), 12) as row_limit
  )
  select
    profile.id,
    profile.full_name,
    profile.username,
    profile.branch,
    profile.year,
    profile.avatar_path,
    profile.is_verified,
    institute.id,
    institute.name,
    institute.short_name
  from public.profiles as profile
  join public.institutes as institute
    on institute.id = profile.institute_id
  cross join input
  where char_length(input.term) >= 2
    and profile.is_verified
    and institute.university_id = (
      select private.current_university_id()
    )
    and not exists (
      select 1
      from public.user_blocks as user_block
      where (
        user_block.blocker_id = (select auth.uid())
        and user_block.blocked_id = profile.id
      )
      or (
        user_block.blocker_id = profile.id
        and user_block.blocked_id = (select auth.uid())
      )
    )
    and (
      profile.full_name ilike '%' || input.term || '%'
      or profile.username ilike '%' || input.term || '%'
      or profile.branch ilike '%' || input.term || '%'
    )
  order by
    case
      when lower(profile.username) = lower(input.term) then 0
      when profile.username ilike input.term || '%' then 1
      when profile.full_name ilike input.term || '%' then 2
      else 3
    end,
    greatest(
      extensions.similarity(profile.full_name, input.term),
      extensions.similarity(profile.username, input.term),
      extensions.similarity(profile.branch, input.term)
    ) desc,
    profile.full_name,
    profile.id
  limit (select row_limit from input);
$$;

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
security definer
set search_path = ''
as $$
  with input as (
    select
      trim(search_query) as term,
      least(greatest(coalesce(result_limit, 8), 1), 12) as row_limit
  )
  select
    organization.id,
    organization.name,
    organization.slug,
    organization.description,
    organization.avatar_path,
    organization.is_verified,
    institute.id,
    institute.name,
    institute.short_name
  from public.organizations as organization
  left join public.institutes as institute
    on institute.id = organization.institute_id
  cross join input
  where char_length(input.term) >= 2
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
security definer
set search_path = ''
as $$
  with input as (
    select
      trim(search_query) as term,
      least(greatest(coalesce(result_limit, 8), 1), 12) as row_limit
  )
  select
    event.id,
    event.title,
    event.location,
    event.starts_at,
    event.ends_at,
    event.cover_path,
    organization.id,
    organization.name,
    organization.is_verified
  from public.events as event
  join public.organizations as organization
    on organization.id = event.organization_id
  cross join input
  where char_length(input.term) >= 2
    and event.status = 'published'
    and event.university_id = (
      select private.current_university_id()
    )
    and (
      event.institute_id is null
      or event.institute_id = (
        select private.current_institute_id()
      )
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
security definer
set search_path = ''
as $$
  select
    organization.id,
    organization.name,
    organization.slug,
    organization.description,
    organization.avatar_path,
    organization.is_verified,
    institute.id,
    institute.name,
    institute.short_name
  from public.organizations as organization
  left join public.institutes as institute
    on institute.id = organization.institute_id
  where organization.is_verified
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

revoke all on function public.search_people(text, integer) from public, anon;
revoke all on function public.search_organizations(text, integer) from public, anon;
revoke all on function public.search_events(text, integer) from public, anon;
revoke all on function public.get_discovery_organizations(integer) from public, anon;

grant execute on function public.search_people(text, integer) to authenticated;
grant execute on function public.search_organizations(text, integer) to authenticated;
grant execute on function public.search_events(text, integer) to authenticated;
grant execute on function public.get_discovery_organizations(integer) to authenticated;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('bug', 'idea', 'other')),
  message text not null check (
    char_length(trim(message)) between 10 and 2000
  ),
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_created_at_idx
  on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

revoke all on table public.feedback from anon, authenticated;
grant insert (user_id, category, message) on public.feedback to authenticated;

create policy "Verified users can submit feedback"
on public.feedback
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_verified_user())
);

comment on table public.feedback is
  'Private internal-alpha feedback. Clients may insert their own rows but cannot read feedback.';

comment on function public.search_people(text, integer) is
  'Same-university verified profile search with bidirectional block filtering.';

comment on function public.search_organizations(text, integer) is
  'Same-university organization search with ranked name and slug matches.';

comment on function public.search_events(text, integer) is
  'Upcoming same-university published event search by title or organization name.';
