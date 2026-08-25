# Varta

Varta is a university-only community app built with Expo, React Native, TypeScript, and Supabase. The current internal alpha includes authenticated student onboarding and verification, a campus feed, profiles, reporting and blocking, notifications, badges, organizations, official events, university-scoped Search/Explore, and persisted light/dark appearance settings.

## Current alpha scope

- Email/password authentication with persisted sessions
- Profile onboarding backed by live institute records
- Private student-ID verification with trusted admin approval
- Verified, same-university feed with posts, photos, likes, and comments
- Student profiles, badges, reporting, and blocking
- In-app and push-ready notifications
- Official organizations, follows, events, and event interest
- Search for students, organizations, and upcoming events
- Device-local recent searches and server-backed private feedback
- System, Light, and Dark appearance modes with device-local persistence
- Settings with real notification controls and blocked-user management

Post full-text search, public organization management, direct messaging, and production analytics are intentionally outside this milestone.

## Requirements

- Node.js and npm
- Expo Go or a compatible Expo development build
- A Supabase project and the Supabase CLI for schema work

## Local setup

1. Install dependencies:

   ~~~bash
   npm install
   ~~~

2. Copy .env.example to .env and set the hosted Supabase URL and publishable key:

   ~~~dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ~~~

   Only a publishable client key belongs in the mobile app. Never add a Supabase secret or service-role key.

3. Apply the committed migrations to the linked Supabase project:

   ~~~bash
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ~~~

4. Start Expo:

   ~~~bash
   npx expo start --clear
   ~~~

The display/product name is `Varta`; the in-app wordmark is `VĀRTĀ`. The Expo slug and URL scheme remain `campus` so existing development deep links and auth configuration continue to work. See [docs/branding-and-settings.md](docs/branding-and-settings.md) for the splash assets and final icon handoff.

## Development checks

Run these before each alpha checkpoint:

~~~bash
npm run typecheck
npx expo-doctor
npm run lint
~~~

For a production-style bundle check:

~~~bash
npx expo export --platform web
~~~

## Database and security model

All application tables use Row Level Security. Verified content is scoped to the signed-in student's university, with institute scoping where events require it. Media buckets are private; the app stores object paths and renders short-lived signed URLs. Verification documents are visible only to their owner, and the mobile role cannot approve a student.

Search runs in PostgreSQL through explicitly granted SECURITY INVOKER functions. It returns only public profile fields, respects the existing block visibility rule, and uses trigram indexes for contains matching. Feedback is insert-only for verified students: clients cannot read the queue. Notification preferences are self-owned RLS rows; trusted notification triggers check them before creating optional activity.

The generated database contract lives at src/types/database.ts. Regenerate it after public schema changes.

## Internal alpha operations

Use [docs/internal-alpha.md](docs/internal-alpha.md) for the release gate, tester walkthrough, RLS/storage audit, feedback review, and known constraints.

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

## Alpha auth note

Email confirmation is currently disabled in the hosted development project so Expo Go testers do not land on localhost. Before a broader external alpha, configure the production mobile callback, re-enable email confirmation, and enable leaked-password protection in Supabase Auth.
