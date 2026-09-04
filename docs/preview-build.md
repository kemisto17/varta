# Varta Android preview build

This is the release-readiness gate for Varta `0.1.0` (Android versionCode `1`).
It prepares an internal APK; it does not publish to Google Play.

## Build identity and profiles

- Display name: `Varta`
- Visual brand: `VĀRTĀ`
- Expo slug and custom scheme: `varta`
- Android application ID: `com.kemisto17.varta`
- `development`: internal APK with `expo-dev-client` and developer tools
- `preview`: internal, production-like APK without developer tools
- `production`: future Play Store AAB

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
appearance, a cold start, a warm start, gesture navigation, and three-button
navigation where available.

1. Launch, register/login, close and reopen, then confirm the session persists.
2. Confirm there is no white flash, auth-route flash, stuck splash, or status-bar strip.
3. Check Home feed, text post, image post, Post Detail like/comment, and fullscreen image controls.
4. Edit Profile and upload an avatar.
5. Open Explore student, organization, and event results; confirm signed organization images/fallbacks render, follow an organization, and mark an event Interested. Organization-image upload remains an admin workflow in this alpha and is not exposed to the mobile client.
6. Open Notifications and test a background/cold-start push tap.
7. Upload an event cover and verification document through the roles/states that expose those controls.
8. Submit a report and feedback item.
9. Switch System/Light/Dark, restart after each choice, and confirm persistence and status-bar contrast.
10. Logout, log in again, and confirm the theme preference remains device-local.

Check punch-hole/notch top insets, bottom gesture insets, the tab bar, Create
Post actions, comment composer, sheets, and fullscreen close control. The code
uses shared safe-area insets rather than device-specific padding, but only the
installed APK can validate the device/OEM behavior and binary Supabase uploads.

If a session expires, Varta should return to authentication through Supabase's
auth-state event. Record any unhandled promise rejection, React/navigation
warning, duplicate-key warning, image error, or Supabase error rather than
suppressing it.
