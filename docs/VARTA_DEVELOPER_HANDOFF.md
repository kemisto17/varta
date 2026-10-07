# Varta — Developer Handoff

> Master technical guide for developers working on the existing Varta application.
>
> **Important:** This document describes the repository as inspected at the current source revision. It distinguishes **CURRENT** implementation from **PLANNED / NOT IMPLEMENTED** work. Do not treat the roadmap as existing functionality.

## 1. Product in one sentence

Varta is a university-scoped campus community app for verified students, centered on campus posts, official organizations, events, Lost & Found, discovery, notifications, and student profiles.

Varta is **not** an official university application. It is an independent student project.

## 2. Product principles

1. **Community-first.** The product is about useful campus information, not follower popularity.
2. **University-scoped.** Verified students primarily see content belonging to their university; some content is further scoped to an institute.
3. **Organizations are first-class.** Official organizations publish posts/events and students can follow organizations.
4. **Student verification is separate from the public profile.** Enrollment numbers and ID documents are private verification data.
5. **Security belongs on the server.** Client checks are UX only; Supabase RLS, database constraints, trusted functions, and Edge Functions enforce authorization.
6. **Do not expose private verification data.** Never return enrollment numbers, verification documents, private auth metadata, or phone numbers to ordinary users.
7. **Do not weaken RLS to make UI code work.**
8. **Inspect existing code before changing architecture.** Varta has many incremental migrations and security hardening migrations.

## 3. Current technology stack

### Mobile

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript 6
- Expo Router
- Expo Notifications
- Expo Image / Image Picker / Image Manipulator
- Expo SQLite for local recent-search storage
- React Native Reanimated
- React Native Safe Area Context

### Backend

- Supabase Auth
- Supabase PostgreSQL
- PostgreSQL Row Level Security
- Supabase Realtime
- Supabase Edge Functions
- Supabase private Storage for sensitive verification documents and some legacy media
- Cloudflare R2 for ordinary social media

### Build / distribution

- EAS Build
- Android package: `com.kemisto17.varta`
- URL scheme: `varta`
- Google Play distribution
- Current source/package version: 1.0.4
- Android versionCode: 5

## 4. High-level architecture

```
React Native / Expo Router
        |
        +--> AuthProvider
        +--> ProfileProvider
        +--> VerificationProvider
        +--> FeedProvider
        +--> NotificationsProvider
        +--> SavedPostsProvider
        +--> ThemeProvider
        |
        +--> src/lib/*
        |      |
        |      +--> Supabase client
        |      +--> database queries / RPCs
        |      +--> media upload helpers
        |      +--> notifications
        |      +--> feed
        |      +--> moderation
        |      +--> events / organizations / Lost & Found
        |
        +----------------------+
                               |
                         Supabase
                    Auth + Postgres + RLS
                         |          |
                         |          +--> Realtime
                         |
                         +--> Edge Functions
                                  |
                                  +--> Cloudflare R2
                                  +--> Expo Push

Cloudflare R2
  ordinary media:
  avatars / post images / event covers / Lost & Found images
```

## 5. Repository layout

```
src/app/              Expo Router screens/routes
src/components/       Shared UI components
src/constants/        Theme and policy constants
src/contexts/         React context contracts
src/hooks/             Consumer hooks
src/lib/              Data/service/business-logic modules
src/providers/        Context providers and state orchestration
src/types/            App types + generated database types
supabase/migrations/  Database schema, RLS, functions, indexes, triggers
supabase/functions/   Trusted Edge Functions
docs/                 Operational, legal, build and admin documentation
assets/               App branding/assets
```

### Important rule

Do not create a new service layer or duplicate an existing module just because a feature is new. First search for the closest existing module in `src/lib`, `src/hooks`, `src/providers`, and `supabase/migrations`.

## 6. Route map

### Authentication

- `src/app/(auth)/welcome.tsx`
- `src/app/(auth)/login.tsx`
- `src/app/(auth)/register.tsx`
- `src/app/(auth)/forgot-password.tsx`
- `src/app/reset-password.tsx`

Current authentication is email/password with persisted Supabase sessions and password recovery.

### Onboarding

- `src/app/(onboarding)/setup-profile.tsx`
- `src/app/(onboarding)/student-verification.tsx`
- `src/app/(onboarding)/verification-pending.tsx`
- `src/app/(onboarding)/verification-rejected.tsx`

A signed-in account must have a profile and a verified student verification before normal campus tabs are available.

### Main tabs

- `src/app/(tabs)/index.tsx` — Home
- `src/app/(tabs)/explore.tsx` — discovery/search
- `src/app/(tabs)/create.tsx` — create selector
- `src/app/(tabs)/profile.tsx` — current profile

### Posts

- `src/app/create-post.tsx`
- `src/app/post/[id].tsx`
- `src/app/post/[id]/edit.tsx`
- `src/app/saved-posts.tsx`

### Events

- `src/app/events.tsx`
- `src/app/event/[id].tsx`
- `src/app/event/[id]/edit.tsx`
- `src/app/organization/[id]/create-event.tsx`

### Organizations

- `src/app/organization/[id].tsx`
- `src/app/organization/[id]/manage.tsx`
- `src/app/organization/[id]/edit-profile.tsx`
- `src/app/following.tsx`

### Lost & Found

- `src/app/lost-found/index.tsx`
- `src/app/lost-found/create.tsx`
- `src/app/lost-found/[id].tsx`
- `src/app/lost-found/[id]/edit.tsx`

### User / moderation / settings

- `src/app/user/[id].tsx`
- `src/app/blocked-users.tsx`
- `src/app/notifications.tsx`
- `src/app/feedback.tsx`
- `src/app/settings.tsx`
- `src/app/edit-profile.tsx`

### Deep links

- `src/app/+native-intent.ts`
- `docs/open/index.html`
- `docs/sharing-and-app-links.md`

The production HTTPS sharing route is under:

`https://kemisto17.github.io/varta/open`

Android App Links are configured for that host/path, while the custom app scheme is `varta://`.

## 7. App bootstrap and navigation

`src/app/_layout.tsx` is the main application gate.

The root layout wires:

- AuthProvider
- ThemeProvider
- ProfileProvider
- VerificationProvider
- FeedProvider
- NotificationsProvider
- SavedPostsProvider

The navigation state is determined from:

1. Supabase auth session
2. profile state
3. verification state

Conceptually:

```
No session
  -> auth screens

Session + no profile
  -> profile setup

Profile + verification missing/pending/rejected
  -> verification flow

Profile + verified verification
  -> normal tabs/app
```

A verification failure has its own retry state. Do not bypass this gate from a screen-level client check.

## 8. Authentication model

Supabase Auth owns authentication identity.

The public `profiles.id` is the same UUID as `auth.users.id`.

Current authentication:

- email/password sign-up
- login
- persisted session
- password reset/recovery
- sign-out

The mobile app must never contain:

- Supabase service-role key
- database password
- R2 access key
- R2 secret
- signing credentials
- admin credentials

Only the Supabase publishable client configuration belongs in the Expo environment.

## 9. Student profile model

Core profile fields include:

- `id`
- `institute_id`
- `username`
- `full_name`
- `branch`
- `year`
- `bio`
- `avatar_path`
- timestamps

Profile data is public only within the security boundary allowed by RLS.

Verified students can discover other eligible students in their university.

Private verification data is deliberately stored separately in `student_verifications`.

## 10. Student verification

### Current implementation

`public.student_verifications` contains:

- `user_id`
- `university_id`
- `enrollment_number`
- `id_document_path`
- `method`
- `status`
- `rejection_reason`
- `submitted_at`
- `reviewed_at`
- `reviewer_id`

Current verification statuses:

- `pending`
- `verified`
- `rejected`

Current methods include:

- `student_id`
- `admin`
- `ambassador`
- `college_email`

There is a uniqueness constraint on:

`university_id + enrollment_number`

The ID document lives in the private `verification-documents` bucket.

### Critical security rule

The mobile client can submit a verification request but cannot decide that it is verified.

Approval is performed by trusted administrative tooling / SQL according to the existing workflow.

Do not add a client-side `isVerified = true` path.

### Important limitation

The existing ID-based verification is evidence of student identity, not cryptographic proof that the person holding the ID is the actual student. A stolen ID can still be abused.

### NOT CURRENTLY IMPLEMENTED

The following are future Trust & Safety work, not current Varta behavior:

- mandatory phone OTP
- unique verified-phone binding
- phone change/recovery workflow
- identity-claim security alerts
- identity claim history
- sophisticated duplicate-account detection
- device-risk correlation
- liveness/facial verification
- university SSO
- official university roster integration

Do not document these as existing features unless implemented.

## 11. Database structure

The schema has evolved through many migrations. Treat the migration history as authoritative.

Major current concepts include:

### University / identity

- `universities`
- `institutes`
- `profiles`
- `student_verifications`

### Social

- `posts`
- `comments`
- `post_likes`
- `post_saves`
- comment reply/mention support
- profile links

### Organizations

- `organizations`
- `organization_members`
- `organization_follows`
- organization posts
- organization media

### Events

- `events`
- `event_interests`

### Lost & Found

- `lost_found_items`
- supporting Lost & Found fields/relationships

### Notifications

- `notifications`
- `push_tokens`
- `notification_preferences`

### Moderation / safety

- `reports`
- `user_blocks`

### Product/support

- `feedback`
- terms acceptance
- badges
- profile badges

### Generated contract

`src/types/database.ts` is the generated database type contract.

After public schema changes, regenerate the database types instead of manually guessing types.

## 12. University and institute scoping

A profile belongs to an institute.

An institute belongs to a university.

Most social visibility is based on university:

```
profile
  -> institute
      -> university
```

Existing private helper functions include concepts such as:

- current institute
- current university
- current verified-user state
- post-is-in-current-university
- profile-is-in-current-university

These helpers are used by RLS and should be preferred over repeating authorization logic in the client.

## 13. Row Level Security

All application tables are intended to be protected by RLS.

Important rules:

- A user can manage their own profile.
- Unverified users can still access the onboarding data needed to finish verification.
- Verified students can access eligible same-university social data.
- Student verification records are private.
- Reports are insert-only for ordinary clients; the moderation queue is not exposed to normal users.
- Feedback is insert-only for verified users; clients cannot list the feedback queue.
- User blocks are private to the signed-in user.
- Notification preferences are self-owned.
- Organization membership is privileged.
- Organization/event management is role-based.
- Search uses explicit server-side functions and limited public fields.

### Never do this

Do not solve an RLS error by changing a policy to:

`using (true)`

or by granting a table to the client without understanding the entire visibility model.

## 14. Posts

Posts support:

- text
- optional image
- likes
- comments
- comment replies
- mentions
- private saves/bookmarks
- editing
- deletion
- sharing/deep links
- reporting
- blocking

Post content is capped by database constraints.

A post must contain either non-empty content or media.

### Media ownership

The post stores an object path/key rather than a public binary.

Current R2 user-post key pattern:

`posts/users/<userId>/<uuid>.<extension>`

Organization post media:

`posts/organizations/<organizationId>/<userId>/<uuid>.<extension>`

Do not manually construct arbitrary keys in the UI if an existing media helper already handles this.

## 15. Media upload architecture

Current ordinary media uploads use a trusted Supabase Edge Function:

`supabase/functions/create-media-upload/index.ts`

The mobile app requests a short-lived signed R2 PUT URL.

The server:

1. authenticates the Supabase access token;
2. checks that the account is a verified student;
3. validates content type;
4. validates exact file size;
5. checks organization/event permissions when applicable;
6. creates the R2 object key;
7. signs the upload request.

Supported image types currently include JPEG, PNG, WebP, HEIC and HEIF.

Current size limits:

- post / Lost & Found / event image: up to 8 MB
- avatar / organization avatar: up to 5 MB

The signed URL is short-lived.

### R2 key layout

```
avatars/users/<uid>/<uuid>.jpg
avatars/organizations/<orgId>/<uuid>.jpg

posts/users/<uid>/<uuid>.jpg
posts/organizations/<orgId>/<uid>/<uuid>.jpg

events/organizations/<orgId>/<eventId>/<uuid>.jpg

lost-found/users/<uid>/<uuid>.jpg
```

The exact extension is based on the allowed MIME type.

### Critical Expo upload detail

The project historically had an Expo `file://` upload problem.

The existing implementation intentionally uses the legacy Expo FileSystem API in the relevant R2 client path. Do not replace it with a generic `fetch(file://...)` implementation without testing the actual Android upload flow.

### Deletion

`supabase/functions/delete-media-object/index.ts` handles trusted media deletion.

Do not give the client R2 credentials.

## 16. Media privacy

Ordinary media is not treated like verification documents.

Verification documents:

- private Supabase Storage
- owner/admin-controlled access
- never public profile content

Social media:

- R2 object keys
- delivered through the Varta media access layer
- access/authorization is controlled server-side

Do not log:

- signed URLs
- local image URIs
- storage credentials
- verification document paths
- private auth metadata

## 17. Image editing

Relevant modules:

- `src/components/posts/ImageCropperModal.tsx`
- `src/components/posts/PostImageField.tsx`
- `src/lib/imagePicker.ts`
- `src/lib/imageOptimization.ts`

Posts support crop/resize workflows for original, square, portrait and landscape presentation.

Preserve the existing picker/crop/upload pipeline when changing media behavior.

## 18. Home feed

Home Feed V2 is implemented server-side through the feed RPC migration and client feed modules.

Relevant code:

- `src/lib/feed.ts`
- `src/hooks/useFeed.ts`
- `src/providers/FeedProvider.tsx`
- `src/components/feed/FeedItemRenderer.tsx`
- `src/app/(tabs)/index.tsx`
- `supabase/migrations/20260904105114_add_home_feed_v2_rpc.sql`
- `supabase/migrations/20260904145956_stabilize_home_feed_pagination.sql`

The feed combines campus content into a common feed model.

Current feed concepts include:

- Campus mode
- Latest mode
- posts
- events
- Lost & Found items

Feed behavior is server-driven and paginated.

Do not rebuild feed ranking in React Native.

### Feed requirements when modifying it

Preserve:

- university/institute visibility
- block visibility
- stable cursor pagination
- bounded page size
- correct ordering
- batched counts
- deleted-target handling
- loading/refresh/error/empty states

## 19. Explore and search

Relevant code:

- `src/app/(tabs)/explore.tsx`
- `src/lib/search.ts`
- `src/types/search.ts`

Search supports discovery of:

- students
- organizations
- upcoming events

Search is PostgreSQL-backed.

It uses explicit server-side functions and trigram indexes for contains matching.

It intentionally does not download thousands of profiles/events to the client.

Recent search history is device-local and not stored in Supabase.

The client normalizes the query and does not call the search path for an unusably short query.

### Search privacy

Student search returns only public/allowed fields.

Never add:

- email
- enrollment number
- verification document path
- auth metadata
- private phone data

to a search response.

## 20. Organizations

Organizations are official campus entities.

Important organization concepts:

- university ownership
- active/inactive state
- verified organization state
- organization members
- roles
- follows
- organization posts
- organization events

Current management roles:

- owner
- admin
- editor

Role behavior:

- owner/admin can manage all organization events
- editor can manage only events they created
- ordinary students cannot create official organization events

Organization membership and organization records are trusted administrative data.

The mobile client must not be able to promote itself to owner/admin/editor.

## 21. Organization following

Varta intentionally supports organization following.

The product direction does **not** use student-to-student following as the primary social graph.

There is historical migration work around profile follows, followed by removal of student profile follows. Do not reintroduce student following merely because an old migration contains `profile_follows`.

When implementing social discovery, use organization following and the current feed model.

## 22. Events

Events are structured official organization content.

Important fields include:

- organization
- university
- optional institute
- title/details
- start/end
- location
- publication state
- cover image
- interest count
- external registration link where applicable

Visibility:

- university-wide published events are visible to verified students at that university;
- institute-specific events are limited to the relevant institute;
- drafts are visible to authorized organization managers;
- cancelled/completed events are not treated as active discovery content.

`event_interests` is an interest/save signal, not event registration.

Do not call event interest "registration" in UI unless the event has an actual external registration system.

## 23. Lost & Found

Lost & Found is a separate structured module.

Relevant code:

- `src/app/lost-found/*`
- `src/components/lost-found/*`
- `src/lib/lostFound.ts`
- `src/types/lostFound.ts`
- Lost & Found migrations in `supabase/migrations/`

Items are campus-scoped and have a resolution/state lifecycle.

Lost & Found images use R2 and the `lost-found/users/<uid>/...` key namespace.

Do not mix Lost & Found objects into generic post logic unless the existing module explicitly does so.

## 24. Comments, replies and mentions

Comments support:

- top-level comments
- replies
- editing
- deletion
- mentions
- mention notifications

Relevant modules:

- `src/lib/mentions.ts`
- `src/lib/mentionText.ts`
- `src/components/MentionInput.tsx`

The mention migration adds reply/mention support and dedicated notification behavior.

When changing comments, preserve the existing cursor pagination and notification cleanup behavior.

## 25. Likes and saved posts

Likes use a composite relationship between post and user.

Saved posts are private.

Relevant code:

- `src/lib/postInteractions.ts`
- `src/lib/savedPosts.ts`
- `src/hooks/useSavedPosts.ts`
- `src/providers/SavedPostsProvider.tsx`
- `src/app/saved-posts.tsx`

A user's saved posts must never become a public social signal unless explicitly redesigned.

## 26. Blocking

Blocking is a privacy boundary, not merely a UI preference.

Relevant code:

- `src/components/moderation/BlockUserSheet.tsx`
- `src/app/blocked-users.tsx`
- `src/lib/moderation.ts`
- block-related Supabase migrations

The database has hardening around bidirectional block privacy and hiding blocked social activity.

When adding a new query that returns users/posts/comments/search results, explicitly consider whether blocked relationships must be filtered.

Do not assume an existing screen's RLS automatically protects a newly created RPC.

## 27. Reporting / moderation

Relevant code:

- `src/components/moderation/ReportSheet.tsx`
- `src/lib/moderation.ts`
- `docs/moderation-workflow.md`

Current reports can target supported content/profile types and contain a reason/details.

The report stores an immutable `target_id` so that the moderation record can still identify what was reported after the live target is deleted.

Normal users can submit reports.

Normal users cannot read the moderation queue.

### Current moderator model

There is intentionally no moderator dashboard/elevated credential flow in the mobile client.

Trusted moderation is currently performed from a privileged Supabase/admin context.

This is a deliberate security boundary.

## 28. Current moderation limitation

Current Varta has reporting and manual moderation workflow, but it does **not** yet have the full Trust & Safety system planned for future abuse prevention.

Not currently implemented as a complete system:

- automatic media NSFW moderation
- quarantine/promotion media lifecycle
- automated strikes
- temporary restrictions
- permanent ban state model
- phone accountability
- identity claim history
- identity theft alerts
- automated duplicate identity detection
- advanced fraud signals
- moderator UI

Do not build client assumptions around these until the database/server design is actually added.

## 29. Notifications

Relevant code:

- `src/lib/notifications.ts`
- `src/lib/pushNotifications.ts`
- `src/lib/notificationRouting.ts`
- `src/lib/notificationPreferences.ts`
- `src/providers/NotificationsProvider.tsx`
- `src/app/notifications.tsx`
- `supabase/functions/send-notification-push/index.ts`

In-app notifications are created by trusted database triggers / server-side logic for supported activities.

The app:

- loads notifications in bounded pages;
- tracks unread state;
- listens for Realtime inserts;
- routes notification taps to appropriate detail screens.

Current notification categories include activity such as:

- likes
- comments
- follows where supported
- verification decisions
- badges
- event cancellations
- mentions

Preferences can disable optional activity notifications.

Essential account/verification notifications are intentionally treated differently.

## 30. Push notifications

Push uses Expo Notifications.

Push tokens live in `public.push_tokens`, not on `profiles`.

A user may have multiple device tokens.

Remote push requires an installed development/release build and appropriate Expo/Firebase credentials.

Expo Go should not be treated as a valid test of remote push delivery on current Expo SDKs.

The `send-notification-push` Edge Function is service-role-only and resolves the notification and destination tokens server-side.

Never let the mobile client directly send arbitrary push messages.

## 31. Terms acceptance

Varta has a current-terms acceptance mechanism.

Publishing/editing content is protected by database policy requiring current terms acceptance.

When adding a new publishable content table, check whether the current terms policy must cover it.

Do not implement terms acceptance as a purely client-side checkbox.

## 32. Account deletion

The Settings UI provides an account deletion request path.

Automatic full deletion is not currently implemented as a single client operation.

Operational instructions live in:

`docs/account-deletion-operations.md`

Treat account deletion as a support/admin workflow unless the backend implementation is explicitly changed.

Do not tell users deletion is instantaneous if the current backend does not perform it.

## 33. Feedback

`src/app/feedback.tsx` and `src/lib/feedback.ts` implement verified-user feedback submission.

Feedback is intended to be insert-only from the app.

The client cannot list the feedback queue.

Admins review feedback through a trusted context.

## 34. Badges

Varta has profile badges.

Relevant code:

- `src/components/badges/*`
- `src/lib/badges.ts`
- `src/types/badge.ts`
- profile badge migrations

Badges are trusted account/profile metadata.

Do not allow a client to assign itself a privileged badge.

## 35. Appearance / theme

Varta supports:

- System
- Light
- Dark

Theme state is device-local.

Relevant code:

- `src/providers/ThemeProvider.tsx`
- `src/hooks/useTheme.ts`
- `src/constants/theme.ts`
- `src/app/settings.tsx`

Preserve theme behavior across auth/onboarding/app screens.

## 36. Configuration

Committed client environment template:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_MEDIA_BASE_URL=
```

These are client configuration values.

Never place secrets in `EXPO_PUBLIC_*`.

Server-side Edge Functions use their own protected environment variables for:

- Supabase server credentials
- R2 credentials
- signing configuration
- push service credentials

## 37. Build profiles

EAS profiles are defined in `eas.json`.

Common targets:

- Expo Go for fast JS/UI work
- development build for native testing
- preview APK for production-like testing
- production AAB for Play Store

Commands documented by the repo include:

```bash
npm install

npx expo start --clear

npx eas-cli@latest build --platform android --profile development

npx expo start --dev-client

npx eas-cli@latest build --platform android --profile preview

npx eas-cli@latest build --platform android --profile production
```

Before a release checkpoint:

```bash
npm run typecheck
npx expo-doctor
npm run lint
npx expo export --platform web
```

## 38. Deep-link / sharing architecture

The app supports shareable HTTPS links.

Production web/share host:

`kemisto17.github.io/varta/open`

Android intent filtering is configured in `app.json`.

Supported content links include post/event-style deep links through the existing routing layer.

When adding a new shareable entity:

1. define a stable public identifier;
2. update the web/open page;
3. update native intent parsing;
4. update app route handling;
5. test installed-app and uninstalled-app behavior;
6. test deleted/missing targets.

Do not expose private data through share links.

## 39. Current public media vs verification media

### Public/normal media

- profile avatars
- organization avatars
- post images
- event covers
- Lost & Found images

These are ordinary product media and use R2/object-key infrastructure.

### Sensitive verification media

- student ID documents

These remain in private Supabase Storage.

Never reuse public media access logic for verification documents.

## 40. Planned Trust & Safety architecture

This is roadmap, not current implementation.

The preferred future identity chain is:

```
Varta account
  -> verified email
  -> verified phone
  -> university + enrollment
  -> verification evidence
  -> audit history
```

Phone proves control of a phone number; it does not prove student identity.

Enrollment + university identify the claimed student record.

Student ID/admin review is identity evidence.

A device identifier may be used as a narrow risk signal, but should not be treated as identity proof.

Avoid collecting invasive identifiers such as IMEI, IMSI, SIM serial, MAC address, contacts, unnecessary GPS, or permanent hardware fingerprints.

## 41. Planned media moderation architecture

Future UGC moderation should be server-controlled:

```
Select image
   -> authenticated upload/init
   -> private quarantine R2
   -> media database record
   -> server-side moderation
       SAFE          -> publish/promote
       UNSAFE        -> reject/delete
       BORDERLINE    -> manual review
```

Important future rule:

The client must never be able to mark media as safe.

A future media record could contain:

- media ID
- owner
- kind
- quarantine key
- published key
- moderation status
- moderation provider/version
- result metadata
- created/moderated timestamps
- cleanup expiry

Exact schema must be designed against the existing implementation before coding.

## 42. Planned enforcement model

Future Trust & Safety may add:

- warning
- strike
- restriction
- suspension
- permanent ban
- moderation audit log
- security events

Enforcement should be server-side and auditable.

Do not implement "three reports = automatic ban". Reports are signals; confirmed violations drive enforcement.

## 43. Planned identity-abuse workflow

For future identity abuse:

1. A student identity is claimed.
2. Existing verified identity uniqueness is checked server-side.
3. A duplicate claim creates a security event.
4. The legitimate account may receive a generic security alert.
5. Attacker private information is not exposed to the legitimate student.
6. Moderators inspect the account, verification evidence and abuse history.
7. Re-verification can be required.
8. Confirmed abuse can trigger enforcement.

If there is no existing Varta account for the legitimate student, Varta cannot automatically notify that person unless an official external directory/roster or another trusted contact channel exists.

## 44. Important data-flow rule

For every new feature, identify:

```
UI
 -> client lib
 -> Supabase query/RPC
 -> RLS/database constraint
 -> trusted Edge Function (if privileged)
 -> external service (if any)
```

If a feature involves privileged data or mutation, ask:

- Can the client forge the user ID?
- Can the client forge ownership?
- Can the client bypass verification?
- Can the client expose another user's data?
- Can a blocked user still appear?
- Can an unverified user publish?
- Can an organization member escalate their role?
- Can a user upload arbitrary media?
- Can a user bypass media moderation?
- Can a deleted target still leak through a cached query?

## 45. Coding workflow for Varta

### Step 1 — Inspect

Before editing:

- relevant route/screen
- closest `src/lib` module
- relevant hook/provider
- relevant types
- existing migrations
- existing RLS
- related Edge Function
- existing media path/access rules

### Step 2 — Map current behavior

Write:

```
CURRENT
- what happens now
- where it is enforced
- what data is stored

CHANGE
- minimum new behavior

WHY
- product/security reason

SECURITY IMPACT
- new attack surface
- RLS changes
- server-side authorization

FILES / TABLES
- exact files and migrations affected
```

### Step 3 — Database first

For backend/security work:

1. migration
2. constraints
3. indexes
4. RLS / RPC authorization
5. Edge Function if required
6. generated database types
7. client lib
8. hook/provider
9. UI

### Step 4 — Test

At minimum:

```
npm run typecheck
npx expo-doctor
npm run lint
```

Then test the real affected flow on a device/installed build when it involves:

- media
- push
- deep links
- Android permissions
- authentication callbacks
- native configuration

### Step 5 — Check security

Verify both:

- expected user can do the operation;
- malicious/unauthorized user cannot.

## 46. Common mistakes to avoid

### Do not trust client flags

Bad:

```ts
if (profile.is_verified) {
  // allow privileged action
}
```

Good architecture:

- client may hide/show UI;
- server/RLS independently enforces the operation.

### Do not expose private columns through broad selects

Avoid:

`select('*')`

on sensitive or mixed-purpose tables.

Select only the fields needed by the screen.

### Do not put secrets in Expo

Never:

- R2 secret
- Supabase service-role key
- database password
- admin token

inside mobile code or `EXPO_PUBLIC_*`.

### Do not bypass existing R2 flow

Do not replace the existing signed-upload architecture with direct R2 credentials.

### Do not reintroduce student following

The current product direction is organization-centric.

### Do not create duplicate business logic

If a function already exists in `src/lib`, use or extend it instead of implementing another query in the screen.

### Do not weaken RLS

If a query fails, understand why before changing policy.

### Do not treat ID-card possession as absolute identity proof

The current verification model is evidence-based and can be abused by stolen IDs.

## 47. Useful existing documentation

Read these before touching the related area:

- `docs/internal-alpha.md` — tester walkthrough, security/storage audit, known constraints
- `docs/development-student-verification.md` — verification workflow
- `docs/campus-events.md` — organization/event roles and visibility
- `docs/moderation-workflow.md` — trusted moderation workflow
- `docs/notifications-and-push.md` — notification and push architecture
- `docs/preview-build.md` — Android build/release testing
- `docs/sharing-and-app-links.md` — sharing/deep links
- `docs/branding-and-settings.md` — branding/theme/settings
- `docs/account-deletion-operations.md` — deletion support workflow

## 48. First files to inspect for common tasks

| Task | Start here |
|---|---|
| Auth | `src/lib/auth.ts`, `src/providers/AuthProvider.tsx`, `src/app/(auth)/*` |
| Profile | `src/lib/profile.ts`, `src/providers/ProfileProvider.tsx`, profile routes |
| Verification | `src/lib/verification.ts`, VerificationProvider, onboarding screens |
| Feed | `src/lib/feed.ts`, FeedProvider, `src/components/feed/*`, feed migrations |
| Posts | `src/lib/posts.ts`, `src/lib/postInteractions.ts`, post screens/components |
| Search | `src/lib/search.ts`, Explore, search migrations |
| Organizations | `src/lib/organizations.ts`, organization routes, organization migrations |
| Events | `src/lib/events.ts`, event routes, campus-events migration |
| Lost & Found | `src/lib/lostFound.ts`, Lost & Found routes/components |
| Notifications | notifications lib/provider/functions/migrations |
| Push | `src/lib/pushNotifications.ts`, `send-notification-push` |
| Moderation | `src/lib/moderation.ts`, Report/Block sheets, reports/block migrations |
| Media | `src/lib/r2.ts`, image helpers, create/delete media Edge Functions |
| Deep links | `+native-intent.ts`, app.json, sharing docs |
| Theme | ThemeProvider, useTheme, theme constants |
| Database | `supabase/migrations/*`, then `src/types/database.ts` |

## 49. Current known limitations

These are important when planning work:

- Phone verification is not currently the identity-accountability layer.
- Student-ID verification can be abused by someone possessing another student's ID.
- Moderation is primarily trusted/admin-driven rather than a complete moderator UI.
- Automatic NSFW/illegal-content media moderation is not implemented as a full quarantine pipeline.
- Account deletion is support-operated rather than fully automatic.
- Organization avatar upload is trusted/admin-managed.
- Product analytics are intentionally minimal.
- Remote push requires installed builds and correct native credentials.
- Search is not full-text post-content search.

## 50. Definition of "done" for a Varta feature

A feature is not done merely because the screen works.

A production-ready Varta change should have:

- UI implemented
- loading/error/empty states
- typed data flow
- database migration where needed
- RLS/authorization reviewed
- constraints/indexes where appropriate
- Edge Function/server authorization where required
- privacy impact checked
- block/report implications checked
- notification/deep-link implications checked
- media lifecycle checked if media is involved
- TypeScript passing
- Expo Doctor passing
- lint passing
- relevant Android/device testing
- documentation updated if behavior/security changed

## 51. Developer mental model

When coding Varta, think:

```
Varta is not just a React Native app.

It is:

React Native UI
      +
Supabase Auth
      +
PostgreSQL data model
      +
RLS security boundary
      +
trusted RPC / Edge Functions
      +
R2 media pipeline
      +
Realtime notifications
      +
Android deep links / push
```

The client is the presentation and interaction layer.

The database and trusted backend are the authority.

If a security-sensitive rule exists only in React Native, it is not actually enforced.

---

## Source of truth

For implementation details, the repository itself is authoritative:

- `src/**`
- `supabase/migrations/**`
- `supabase/functions/**`
- `src/types/database.ts`

This document is a developer orientation layer over that source. When this document and the current code disagree, inspect the current code/migrations and update this document rather than coding against stale assumptions.
