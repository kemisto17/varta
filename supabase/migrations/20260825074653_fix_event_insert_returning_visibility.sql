-- INSERT ... RETURNING must be able to evaluate draft visibility from the new
-- row directly. Looking the same row up through can_view_event() is not visible
-- to the function snapshot during the INSERT statement.

drop policy "Users can view scoped events" on public.events;

create policy "Users can view scoped events"
on public.events
for select
to authenticated
using (
  (
    organization_id is not null
    and (select private.can_create_organization_event(organization_id))
  )
  or (
    status in ('published', 'cancelled', 'completed')
    and (select private.is_verified_user())
    and university_id = (select private.current_university_id())
    and (
      institute_id is null
      or institute_id = (select private.current_institute_id())
    )
  )
);;
