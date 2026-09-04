alter table public.events
add column interested_count integer not null default 0;

alter table public.events
add constraint events_interested_count_nonnegative
check (interested_count >= 0);

update public.events as event
set interested_count = interest_totals.total
from (
  select
    event_id,
    count(*)::integer as total
  from public.event_interests
  group by event_id
) as interest_totals
where event.id = interest_totals.event_id;

create or replace function private.sync_event_interested_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.events
    set interested_count = interested_count + 1
    where id = new.event_id;

    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.events
    set interested_count = greatest(interested_count - 1, 0)
    where id = old.event_id;

    return old;
  end if;

  if old.event_id is distinct from new.event_id then
    update public.events
    set interested_count = greatest(interested_count - 1, 0)
    where id = old.event_id;

    update public.events
    set interested_count = interested_count + 1
    where id = new.event_id;
  end if;

  return new;
end;
$$;

revoke all
on function private.sync_event_interested_count()
from public, anon, authenticated;

create trigger event_interests_sync_event_interested_count
after insert or delete or update of event_id
on public.event_interests
for each row
execute function private.sync_event_interested_count();

comment on column public.events.interested_count is
  'Aggregate number of event interest rows. Maintained by database trigger.';
