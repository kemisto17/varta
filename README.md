# Varta

Varta is a campus community app for verified university students. The Android
app is currently distributed through Google Play testing; it is not presented
as generally available.

## Why Varta

Campus conversations, organization updates, and events are often scattered across unrelated channels. Varta brings them into a university-scoped community where student access can be verified.

Varta is an independent student project. It is not an official application of, endorsed by, or operated by any university.

## Current features

- Email/password authentication, persisted sessions, and password recovery
- Profile onboarding backed by live institute records
- Private student-ID verification with trusted admin approval
- Unified same-university Home feed with ranked Campus and chronological Latest modes
- Posts, events, and active Lost & Found items rendered through one paginated feed
- Editable posts, photos, likes, threaded comment replies, mentions, and mention notifications
- Lost & Found posts with an open-item feed, campus location, and resolution state
- Post image cropping with original, square, portrait, and landscape options
- Student profiles, badges, reporting, and blocking
- In-app and push notifications
- Official organizations, follows, events, and event interest
- Search for students, organizations, and upcoming events
- Device-local recent searches and server-backed private feedback
- System, Light, and Dark appearance modes with device-local persistence
- Settings with notification controls, blocked-user management, policy links, and account-deletion requests

## Screenshots

Screenshots are not yet included in the repository. Release screenshots can be added here after the Google Play testing assets are finalized.

## Requirements

- Node.js and npm
- Expo Go or a compatible Expo development build
- An Expo account for EAS development, preview, or production builds
- A Supabase project and the Supabase CLI for schema work

## Local setup

1. Install dependencies:

   ~~~bash
   npm install
   ~~~

2. Copy `.env.example` to `.env` and set the client configuration:

   ~~~dotenv
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   EXPO_PUBLIC_MEDIA_BASE_URL=
   ~~~

   Only a Supabase publishable client key belongs in the mobile app. Never add a Supabase secret/service-role key, R2 credential, signing key, or Play credential. The committed `google-services.json` contains Android Firebase client configuration only; Firebase Admin credentials must never be added.

3. For a separate development Supabase project, review the committed migrations before linking and applying them:

   ~~~bash
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ~~~

   Do not run schema commands against production without reviewing the migration plan and target project.

4. Start Expo:

   ~~~bash
   npx expo start --clear
   ~~~

The display/product name is `Varta`; the in-app wordmark is `VĀRTĀ`. The Expo slug and installed-app URL scheme are both `varta`, and the Android application ID is `com.kemisto17.varta`. See [docs/branding-and-settings.md](docs/branding-and-settings.md) for the splash and launcher assets.

## Development and Android builds

Expo Go remains useful for fast JavaScript/UI work, but it does not show Varta's
launcher icon or faithfully exercise native startup and remote push. Use the
target that matches the test:

| Target | Purpose | Command |
| --- | --- | --- |
| Expo Go | Fast local UI and Supabase work with Expo Go limitations | `npx expo start --clear` |
| Development build | Varta's native shell plus developer tools | `npx eas-cli@latest build --platform android --profile development`, then `npx expo start --dev-client` |
| Preview APK | Production-like, directly installable testing build | `npx eas-cli@latest build --platform android --profile preview` |
| Production AAB | Google Play upload; not directly installable | `npx eas-cli@latest build --platform android --profile production` |
| Local production AAB | Android Studio signed bundle using the existing upload key | Generate `android` with `npx expo prebuild --platform android`, then use Android Studio's signed-bundle flow |

Before a cloud build, sign in and confirm that the repository is linked to the
intended EAS project:

~~~bash
npx eas-cli@latest login
npx eas-cli@latest project:info
~~~

Only run `eas init` when intentionally linking or re-linking the project. Configure
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
`EXPO_PUBLIC_MEDIA_BASE_URL` in the appropriate EAS environment before building.
These are public mobile-client configuration, not server credentials. Never add
a database password, service-role key, R2 credential, signing key, or admin
credential. Build artifacts must not be committed. The exact setup and
real-device gate are in [docs/preview-build.md](docs/preview-build.md).

## Development checks

Run these before each release checkpoint:

~~~bash
npm run typecheck
npx expo-doctor
npm run lint
~~~

For a production-style bundle check:

~~~bash
npx expo export --platform web
~~~

## Architecture and tech stack

Varta uses Expo SDK 57, Expo Router, React Native 0.86, React 19, and TypeScript 6 for the mobile client. Supabase provides Auth, Postgres, Row Level Security, private Storage, and Edge Functions. Expo Notifications uses Firebase client configuration on Android, and EAS Build produces APK testing builds and AAB Google Play builds.

All application tables use Row Level Security. Verified content is scoped to the signed-in student's university, with institute scoping where events require it. Verification documents remain in private Supabase Storage and are not public profile content.

Ordinary social media—including post images, student and organization avatars, and event covers—is stored as object keys and delivered through Cloudflare R2. R2 upload and deletion credentials stay server-side; authenticated Edge Functions authorize media mutations. Legacy Supabase media paths remain supported while media is migrated.

Search runs in PostgreSQL through explicitly granted SECURITY INVOKER functions. It returns only public profile fields, respects the existing block visibility rule, and uses trigram indexes for contains matching. Feedback is insert-only for verified students: clients cannot read the queue. Notification preferences are self-owned RLS rows; trusted notification triggers check them before creating optional activity.

The generated database contract lives at src/types/database.ts. Regenerate it after public schema changes.

## Project documentation

Use [docs/internal-alpha.md](docs/internal-alpha.md) for the tester walkthrough, RLS/storage audit, feedback review, and known constraints.

Trusted admin workflows are documented separately:

- [Student verification](docs/development-student-verification.md)
- [Organizations and campus events](docs/campus-events.md)
- [Moderation](docs/moderation-workflow.md)
- [Badges](docs/profile-badges-admin.md)
- [Notifications and push](docs/notifications-and-push.md)
- [Branding and settings](docs/branding-and-settings.md)

## Project layout

- src/app — Expo Router screens and protected navigation
- src/components — shared UI
- src/lib — typed Supabase and device-service modules
- src/providers — theme, auth, profile, verification, feed, and notification state
- src/types — application and generated database types
- supabase/migrations — reviewed schema, RLS, grants, indexes, and storage policies
- supabase/functions — trusted server-side functions
- docs — GitHub Pages legal documents and operational notes

## Legal and safety

- [Privacy Policy](https://kemisto17.github.io/varta/privacy-policy/)
- [Terms of Use](https://kemisto17.github.io/varta/terms/)
- [Account Deletion](https://kemisto17.github.io/varta/account-deletion/)
- [Child Safety Standards](https://kemisto17.github.io/varta/child-safety/)

## Release status

- Current source release: V1.0.3
- Expo/package version: `1.0.3`
- Android package: `com.kemisto17.varta`
- Android version code: `4`
- Distribution status: Google Play testing; not generally available
- Production build format: AAB

This repository does not include Play Store binaries or signing credentials. GitHub releases and Play uploads are created separately.

## License

Varta is source-available for educational and non-commercial review.

Commercial use, redistribution, public cloning, and derivative competing
services are not permitted without prior written permission.

Varta / VĀRTĀ branding and visual assets are proprietary.
See the LICENSE file for details.
