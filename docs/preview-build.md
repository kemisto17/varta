# Varta Android preview build

This is the release-readiness gate for Varta `1.0.4` (Android versionCode `5`).
It prepares an internal APK; it does not publish to Google Play.

## Build identity and profiles

- Display name: `Varta`
- Visual brand: `VĀRTĀ`
- Expo slug and custom scheme: `varta`
- Android application ID: `com.kemisto17.varta`
- `development`: internal APK with `expo-dev-client` and developer tools
- `preview`: internal, production-like APK without developer tools
- `production`: Play Store AAB

The repository uses local app versioning. Increment `expo.version` when the
user-visible release changes and increment `expo.android.versionCode` for every
new Android release candidate. Never change the application ID for an ordinary
update.

## First EAS setup

From the repository root:

~~~bash
npx eas-cli@latest login
npx eas-cli@latest init
~~~

Link to the intended Expo account/project. This writes the real
`extra.eas.projectId` required by Expo push-token registration. Review that diff
before committing it; do not fabricate a project ID.

Local `.env` files are ignored and are not available to the remote build. Add
the two public client variables to the EAS preview environment:

~~~bash
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR_PROJECT_REF.supabase.co --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value YOUR_PUBLISHABLE_KEY --visibility plaintext
~~~

Repeat those commands with `--environment development` for a development build
and `--environment production` before a future store build. These values are
embedded in the client and are intentionally public. Never configure a database
password, secret/service-role key, or admin credential with an `EXPO_PUBLIC_`
name.

## Build commands

Installable internal preview APK:

~~~bash
npx eas-cli@latest build --platform android --profile preview
~~~

Development-client APK when native debugging is needed:

~~~bash
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client
~~~

Future Play Store AAB (documented only; do not submit during this milestone):

~~~bash
npx eas-cli@latest build --platform android --profile production
~~~

After a successful preview build, open the EAS build URL on the Android phone
and install the APK. Expo Go is not involved.

## Native branding gate

- The light splash is warm near-white with the black VĀRTĀ wordmark.
- The dark splash is near-black with the light VĀRTĀ wordmark.
- Splash images are transparent wordmark assets, separate from launcher icons.
- The configured launcher is the centered VĀ monogram on near-white. Its
  adaptive foreground is centered inside Android's mask-safe area.
- The full VĀRTĀ launcher alternative is retained, but at normal launcher size
  its letters are too short to read reliably. Check the configured fallback
  under circle, squircle, rounded-square, and Android themed-icon masks.

## Permissions gate

Varta uses network access and notifications. Android 13+ can show the native
notification permission prompt after the app creates its notification channel.
Photo selection uses the system picker; Varta does not request broad Android
storage access. Camera, microphone, legacy read/write storage, contacts, and
location are not required. Camera, microphone, and legacy storage permissions
are explicitly blocked in the Expo Android config.

Development builds can contain developer-only permissions that are not part of
the preview release. Review the final preview manifest/build details before
distribution.

## Deep links and email confirmation

Installed builds register the `varta` custom scheme. Authenticated, verified
testers can exercise routes such as:

- `varta://post/POST_UUID`
- `varta://event/EVENT_UUID`
- `varta://organization/ORGANIZATION_UUID`
- `varta://notifications`
- `varta://reset-password`

With Android platform tools available, a route can be opened with:

~~~bash
adb shell am start -a android.intent.action.VIEW -d "varta://notifications" com.kemisto17.varta
~~~

Post and event share actions use HTTPS links under
`https://kemisto17.github.io/varta/open/`. The Android manifest claims that
path as a verified App Link and Expo Router rewrites validated `type` and `id`
parameters to the existing post or event detail route. The browser fallback
attempts the `varta://open/` custom scheme, then sends users without an
installed app to Varta's Google Play listing. Only eligible accounts can see
and install a closed-test release.

Domain verification still requires the Play App Signing SHA-256 fingerprint
to be published at
`https://kemisto17.github.io/.well-known/assetlinks.json`. Follow
`docs/sharing-and-app-links.md`; the project site path
`/varta/.well-known/assetlinks.json` is not sufficient for Android host
verification.

Email confirmation remains disabled for this internal alpha. Before enabling
it, add the exact callback `varta://auth/callback` to Supabase Auth URL
Configuration and implement/test the callback session exchange. A broader
`varta://**` allow-list can be useful during development, but the production
allow-list should use exact paths. Do not enable confirmation until that route
is implemented, or email links will open an incomplete flow.

Password recovery requires the exact `varta://reset-password` callback in the
hosted project's Supabase Auth URL Configuration. Test recovery in an installed
development or preview build. Expo Go callback URLs are not stable enough for
an email authentication redirect allow-list.

## Push readiness

In-app notifications already use Supabase and Realtime. The installed build can
request notification permission, obtain an Expo push token using the linked EAS
project ID, store it in the user's RLS-protected `push_tokens` row, refresh a
rolled token, and route notification taps.

Remote delivery still needs the correct EAS/Android FCM credentials and trusted
server wiring to the `send-notification-push` Edge Function. If Expo push
access-token security is enabled, store `EXPO_ACCESS_TOKEN` only as a server-side
Edge Function secret. Never put FCM, Expo access, or Supabase service-role
credentials in the app.

## Real-device smoke test

Use a physical Android device and watch logs. Test both Light and Dark, System
appearance, a cold start, a warm start, portrait and landscape, gesture
navigation, and three-button navigation where available. Also check an Android
16 tablet or foldable emulator because the app no longer requests a fixed
portrait orientation.

1. Launch, register/login, close and reopen, then confirm the session persists.
2. Confirm there is no white flash, auth-route flash, stuck splash, or status-bar strip.
3. Accept the Terms of Use, restart twice to confirm the gate does not flash again, then check Campus/Latest switching, refresh, multi-page scrolling, text and image posts, events, active Lost & Found cards, Post Detail likes, comment replies, mentions, and fullscreen image controls.
4. Edit Profile and upload an avatar.
5. Open Explore student, organization, and event results; confirm signed organization images/fallbacks render, follow an organization, and mark an event Interested. Organization-image upload remains an admin workflow in this alpha and is not exposed to the mobile client.
6. Open Notifications, trigger an in-app notification, restart the app, and
   confirm Realtime reconnects without duplicate rows or subscription errors.
   Then test a background/cold-start push tap.
7. Upload an event cover and verification document through the roles/states that expose those controls.
8. Submit a report and feedback item.
9. Switch System/Light/Dark, restart after each choice, and confirm persistence and status-bar contrast.
10. Save posts from Home, profiles, organizations, and Post Detail; open Saved posts from Settings, paginate, refresh, like/open a saved post, and remove a bookmark.
11. Share a post and published event into Messages or another app. Open each HTTPS link with Varta installed, then uninstall Varta and confirm the same link reaches the Google Play test page. Confirm draft events have no share action.
12. Open every policy link in Settings, including Request account deletion; confirm the public pages load and the deletion flow clearly creates a support-reviewed request.
13. Logout, log in again, and confirm the theme preference remains device-local.

Check punch-hole/notch top insets, bottom gesture insets, the tab bar, Create
Post actions, comment composer, sheets, and fullscreen close control. The code
uses shared safe-area insets rather than device-specific padding, but only the
installed APK can validate the device/OEM behavior and binary Supabase uploads.

If a session expires, Varta should return to authentication through Supabase's
auth-state event. Record any unhandled promise rejection, React/navigation
warning, duplicate-key warning, image error, or Supabase error rather than
suppressing it.
