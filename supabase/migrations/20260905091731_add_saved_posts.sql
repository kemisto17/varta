create table public.post_saves (
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  post_id uuid not null
    references public.posts(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index post_saves_user_created_at_idx
on public.post_saves(user_id, created_at desc, post_id desc);

create index post_saves_post_id_idx
on public.post_saves(post_id);

alter table public.post_saves enable row level security;

revoke all on table public.post_saves from public, anon, authenticated;
grant select on table public.post_saves to authenticated;
grant insert (user_id, post_id) on table public.post_saves to authenticated;
grant delete on table public.post_saves to authenticated;

create policy "Users can view own visible saved posts"
on public.post_saves
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts as post
    where post.id = post_saves.post_id
  )
);

create policy "Users can save visible posts"
on public.post_saves
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts as post
    where post.id = post_saves.post_id
  )
);

create policy "Users can remove own saved posts"
on public.post_saves
for delete
to authenticated
using (user_id = (select auth.uid()));

comment on table public.post_saves is
  'Private per-user post bookmarks. Post RLS is evaluated before a save is visible or created.';
