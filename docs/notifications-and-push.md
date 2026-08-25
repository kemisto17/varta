# Notifications and push foundation

## What works now

- In-app notifications are written by trusted Postgres triggers for likes,
  comments, verification decisions, public badge assignments, and event
  cancellations for interested students.
- The app loads 25 notifications at a time, tracks unread state, and listens to
  Realtime inserts filtered to the signed-in user.
- A physical-device development or release build can register multiple Expo
  push tokens per user. Tokens are never stored on `profiles`.
- Notification responses are observed after the verified session resolves.
  Post and event pushes open their detail screen; badge/approval pushes open
  Profile; an otherwise valid notification opens the notification center.
- `send-notification-push` is a service-role-only Edge Function that loads the
  notification and destination tokens on the server, then sends only
  type-allowlisted, non-sensitive copy to Expo.

In-app notifications continue to work in Expo Go. Remote push does not work in
Expo Go on current Expo SDKs, so no remote push claim should be made from an
Expo Go test.

## User preferences

`public.notification_preferences` stores self-owned controls for likes,
comments, public badges, and event cancellations. Its RLS policies permit only
the signed-in student to select, insert, or update that row; clients cannot
delete rows or change ownership. The trusted producer functions check the
matching preference before inserting a notification, so these are functional
controls rather than display-only switches.

Verification approved/rejected notifications remain enabled because they are
essential account messages. Organization updates are not shown in Settings
until a corresponding trusted producer exists. Push delivery is downstream of
the notification row, so disabled activity does not enter the delivery queue.

## Development build setup

The repository intentionally does not invent an EAS project ID or credentials.
Before testing remote push:

1. Link or create the correct EAS project with `npx eas-cli@latest init`. This
   writes the real `extra.eas.projectId` used by token registration.
2. Build the committed `development` profile. It uses `expo-dev-client`, the
   `development` EAS environment, and an installable Android APK.
3. Configure APNs/FCM credentials through EAS, then install the development
   build on a physical device.
4. Open Varta as a verified user and grant notification permission. The app
   registers the Expo token in `public.push_tokens` and refreshes it if the
   native token rolls while the app is active.

The registration path exits before importing `expo-notifications` in Expo Go,
on web, on emulators, or before an EAS project ID exists. This keeps existing
Expo Go development stable.

The preview APK uses the same response-routing code without development tools.
Cold-start and background notification taps still require a physical-device
test after the EAS project ID and Android push credentials exist.

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

Event cancellation notifications follow the same trusted pattern. A unique
partial index permits one cancellation notification per recipient and event,
and `event_id` provides the in-app and future push deep-link target.

## Privileged badge assignment

Students have no insert/update/delete grant on `badges` or `profile_badges`.
Public assignments generate notifications; `owner_only` assignments do not.
Use the exact lookup, assignment, removal, listing, and acceptance-test SQL in
[`profile-badges-admin.md`](./profile-badges-admin.md).
