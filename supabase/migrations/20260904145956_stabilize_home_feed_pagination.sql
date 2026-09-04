-- A short-lived pagination cache, not impression or behavioral tracking.
-- Only immutable order/IDs/scores are cached; payload and eligibility are live.
create table private.home_feed_sessions (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '1 hour')
);
create index home_feed_sessions_expiry_idx on private.home_feed_sessions(expires_at);
create table private.home_feed_entries (
  session_id uuid not null references private.home_feed_sessions(id) on delete cascade,
  position bigint not null,
  item_type text not null,
  item_id uuid not null,
  score numeric not null,
  primary key (session_id, position),
  unique(session_id, item_type, item_id)
);
alter table private.home_feed_sessions enable row level security;
alter table private.home_feed_entries enable row level security;
revoke all on private.home_feed_sessions, private.home_feed_entries from public, anon, authenticated;
grant select, insert on private.home_feed_sessions, private.home_feed_entries to authenticated;
create policy "Own feed sessions" on private.home_feed_sessions to authenticated
using (viewer_id = (select auth.uid()) and expires_at > now())
with check (viewer_id = (select auth.uid()) and expires_at <= now() + interval '1 hour');
create policy "Own feed entries" on private.home_feed_entries to authenticated
using (exists (select 1 from private.home_feed_sessions where id = session_id))
with check (exists (select 1 from private.home_feed_sessions where id = session_id));

-- Reuses the original candidate eligibility, author/media payload and formula.
-- A narrowed ID set avoids hydrating unrelated new content during pagination.
create or replace function private.home_feed_candidates(candidate_ids uuid[] default null)
returns table (
  item_type text,
  item_id uuid,
  sort_created_at timestamptz,
  ranking_score numeric,

  post_id uuid,
  post_author_id uuid,
  post_organization_author_id uuid,
  post_content text,
  post_image_path text,
  post_kind text,
  post_created_at timestamptz,
  post_updated_at timestamptz,
  post_like_count bigint,
  post_comment_count bigint,
  post_is_liked_by_viewer boolean,

  lost_found_id uuid,
  lost_found_created_by uuid,
  lost_found_organization_author_id uuid,
  lost_found_kind text,
  lost_found_title text,
  lost_found_description text,
  lost_found_category text,
  lost_found_campus_location text,
  lost_found_item_date date,
  lost_found_image_path text,
  lost_found_status text,
  lost_found_resolved_at timestamptz,
  lost_found_created_at timestamptz,
  lost_found_updated_at timestamptz,

  event_id uuid,
  event_university_id uuid,
  event_institute_id uuid,
  event_organization_id uuid,
  event_created_by uuid,
  event_title text,
  event_description text,
  event_location text,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  event_registration_url text,
  event_cover_path text,
  event_status text,
  event_interested_count integer,
  event_is_interested_by_viewer boolean,

  student_author_id uuid,
  student_author_full_name text,
  student_author_username text,
  student_author_branch text,
  student_author_year smallint,
  student_author_avatar_path text,
  student_author_is_verified boolean,
  student_author_institute_id uuid,
  student_author_institute_name text,
  student_author_institute_short_name text,

  organization_author_id uuid,
  organization_author_name text,
  organization_author_avatar_path text,
  organization_author_is_verified boolean,
  organization_author_institute_short_name text,
  organization_author_university_short_name text,
  organization_is_followed_by_viewer boolean,
  organization_can_manage_by_viewer boolean
)

language sql stable security invoker set search_path = ''
as $$
  with constants as (
    select
      72.0::numeric as recency_weight,
      18.0::numeric as followed_org_bonus,
      4.0::numeric as like_weight,
      5.0::numeric as comment_weight,
      8.0::numeric as lost_found_bonus,
      7.0::numeric as event_bonus,
      4.0::numeric as event_soon_bonus
  ),

  post_candidates as (
    select
      'post'::text as item_type,
      post.id as item_id,
      post.created_at as sort_created_at,
      post.id as post_id,
      post.author_id as student_author_key,
      post.organization_author_id as organization_author_key,
      post.author_id as post_author_id,
      post.organization_author_id as post_organization_author_id,
      post.content as post_content,
      post.image_path as post_image_path,
      post.post_kind as post_kind,
      post.created_at as post_created_at,
      post.updated_at as post_updated_at,
      null::uuid as lost_found_id,
      null::uuid as lost_found_created_by,
      null::uuid as lost_found_organization_author_id,
      null::text as lost_found_kind,
      null::text as lost_found_title,
      null::text as lost_found_description,
      null::text as lost_found_category,
      null::text as lost_found_campus_location,
      null::date as lost_found_item_date,
      null::text as lost_found_image_path,
      null::text as lost_found_status,
      null::timestamptz as lost_found_resolved_at,
      null::timestamptz as lost_found_created_at,
      null::timestamptz as lost_found_updated_at,
      null::uuid as event_id,
      null::uuid as event_university_id,
      null::uuid as event_institute_id,
      null::uuid as event_organization_id,
      null::uuid as event_created_by,
      null::text as event_title,
      null::text as event_description,
      null::text as event_location,
      null::timestamptz as event_starts_at,
      null::timestamptz as event_ends_at,
      null::text as event_registration_url,
      null::text as event_cover_path,
      null::text as event_status,
      null::integer as event_interested_count,
      null::boolean as event_is_interested_by_viewer,
      (
        select count(*)
        from public.post_likes as post_like
        where post_like.post_id = post.id
      ) as like_count,
      (
        select count(*)
        from public.comments as comment
        where comment.post_id = post.id
      ) as comment_count,
      exists (
        select 1
        from public.post_likes as viewer_like
        where viewer_like.post_id = post.id
          and viewer_like.user_id = (select auth.uid())
      ) as is_liked_by_viewer
    from public.posts as post
    where (candidate_ids is null or post.id = any(candidate_ids))
      and post.post_kind = 'general'
      and (
        post.author_id is null
        or not (
          select private.users_have_block_relation(post.author_id)
        )
      )
  ),

  lost_found_candidates as (
    select
      'lost_found'::text as item_type,
      item.id as item_id,
      item.created_at as sort_created_at,
      null::uuid as post_id,
      item.created_by as student_author_key,
      item.organization_author_id as organization_author_key,
      null::uuid as post_author_id,
      null::uuid as post_organization_author_id,
      null::text as post_content,
      null::text as post_image_path,
      null::text as post_kind,
      null::timestamptz as post_created_at,
      null::timestamptz as post_updated_at,
      item.id as lost_found_id,
      item.created_by as lost_found_created_by,
      item.organization_author_id as lost_found_organization_author_id,
      item.kind as lost_found_kind,
      item.title as lost_found_title,
      item.description as lost_found_description,
      item.category as lost_found_category,
      item.campus_location as lost_found_campus_location,
      item.item_date as lost_found_item_date,
      item.image_path as lost_found_image_path,
      item.status as lost_found_status,
      item.resolved_at as lost_found_resolved_at,
      item.created_at as lost_found_created_at,
      item.updated_at as lost_found_updated_at,
      null::uuid as event_id,
      null::uuid as event_university_id,
      null::uuid as event_institute_id,
      null::uuid as event_organization_id,
      null::uuid as event_created_by,
      null::text as event_title,
      null::text as event_description,
      null::text as event_location,
      null::timestamptz as event_starts_at,
      null::timestamptz as event_ends_at,
      null::text as event_registration_url,
      null::text as event_cover_path,
      null::text as event_status,
      null::integer as event_interested_count,
      null::boolean as event_is_interested_by_viewer,
      0::bigint as like_count,
      0::bigint as comment_count,
      false as is_liked_by_viewer
    from public.lost_found_items as item
    where (candidate_ids is null or item.id = any(candidate_ids))
      and item.status = 'active'
      and (
        item.created_by is null
        or not (
          select private.users_have_block_relation(item.created_by)
        )
      )
  ),

  event_candidates as (
    select
      'event'::text as item_type,
      event.id as item_id,
      event.created_at as sort_created_at,
      null::uuid as post_id,
      null::uuid as student_author_key,
      event.organization_id as organization_author_key,
      null::uuid as post_author_id,
      null::uuid as post_organization_author_id,
      null::text as post_content,
      null::text as post_image_path,
      null::text as post_kind,
      null::timestamptz as post_created_at,
      null::timestamptz as post_updated_at,
      null::uuid as lost_found_id,
      null::uuid as lost_found_created_by,
      null::uuid as lost_found_organization_author_id,
      null::text as lost_found_kind,
      null::text as lost_found_title,
      null::text as lost_found_description,
      null::text as lost_found_category,
      null::text as lost_found_campus_location,
      null::date as lost_found_item_date,
      null::text as lost_found_image_path,
      null::text as lost_found_status,
      null::timestamptz as lost_found_resolved_at,
      null::timestamptz as lost_found_created_at,
      null::timestamptz as lost_found_updated_at,
      event.id as event_id,
      event.university_id as event_university_id,
      event.institute_id as event_institute_id,
      event.organization_id as event_organization_id,
      event.created_by as event_created_by,
      event.title as event_title,
      event.description as event_description,
      event.location as event_location,
      event.starts_at as event_starts_at,
      event.ends_at as event_ends_at,
      event.registration_url as event_registration_url,
      event.cover_path as event_cover_path,
      event.status as event_status,
      event.interested_count as event_interested_count,
      exists (
        select 1
        from public.event_interests as interest
        where interest.event_id = event.id
          and interest.user_id = (select auth.uid())
      ) as event_is_interested_by_viewer,
      0::bigint as like_count,
      0::bigint as comment_count,
      false as is_liked_by_viewer
    from public.events as event
    where (candidate_ids is null or event.id = any(candidate_ids))
      and event.status in ('published', 'cancelled')
      and (
        event.starts_at >= now()
        or event.ends_at >= now()
      )
  ),

  candidates as (
    select * from post_candidates
    union all
    select * from lost_found_candidates
    union all
    select * from event_candidates
  ),

  hydrated as (
    select
      candidate.*,
      profile.id as student_author_id,
      profile.full_name as student_author_full_name,
      profile.username as student_author_username,
      profile.branch as student_author_branch,
      profile.year as student_author_year,
      profile.avatar_path as student_author_avatar_path,
      profile.is_verified as student_author_is_verified,
      institute.id as student_author_institute_id,
      institute.name as student_author_institute_name,
      institute.short_name as student_author_institute_short_name,
      organization.id as organization_author_id,
      organization.name as organization_author_name,
      organization.avatar_path as organization_author_avatar_path,
      organization.is_verified as organization_author_is_verified,
      organization_institute.short_name as organization_author_institute_short_name,
      organization_university.short_name as organization_author_university_short_name,
      exists (
        select 1
        from public.organization_follows as follow
        where follow.organization_id = candidate.organization_author_key
          and follow.user_id = (select auth.uid())
      ) as organization_is_followed_by_viewer,
      exists (
        select 1
        from public.organization_members as member
        where member.organization_id = candidate.organization_author_key
          and member.user_id = (select auth.uid())
          and member.role in ('owner', 'admin', 'editor')
      ) as organization_can_manage_by_viewer
    from candidates as candidate
    left join public.profiles as profile
      on profile.id = candidate.student_author_key
    left join public.institutes as institute
      on institute.id = profile.institute_id
    left join public.organizations as organization
      on organization.id = candidate.organization_author_key
    left join public.institutes as organization_institute
      on organization_institute.id = organization.institute_id
    left join public.universities as organization_university
      on organization_university.id = organization.university_id
    where candidate.student_author_key is null
      or profile.id is not null
  ),

  scored as (
    select
      hydrated.*,
      round(
        (
          constants.recency_weight /
            (1.0 + greatest(extract(epoch from (now() - hydrated.sort_created_at)) / 3600.0, 0) / 24.0)
        )
        + case
            when hydrated.organization_is_followed_by_viewer
              then constants.followed_org_bonus
            else 0
          end
        -- Select ln(numeric) so round(score, 6) receives a numeric value.
        + ln(hydrated.like_count::numeric + 1) * constants.like_weight
        + ln(hydrated.comment_count::numeric + 1) * constants.comment_weight
        + case
            when hydrated.item_type = 'lost_found'
              then constants.lost_found_bonus
            else 0
          end
        + case
            when hydrated.item_type = 'event'
              then constants.event_bonus
            else 0
          end
        + case
            when hydrated.item_type = 'event'
              and hydrated.event_starts_at <= now() + interval '3 days'
              then constants.event_soon_bonus
            else 0
          end,
        6
      ) as ranking_score
    from hydrated
    cross join constants
  )
  select
    paged.item_type,
    paged.item_id,
    paged.sort_created_at,
    paged.ranking_score,
    paged.post_id,
    paged.post_author_id,
    paged.post_organization_author_id,
    paged.post_content,
    paged.post_image_path,
    paged.post_kind,
    paged.post_created_at,
    paged.post_updated_at,
    paged.like_count as post_like_count,
    paged.comment_count as post_comment_count,
    paged.is_liked_by_viewer as post_is_liked_by_viewer,
    paged.lost_found_id,
    paged.lost_found_created_by,
    paged.lost_found_organization_author_id,
    paged.lost_found_kind,
    paged.lost_found_title,
    paged.lost_found_description,
    paged.lost_found_category,
    paged.lost_found_campus_location,
    paged.lost_found_item_date,
    paged.lost_found_image_path,
    paged.lost_found_status,
    paged.lost_found_resolved_at,
    paged.lost_found_created_at,
    paged.lost_found_updated_at,
    paged.event_id,
    paged.event_university_id,
    paged.event_institute_id,
    paged.event_organization_id,
    paged.event_created_by,
    paged.event_title,
    paged.event_description,
    paged.event_location,
    paged.event_starts_at,
    paged.event_ends_at,
    paged.event_registration_url,
    paged.event_cover_path,
    paged.event_status,
    paged.event_interested_count,
    paged.event_is_interested_by_viewer,
    paged.student_author_id,
    paged.student_author_full_name,
    paged.student_author_username,
    paged.student_author_branch,
    paged.student_author_year,
    paged.student_author_avatar_path,
    paged.student_author_is_verified,
    paged.student_author_institute_id,
    paged.student_author_institute_name,
    paged.student_author_institute_short_name,
    paged.organization_author_id,
    paged.organization_author_name,
    paged.organization_author_avatar_path,
    paged.organization_author_is_verified,
    paged.organization_author_institute_short_name,
    paged.organization_author_university_short_name,
    paged.organization_is_followed_by_viewer,
    paged.organization_can_manage_by_viewer
  from scored as paged;

$$;
revoke all on function private.home_feed_candidates(uuid[]) from public, anon, authenticated;
grant execute on function private.home_feed_candidates(uuid[]) to authenticated;


create or replace function public.get_home_feed_page(
  feed_mode text default 'campus',
  result_limit integer default 20,
  page_cursor jsonb default null
)
returns jsonb language plpgsql volatile security invoker set search_path = ''
as $$
declare
  page_size integer := least(greatest(coalesce(result_limit, 20), 1), 40);
  snapshot_id uuid;
  after_position bigint := 0;
  batch_last_position bigint;
  batch_rows jsonb;
  visible_rows jsonb := '[]'::jsonb;
  response jsonb;
begin
  if (select auth.uid()) is null or not (select private.is_verified_user()) then
    raise exception 'Sign in with a verified account.' using errcode = '42501';
  end if;
  if feed_mode not in ('campus', 'latest') or feed_mode is null then
    raise exception 'Invalid feed mode.' using errcode = '22023';
  end if;
  if page_cursor is not null and (page_cursor->>'mode') is distinct from feed_mode then
    raise exception 'Cursor belongs to another feed mode.' using errcode = '22023';
  end if;

  if feed_mode = 'latest' then
    with rows as materialized (
      select row_number() over (order by sort_created_at desc, item_id desc) as page_order, item.*
      from public.get_home_feed('latest', page_size, null,
        (page_cursor->>'createdAt')::timestamptz, (page_cursor->>'id')::uuid) as item
    )
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(to_jsonb(rows) - 'page_order' order by page_order)
        filter (where page_order <= page_size), '[]'::jsonb),
      'hasMore', count(*) > page_size,
      'cursor', (select jsonb_build_object('mode', 'latest', 'createdAt', sort_created_at, 'id', item_id)
        from rows where page_order <= page_size order by page_order desc limit 1)
    ) into response from rows;
    return response;
  end if;

  if page_cursor is null then
    insert into private.home_feed_sessions(viewer_id) values ((select auth.uid()))
    returning id into snapshot_id;
    insert into private.home_feed_entries(session_id, position, item_type, item_id, score)
    select snapshot_id,
      row_number() over (order by ranking_score desc, sort_created_at desc, item_id desc, item_type desc),
      item_type, item_id, ranking_score
    from private.home_feed_candidates();
  else
    snapshot_id := (page_cursor->>'snapshotId')::uuid;
    after_position := (page_cursor->>'position')::bigint;
    if snapshot_id is null or after_position is null or after_position < 0 then
      raise exception 'Invalid feed cursor.' using errcode = '22023';
    end if;
    if not exists (select 1 from private.home_feed_sessions where id = snapshot_id) then
      raise exception 'Feed session expired. Pull to refresh.' using errcode = 'P0001';
    end if;
  end if;

  -- Recheck small batches, continuing past removed/blocked entries until the
  -- page plus its lookahead is full. Never hydrate the entire remaining feed.
  loop
    with batch as materialized (
      select * from private.home_feed_entries
      where session_id = snapshot_id and position > after_position
      order by position limit page_size + 1
    ), rows as (
      select entry.position, to_jsonb(item) || jsonb_build_object('ranking_score', entry.score) as payload
      from private.home_feed_candidates(array(select item_id from batch)) as item
      join batch as entry on entry.item_type = item.item_type and entry.item_id = item.item_id
    )
    select (select max(position) from batch),
      coalesce(jsonb_agg(to_jsonb(rows) order by position), '[]'::jsonb)
    into batch_last_position, batch_rows from rows;
    exit when batch_last_position is null;
    visible_rows := visible_rows || batch_rows;
    exit when jsonb_array_length(visible_rows) > page_size;
    after_position := batch_last_position;
  end loop;

  with numbered as (
    select (value->>'position')::bigint as position, value->'payload' as payload, ordinal as page_order
    from jsonb_array_elements(visible_rows) with ordinality as item(value, ordinal)
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(payload order by position) filter (where page_order <= page_size), '[]'::jsonb),
    'hasMore', count(*) > page_size,
    'cursor', case when count(*) = 0 then null else jsonb_build_object(
      'mode', 'campus', 'snapshotId', snapshot_id,
      'position', max(position) filter (where page_order <= page_size)
    ) end
  ) into response from numbered;
  return response;
end;
$$;
revoke all on function public.get_home_feed_page(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.get_home_feed_page(text, integer, jsonb) to authenticated;

create or replace function private.purge_expired_home_feed_sessions()
returns void language sql security definer set search_path = ''
as $$ delete from private.home_feed_sessions where expires_at <= now(); $$;
revoke all on function private.purge_expired_home_feed_sessions() from public, anon, authenticated;
-- The project already uses pg_cron for push receipt processing.
select cron.schedule('purge-varta-feed-sessions', '*/15 * * * *',
  'select private.purge_expired_home_feed_sessions()');
