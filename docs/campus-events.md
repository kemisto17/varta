# Campus events

Varta events are structured official content owned by an organization. They do
not replace organization posts or external registration systems.

## Roles

- Owners and admins can create events and manage every event for their organization.
- Editors can create events and manage only events they created.
- Followers and ordinary verified students cannot create or edit official events.
- Organization records and role assignments are privileged operations; the mobile app cannot change them.

Role assignments should be made only from a trusted administrator context. For
example, after verifying the organization and account out of band:

```sql
insert into public.organization_members (
  organization_id,
  user_id,
  role,
  assigned_by
)
values (
  '<organization-uuid>',
  '<profile-uuid>',
  'owner',
  '<trusted-admin-profile-uuid>'
)
on conflict (organization_id, user_id)
do update set
  role = excluded.role,
  assigned_by = excluded.assigned_by;
```

## Visibility

Published university-wide events (`institute_id is null`) are visible to every
verified student at that university. Institute-specific events are visible only
to verified students in that institute. Organization managers can also see their
organization's drafts.

## Media and notifications

Cover images live in the private `event-media` bucket at
`<organization-id>/<unique-id>.<extension>`. The database stores only the object
path; clients generate short-lived signed URLs. Event cancellation creates one
trusted in-app notification per interested student and includes `event_id` for
deep linking. The existing push function understands this notification type.

`event_interests` is a save/follow signal, not registration. Its composite key is
ready for a future server-side reminder scheduler without changing the mobile data
model.
