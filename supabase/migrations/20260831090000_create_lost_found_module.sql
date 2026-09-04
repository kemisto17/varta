create table public.lost_found_items (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete cascade,
  organization_author_id uuid references public.organizations(id) on delete cascade,
  university_id uuid not null default private.current_university_id()
    references public.universities(id) on delete cascade,
  kind text not null,
  title text not null,
  description text not null,
  category text not null default 'other',
  campus_location text,
  item_date date not null default current_date,
  image_path text,
  status text not null default 'active',
  resolved_at timestamptz,
  legacy_post_id uuid unique references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lost_found_items_one_author
    check (num_nonnulls(created_by, organization_author_id) = 1),
  constraint lost_found_items_kind_valid
    check (kind in ('lost', 'found')),
  constraint lost_found_items_title_length
    check (char_length(trim(title)) between 1 and 100),
  constraint lost_found_items_description_length
    check (char_length(trim(description)) between 1 and 500),
  constraint lost_found_items_category_valid
    check (
      category in (
        'accessories',
        'bags',
        'books_notes',
        'clothing',
        'electronics',
        'ids_cards',
        'keys',
        'other'
      )
    ),
  constraint lost_found_items_location_length
    check (
      campus_location is null
      or char_length(trim(campus_location)) between 1 and 160
    ),
  constraint lost_found_items_status_valid
    check (status in ('active', 'resolved')),
  constraint lost_found_items_resolution_shape
    check (
      (status = 'active' and resolved_at is null)
      or (status = 'resolved' and resolved_at is not null)
    )
);

create trigger lost_found_items_set_updated_at
before update on public.lost_found_items
for each row
execute function private.set_updated_at();

create index lost_found_items_active_feed_idx
on public.lost_found_items (university_id, created_at desc, id desc)
where status = 'active';

create index lost_found_items_resolved_feed_idx
on public.lost_found_items (university_id, created_at desc, id desc)
where status = 'resolved';

insert into public.lost_found_items (
  id,
  created_by,
  organization_author_id,
  university_id,
  kind,
  title,
  description,
  category,
  campus_location,
  item_date,
  image_path,
  status,
  resolved_at,
  legacy_post_id,
  created_at,
  updated_at
)
select
  post.id,
  post.author_id,
  post.organization_author_id,
  coalesce(student_institute.university_id, organization.university_id),
  post.post_kind,
  left(
    coalesce(
      nullif(trim(split_part(post.content, E'\n', 1)), ''),
      case when post.post_kind = 'lost' then 'Lost item' else 'Found item' end
    ),
    100
  ),
  post.content,
  'other',
  post.lost_found_location,
  post.created_at::date,
  post.image_path,
  case
    when post.lost_found_resolved_at is null then 'active'
    else 'resolved'
  end,
  post.lost_found_resolved_at,
  post.id,
  post.created_at,
  post.updated_at
from public.posts as post
left join public.profiles as profile
  on profile.id = post.author_id
left join public.institutes as student_institute
  on student_institute.id = profile.institute_id
left join public.organizations as organization
  on organization.id = post.organization_author_id
where post.post_kind in ('lost', 'found')
  and coalesce(student_institute.university_id, organization.university_id) is not null
on conflict (id) do nothing;

alter table public.lost_found_items enable row level security;

grant select, delete
on public.lost_found_items
to authenticated;

grant insert (
  created_by,
  organization_author_id,
  kind,
  title,
  description,
  category,
  campus_location,
  item_date,
  image_path
)
on public.lost_found_items
to authenticated;

grant update (
  kind,
  title,
  description,
  category,
  campus_location,
  item_date,
  image_path,
  status,
  resolved_at
)
on public.lost_found_items
to authenticated;

create policy "Verified users can view university lost and found"
on public.lost_found_items
for select
to authenticated
using (
  (select private.is_verified_user())
  and university_id = (select private.current_university_id())
  and (
    select private.post_author_is_in_current_university(
      lost_found_items.created_by,
      lost_found_items.organization_author_id
    )
  )
  and (
    created_by is null
    or not (select private.current_user_has_blocked(created_by))
  )
);

create policy "Verified users can create lost and found items"
on public.lost_found_items
for insert
to authenticated
with check (
  (select private.is_verified_user())
  and university_id = (select private.current_university_id())
  and (
    (
      created_by = (select auth.uid())
      and organization_author_id is null
    )
    or (
      created_by is null
      and organization_author_id is not null
      and (
        select private.can_publish_for_organization(
          lost_found_items.organization_author_id
        )
      )
    )
  )
);

create policy "Authorized authors can update lost and found items"
on public.lost_found_items
for update
to authenticated
using (
  (select private.is_verified_user())
  and (
    created_by = (select auth.uid())
    or (
      organization_author_id is not null
      and (
        select private.can_publish_for_organization(
          lost_found_items.organization_author_id
        )
      )
    )
  )
)
with check (
  (select private.is_verified_user())
  and university_id = (select private.current_university_id())
  and (
    created_by = (select auth.uid())
    or (
      organization_author_id is not null
      and (
        select private.can_publish_for_organization(
          lost_found_items.organization_author_id
        )
      )
    )
  )
);

create policy "Authorized authors can delete lost and found items"
on public.lost_found_items
for delete
to authenticated
using (
  created_by = (select auth.uid())
  or (
    organization_author_id is not null
    and (select private.is_verified_user())
    and (
      select private.can_publish_for_organization(
        lost_found_items.organization_author_id
      )
    )
  )
);

comment on table public.lost_found_items is
'Structured first-party Lost & Found listings surfaced independently from campus posts.';

comment on column public.lost_found_items.campus_location is
'Approximate campus location entered by the user; never device GPS data.';

comment on column public.lost_found_items.legacy_post_id is
'Original post row for listings migrated from the pre-module implementation.';
