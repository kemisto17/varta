-- ============================================================
-- HARDEN EVENT COVER PATHS
--
-- Legacy Supabase cover:
--   <organization-id>/<file>
--
-- R2 cover:
--   events/organizations/<organization-id>/<event-id>/<file>
--
-- The stored path must belong to the event's own organization
-- and, for R2, to the event row itself.
-- ============================================================

alter table public.events
drop constraint if exists events_cover_path_check;


alter table public.events
add constraint events_cover_path_check
check (
  cover_path is null

  or

  (
    organization_id is not null

    and

    (
      cover_path ~ (
        '^'
        || organization_id::text
        || '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
      )

      or

      cover_path ~ (
        '^events/organizations/'
        || organization_id::text
        || '/'
        || id::text
        || '/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
      )
    )
  )
);


comment on constraint events_cover_path_check
on public.events
is
  'Ensures an event can only reference a legacy cover owned by its organization or an R2 cover owned by that exact event.';