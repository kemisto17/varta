-- Paginated organization-following rows for a visible student profile.
-- The existing organization_follows table remains private; this guarded
-- SECURITY DEFINER RPC exposes only campus-scoped organization summaries.

create or replace function public.get_profile_followed_organizations_page(
  target_profile_id uuid,
  cursor_created_at timestamptz default null,
  cursor_organization_id uuid default null,
  result_limit integer default 24
)
returns table (
  created_at timestamptz,
  organization_id uuid,
  name text,
  avatar_path text,
  is_verified boolean,
  campus_short_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    follow.created_at,
    organization.id,
    organization.name,
    organization.avatar_path,
    organization.is_verified,
    coalesce(institute.short_name, university.short_name)
  from public.organization_follows as follow
  join public.organizations as organization
    on organization.id = follow.organization_id
  join public.universities as university
    on university.id = organization.university_id
  left join public.institutes as institute
    on institute.id = organization.institute_id
  where follow.user_id = target_profile_id
    and (
      target_profile_id = (select auth.uid())
      or (
        (select private.is_verified_user())
        and exists (
          select 1
          from public.profiles as target_profile
          where target_profile.id = target_profile_id
            and target_profile.is_verified = true
        )
        and (select private.profile_is_in_current_university(target_profile_id))
        and not (select private.users_have_block_relation(target_profile_id))
      )
    )
    and (select private.can_view_organization(organization.id))
    and (
      cursor_created_at is null
      or follow.created_at < cursor_created_at
      or (
        follow.created_at = cursor_created_at
        and follow.organization_id < cursor_organization_id
      )
    )
  order by follow.created_at desc, follow.organization_id desc
  limit least(greatest(result_limit, 1), 50);
$$;

revoke all
on function public.get_profile_followed_organizations_page(
  uuid,
  timestamptz,
  uuid,
  integer
)
from public, anon;

grant execute
on function public.get_profile_followed_organizations_page(
  uuid,
  timestamptz,
  uuid,
  integer
)
to authenticated;

comment on function public.get_profile_followed_organizations_page(
  uuid,
  timestamptz,
  uuid,
  integer
) is
  'Returns paginated organization follows for the current or visible same-university profile.';
