-- Preserve the original target UUID after a reported row is deleted.
-- The nullable target-specific columns remain the authoritative foreign
-- keys. This value is an immutable audit identifier, not a polymorphic FK.

alter table public.reports
add column target_id uuid not null default gen_random_uuid();


alter table public.reports
add constraint report_target_id_matches_live_target
check (
  num_nonnulls(post_id, comment_id, profile_id) = 0
  or target_id = coalesce(post_id, comment_id, profile_id)
);


create or replace function private.set_report_target_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.target_id = coalesce(
    new.post_id,
    new.comment_id,
    new.profile_id
  );

  return new;
end;
$$;


revoke all
on function private.set_report_target_id()
from public;


create trigger reports_set_target_id
before insert on public.reports
for each row
execute function private.set_report_target_id();
