-- Event owners and organization admins can remove managed events. Editors
-- remain limited to the events they created through private.can_manage_event.
-- This migration is intentionally local until the production change is
-- explicitly approved.

drop policy if exists "Organization roles can delete managed drafts"
on public.events;

create policy "Organization roles can delete managed events"
on public.events
for delete
to authenticated
using ((select private.can_manage_event(id)));
