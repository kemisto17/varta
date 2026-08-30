alter table public.posts
add column post_kind text not null default 'general',
add column lost_found_location text,
add column lost_found_resolved_at timestamptz;

alter table public.posts
add constraint posts_post_kind_valid
check (post_kind in ('general', 'lost', 'found')),
add constraint posts_lost_found_location_length
check (
  lost_found_location is null
  or char_length(trim(lost_found_location)) between 1 and 160
),
add constraint posts_lost_found_shape
check (
  (
    post_kind = 'general'
    and lost_found_location is null
    and lost_found_resolved_at is null
  )
  or post_kind in ('lost', 'found')
),
add constraint posts_lost_found_requires_description
check (
  post_kind = 'general'
  or char_length(trim(content)) between 1 and 500
);

create index posts_open_lost_found_feed_idx
on public.posts (created_at desc, id desc)
where
  post_kind in ('lost', 'found')
  and lost_found_resolved_at is null;

grant insert (
  post_kind,
  lost_found_location
)
on public.posts
to authenticated;

grant update (
  post_kind,
  lost_found_location,
  lost_found_resolved_at
)
on public.posts
to authenticated;

comment on column public.posts.post_kind is
'Post category: general, lost, or found.';

comment on column public.posts.lost_found_location is
'Optional public campus location for a lost or found item.';

comment on column public.posts.lost_found_resolved_at is
'When set, marks a lost or found item as returned/resolved.';
