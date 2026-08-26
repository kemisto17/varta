-- Allow authenticated users to execute post authorization helpers.

revoke all
on function private.can_publish_for_organization(uuid)
from public;

grant execute
on function private.can_publish_for_organization(uuid)
to authenticated;


revoke all
on function private.can_manage_post(uuid)
from public;

grant execute
on function private.can_manage_post(uuid)
to authenticated;


-- Avoid re-querying public.posts during INSERT ... RETURNING.
-- Determine post visibility directly from the author identities.

create or replace function private.post_author_is_in_current_university(
  target_author_id uuid,
  target_organization_author_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (
      target_author_id is not null
      and exists (
        select 1
        from public.profiles as profile
        join public.institutes as institute
          on institute.id = profile.institute_id
        where profile.id = target_author_id
          and institute.university_id = (
            select private.current_university_id()
          )
      )
    )
    or
    (
      target_organization_author_id is not null
      and exists (
        select 1
        from public.organizations as organization
        where organization.id = target_organization_author_id
          and organization.university_id = (
            select private.current_university_id()
          )
          and organization.is_active
      )
    );
$function$;

revoke all
on function private.post_author_is_in_current_university(uuid, uuid)
from public;

grant execute
on function private.post_author_is_in_current_university(uuid, uuid)
to authenticated;


drop policy if exists "Verified users can view university posts"
on public.posts;

create policy "Verified users can view university posts"
on public.posts
for select
to authenticated
using (
  (select private.is_verified_user())
  and (
    select private.post_author_is_in_current_university(
      posts.author_id,
      posts.organization_author_id
    )
  )
  and (
    posts.author_id is null
    or not (
      select private.current_user_has_blocked(posts.author_id)
    )
  )
);