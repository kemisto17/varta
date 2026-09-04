alter table public.events
drop constraint if exists events_cover_path_check;
alter table public.events
add constraint events_cover_path_check
check (
  cover_path is null

  or cover_path ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'

  or cover_path ~
    '^events/organizations/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[a-z0-9-]+[.](jpg|jpeg|png|webp|heic|heif)$'
);
