drop index if exists public.comments_post_created_at_idx;

create index comments_post_created_at_id_idx
  on public.comments (post_id, created_at, id);

comment on index public.comments_post_created_at_id_idx is
  'Supports stable ascending cursor pages for a post comment thread.';
