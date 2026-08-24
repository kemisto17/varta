# Notifications and push foundation

## What works now

- In-app notifications are written by trusted Postgres triggers for likes,
  comments, verification decisions, and public badge assignments.
- The app loads 25 notifications at a time, tracks unread state, and listens to
  Realtime inserts filtered to the signed-in user.
- A physical-device development or release build can register multiple Expo
  push tokens per user. Tokens are never stored on `profiles`.
- `send-notification-push` is a service-role-only Edge Function that loads the
  notification and destination tokens on the server, then sends only
  type-allowlisted, non-sensitive copy to Expo.

In-app notifications continue to work in Expo Go. Remote push does not work in
Expo Go on current Expo SDKs, so no remote push claim should be made from an
Expo Go test.

## Development build setup

The repository intentionally does not invent an EAS project ID or credentials.
Before testing remote push:

1. Link or create the correct EAS project with `npx eas-cli@latest init`. This
   writes the real `extra.eas.projectId` used by token registration.
2. Install/configure an Expo development client and create an `eas.json`
   development profile for the intended Android or iOS app identifier.
3. Configure APNs/FCM credentials through EAS, then install the development
   build on a physical device.
4. Open Varta as a verified user and grant notification permission. The app
   registers the Expo token in `public.push_tokens` and refreshes it if the
   native token rolls while the app is active.

The registration path exits before importing `expo-notifications` in Expo Go,
on web, on emulators, or before an EAS project ID exists. This keeps existing
Expo Go development stable.

## Trusted delivery wiring still required

The Edge Function is deployed with JWT verification and also rejects every
caller whose verified JWT role is not `service_role`. Student devices must
never invoke it and must never receive the service-role key.

For production, connect notification inserts to the function from trusted
infrastructure—for example a Supabase Database Webhook or `pg_net` call whose
authorization secret is stored in Vault. Pass only:

```json
{
  "notificationId": "<new-notification-uuid>"
}
```

Also add Expo push receipt processing so tokens reported as
`DeviceNotRegistered` are removed. Configure `EXPO_ACCESS_TOKEN` as an Edge
Function secret if Expo push access-token security is enabled.

## Like duplicate policy

A unique partial index allows only one historical like notification per
recipient, actor, and post. Removing a like leaves the notification in history;
liking the same post again does not create another notification.

## Privileged public-badge assignment

Students have no insert/update/delete grant on `badges` or `profile_badges`.
An owner can create and assign a public badge through privileged SQL. The
assignment trigger sends a notification only when `badges.is_public` is true.
Private labels produce no notification.

```sql
insert into public.badges (name, description, is_public)
values ('Coordinator', 'Campus community coordinator', true)
on conflict (name) do update
set description = excluded.description,
    is_public = excluded.is_public;

insert into public.profile_badges (user_id, badge_id)
select '<student-profile-uuid>', badge.id
from public.badges as badge
where badge.name = 'Coordinator'
on conflict (user_id, badge_id) do nothing;
```
