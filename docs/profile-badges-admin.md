# Profile badges: privileged assignment workflow

Badge definitions and profile assignments are read-only in the Varta mobile
client. Run assignment changes only in the Supabase SQL Editor while signed in
as a trusted project administrator. Do not add a service-role key or badge
write path to the app.

Manual SQL Editor changes leave `assigned_by` as `NULL` because the editor is
not acting as an authenticated Varta user. A future trusted admin service can
set `assigned_by` to its admin auth user ID; the column already supports that
workflow.

## 1. Find the student by username

Replace `target_username` and confirm exactly one row before continuing.

```sql
select id, username, full_name, institute_id, is_verified
from public.profiles
where lower(username) = lower('target_username');
```

## 2. Find the badge by slug

Use a canonical slug such as `coordinator` or `friend`.

```sql
select id, name, slug, priority, visibility
from public.badges
where slug = 'coordinator';
```

## 3. Assign the badge

This statement resolves both identifiers itself and is safe to run twice. A
public assignment creates one in-app `badge_assigned` notification. An
`owner_only` assignment, including `friend`, creates no notification.

```sql
insert into public.profile_badges (profile_id, badge_id)
select profile.id, badge.id
from public.profiles as profile
cross join public.badges as badge
where lower(profile.username) = lower('target_username')
  and badge.slug = 'coordinator'
on conflict (profile_id, badge_id) do nothing
returning profile_id, badge_id, assigned_by, assigned_at;
```

If this returns no row, either the assignment already exists or one of the
lookup values is wrong. Run the list query below to distinguish those cases.

## 4. Remove the badge

```sql
delete from public.profile_badges as assignment
using public.profiles as profile, public.badges as badge
where assignment.profile_id = profile.id
  and assignment.badge_id = badge.id
  and lower(profile.username) = lower('target_username')
  and badge.slug = 'coordinator'
returning assignment.profile_id, assignment.badge_id, assignment.assigned_at;
```

The delete does not remove historical notifications. The badge disappears the
next time the profile or feed reloads.

## 5. List a student's current badges

```sql
select
  profile.username,
  badge.name,
  badge.slug,
  badge.visibility,
  badge.priority,
  assignment.assigned_at,
  assignment.assigned_by
from public.profile_badges as assignment
join public.profiles as profile
  on profile.id = assignment.profile_id
join public.badges as badge
  on badge.id = assignment.badge_id
where lower(profile.username) = lower('target_username')
order by badge.priority desc, badge.name;
```

## Acceptance test checklist

Use two verified students, A and B, from the same university.

1. Confirm A starts with no test badge assignments.
2. Assign `coordinator` to A. Confirm A sees it, B sees it on A's profile,
   feed cards show at most that one highest-priority public label, and A gets a
   `badge_assigned` notification.
3. Assign `friend` to A. Confirm A sees it and B does not. Confirm the Friend
   assignment created no notification.
4. Remove `coordinator`. Refresh both clients and confirm it disappears.
5. From an authenticated mobile client, attempt to insert into
   `profile_badges`. The expected result is `permission denied` because the
   authenticated role has neither INSERT privilege nor an INSERT policy.

To inspect only the badge notifications created for A:

```sql
select notification.type, notification.title, notification.body,
       notification.created_at, badge.slug
from public.notifications as notification
left join public.badges as badge
  on badge.id = notification.badge_id
join public.profiles as profile
  on profile.id = notification.recipient_id
where lower(profile.username) = lower('target_username')
  and notification.type = 'badge_assigned'
order by notification.created_at desc;
```
