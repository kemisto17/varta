# Varta internal alpha guide

This is the operating checklist for a controlled Varta test with real accounts. Run it against the hosted development project, not a production student directory.

## Release gate

Before sharing an Expo QR code:

- The working tree contains no .env file or secret material.
- npm run typecheck passes.
- npx expo-doctor passes.
- npm run lint passes.
- npx expo export --platform web completes.
- All committed Supabase migrations are present on the hosted project.
- Supabase security advisors have no unexpected error-level findings.
- At least two verified test students exist at the same university.
- At least one official organization and one future published event exist.
- The tester has the exact version/commit identifier and knows where to send feedback.
- The configured VĀ launcher icon has been checked in a development build, preview APK, or production build rather than judged through Expo Go.

Email confirmation is intentionally disabled only for Expo Go development. Before inviting external testers, configure a mobile auth callback, re-enable confirmation, and enable leaked-password protection in Supabase Auth.

## Approve a student tester

A tester must complete profile setup and submit a student-ID verification first. Then run the following in the Supabase SQL Editor as a trusted project owner, replacing the email exactly:

~~~sql
update public.student_verifications as verification
set
  status = 'verified',
  reviewed_at = now()
from auth.users as account
where account.id = verification.user_id
  and lower(account.email) = lower('tester@example.com')
  and verification.status = 'pending'
returning
  verification.user_id,
  verification.status,
  verification.reviewed_at;
~~~

A result row means approval succeeded. No row means the account has not submitted verification, the email does not match, or the submission is no longer pending. Never add approval capability to the mobile client.

## Prepare official discovery content

Create and verify organizations only from a trusted administrator context. Assign organization roles only after verifying the person out of band. See campus-events.md for the role query.

For Explore discovery, an organization must:

- belong to the tester's university;
- have is_verified set to true;
- not already be followed by that tester.

For event discovery and search, an event must:

- belong to the tester's university;
- be published;
- be university-wide or match the tester's institute;
- still be upcoming or in progress.

Cancelled, completed, and draft events do not appear as prominent Explore results.

## Tester walkthrough

Use two verified accounts where a blocking test is required.

1. Launch and auth
   - Register, sign in, close the app, and reopen it.
   - Confirm the session persists.
   - Sign out and confirm protected screens cannot be reached.

2. Onboarding
   - Confirm institutes load from Supabase.
   - Create a profile and submit a readable student-ID image.
   - Confirm pending and rejected states remain outside the tabs.
   - Approve the account with the trusted workflow and recheck status.

3. Home and posts
   - Refresh the feed.
   - Create text-only and image posts.
   - Open a post, like it, comment, delete an owned comment, and delete an owned post.
   - Test a missing or removed post link.

4. Explore
   - Confirm an empty query shows official organizations and upcoming events.
   - Search by full name, username, branch, organization name, slug, event title, and event organization.
   - Confirm a one-character query does not call search and shows the two-character hint.
   - Type several queries quickly; only the newest result set should win.
   - Open student, organization, and event results.
   - Confirm recent terms persist after reopening Varta and Clear removes them.
   - Block the second tester and confirm that account is removed from the blocker's search results.

5. Organizations and events
   - Follow and unfollow an organization.
   - Save and unsave an event.
   - Confirm event covers load through signed URLs.
   - Test an invalid registration link and a missing event.
   - With an assigned owner/admin/editor account, test the documented event permissions.

6. Profile and moderation
   - Edit name, username, branch, year, bio, and avatar.
   - Open another student's profile.
   - Submit a report and verify duplicate open reports are prevented.
   - Block the second tester, then open Profile → Settings → Blocked users and unblock them.

7. Notifications
   - Open the notification list from the Home header.
   - Mark one and then all notifications read.
   - Test notification links to a deleted target.
   - In Settings, disable Likes and cause a new like from the second account; confirm no new like notification is created.
   - Re-enable Likes and repeat. Repeat the same smoke test for Comments, Badges, and Events where trusted setup is available.

8. Feedback
   - Open Send feedback from Profile → Settings.
   - Submit one bug, idea, and other report.
   - Confirm the success state appears.
   - Confirm the mobile client cannot list feedback rows.

9. Network and media edges
   - Repeat feed refresh, search, feedback, and image upload with connectivity disabled.
   - Select an unsupported or oversized image.
   - Confirm user-facing recovery text appears and the app does not log signed URLs, local image URIs, or storage paths.

10. Appearance and settings
   - Set System, then change the device from Light to Dark while Varta is open.
   - Force Light while the device is dark, then force Dark while the device is light.
   - Restart the app and confirm the selected preference persists without a bright launch flash.
   - Confirm tab bars, headers, auth, onboarding, feed, profiles, organization/event screens, search, notifications, sheets, form fields, and fallback avatars remain legible in both modes.
   - Confirm the status bar changes between dark and light content.
   - Sign out and back in; the device appearance preference should remain.

11. Safe areas and installed branding
   - Check a standard screen, punch-hole screen, and notched screen when those device profiles are available.
   - Test both gesture navigation and three-button Android navigation in Light and Dark modes.
   - Confirm first and last scroll items, Create Post actions, comment Send controls, sheets, and fullscreen-image controls remain reachable.
   - Check the launcher icon in a Varta development build, preview APK, or production build. Expo Go displays its own host-app icon and is not a valid launcher-icon test.
   - Confirm the configured VĀ mark remains centered and readable under circle, squircle, rounded-square, and themed-icon masks.

## Security and privacy audit

The hosted schema was reviewed with the following expectations:

- Every public app table has RLS enabled.
- profiles, posts, comments, post_likes, organizations, and events are limited to verified university visibility.
- event_interests, organization_follows, notifications, push_tokens, and user_blocks expose only the signed-in user's rows.
- notification_preferences permits only self-owned select/insert/update and no client delete.
- organization_members exposes only the signed-in user's role assignment.
- student_verifications and verification documents expose only the signed-in student's record/object.
- reports permit insert only; ordinary clients cannot read the moderation queue.
- feedback permits verified self-owned insert only; ordinary clients cannot select, update, or delete feedback.
- Search functions use SECURITY INVOKER and explicit authenticated execute grants.
- Student search returns only id, name, username, branch, year, avatar path, verification flag, and institute labels. It never returns email, enrollment number, document path, or auth metadata.
- The publishable key is the only Supabase key allowed in Expo environment variables.

Private storage buckets:

- avatars — verified same-university viewing; owner upload/update/delete.
- post-media — verified same-university viewing for media referenced by a visible post; owner upload/delete.
- verification-documents — owner-only viewing and controlled replacement.
- event-media — visible-event viewing; authorized organization roles manage objects.
- organization-media — visible active organization avatars only; trusted backend/admin upload for this alpha.

Organization-media intentionally has no client upload policy yet. Organization pages and Explore use a signed active avatar when present and a clean initials fallback otherwise.

## Query and list audit

- Feed, profile posts, events, and notifications use bounded pages with stable cursors or limits.
- Search returns at most eight results per group and cancels stale client requests.
- PostgreSQL pg_trgm GIN indexes cover profile full name, username, branch, organization name/slug, and event title contains matching.
- Search is server-side; there is no 7,000-row client download and no external search service.
- Recent search history is stored locally per authenticated user and is never written to Supabase.
- Organization management is capped at 50 event rows; ordinary event and feed surfaces use virtualized lists.
- Comment threads use stable 30-row cursor pages and append newer pages without duplicates.

## Review the feedback queue

Only a project owner or another explicitly privileged admin should read feedback. In the SQL Editor:

~~~sql
select
  category,
  message,
  user_id,
  created_at
from public.feedback
order by created_at desc
limit 100;
~~~

Do not expose this query or a feedback-list screen to the mobile role. Treat messages as potentially sensitive tester content.

## Known alpha constraints

- Expo Go development keeps the legacy campus URL scheme to avoid breaking existing links; the visible product name and artwork are Varta.
- Email confirmation is disabled until the mobile callback is configured.
- Organization avatar upload is admin-managed; the client is read-only.
- Search does not include post content or full-text ranking.
- Product analytics are not added in this milestone; server table counts and the private feedback queue provide the minimum alpha signal without introducing a new data processor.
- Native push delivery still depends on device permissions, Expo credentials, and the documented server function.
- The full VĀRTĀ launcher alternative is retained but not configured because it becomes too small at common launcher sizes; the VĀ monogram is the production candidate.
- Account deletion is not exposed because a privileged, session-revoking deletion flow is not implemented yet.
- Device testing is required for camera/gallery behavior, keyboard layout, and deep links even when automated checks pass.
