# Security Phase 1 audit notes

Last reviewed: 2026-10-08

This note records the Phase 1 audit for content publishing, media handling, RLS, and authentication hardening. It separates observed live state from code fixes and from dashboard-only steps.

## Scope

- GitHub repository: `kemisto17/varta`
- Supabase project: `pbwlkdxukrbdvjfupewu`
- App stack: Expo SDK 57, Supabase Auth/Postgres/RLS/Edge Functions, Cloudflare R2
- Constraint: no paid subscriptions, no trials, no self-hosting

## Live audit findings

- The hosted Supabase project is active and healthy on Postgres 17.
- All committed migrations through `20261002201918_view_profile_followed_organizations` are present on the hosted project.
- The hosted public app tables listed by Supabase have RLS enabled.
- Supabase Storage buckets `avatars`, `event-media`, `organization-media`, `post-media`, and `verification-documents` are private buckets with image MIME limits configured.
- `create-media-upload`, `delete-media-object`, and `send-notification-push` are active hosted Edge Functions.
- The media Edge Functions have platform JWT verification disabled, but their function bodies perform explicit Bearer-token validation with `supabase.auth.getUser()` before upload/delete decisions. `send-notification-push` is also intentionally non-JWT because it validates a private webhook secret.
- Existing Auth state is safe for turning on forward email confirmation: 105 users exist, 105 have confirmed email, and 0 are currently unconfirmed.
- Google OAuth has not been used yet in production data: all 105 identities are `email`, with 0 linked Google identities.
- MFA is not enrolled for any user yet, including active admin users.
- Supabase Security Advisor currently reports leaked-password protection disabled. Supabase documents leaked-password protection as Pro-plan-and-above, so this cannot be enabled under the zero-paid-subscription constraint.
- Security Advisor also reports RLS-enabled/no-policy for service-only/internal tables and warns about authenticated-callable `SECURITY DEFINER` RPCs. The no-policy tables have grants only for `service_role`, and the callable RPCs need individual review before changing because several are intentional product APIs.

## R2 media read posture

Do not assume R2 media is private.

The mobile app constructs read URLs from `EXPO_PUBLIC_MEDIA_BASE_URL` plus stored object keys. The repository contains Supabase Edge Functions for upload and deletion, but no Cloudflare Worker source, route configuration, bucket public-access setting, signed-read logic, or R2 custom-domain access policy.

Because Cloudflare configuration and Worker code are not available in this repository or the connected tools, R2 read privacy is blocked pending Cloudflare dashboard or Worker source access. Until that is reviewed, ordinary media should be treated as potentially public-by-URL.

Minimum Cloudflare checks before claiming media privacy:

- confirm whether the R2 bucket has public access enabled;
- identify the `EXPO_PUBLIC_MEDIA_BASE_URL` production origin;
- inspect the Worker or custom-domain route serving that origin;
- verify whether reads require signed URLs, authenticated cookies, object-key secrecy only, or no authorization;
- test direct reads for another user's known object key from a logged-out browser.

## Code fixes in this phase

- Registration now passes an explicit mobile auth callback redirect URL for confirmation links.
- The app now handles Supabase auth callback deep links for OAuth, email confirmation, and PKCE-style callback codes.
- Login and registration now include Google sign-in entry points using Supabase OAuth with `prompt=select_account`.
- Google sign-in is hidden unless `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`, allowing the code to ship before provider setup without exposing a broken button.
- The Google flow relies on Supabase automatic identity linking for matching verified emails. It does not call manual linking from the mobile client.
- Password creation and reset now enforce the same app-side policy: at least 8 characters with at least one letter and one number.
- Local Supabase config now reflects the intended hosted Auth settings: email confirmation enabled, secure password change enabled, 60-second email send frequency, Google OAuth placeholders, and TOTP MFA enabled.

## Verification and dependency follow-up

- `npm run typecheck` passes.
- `npm run lint` passes.
- `git diff --check` passes.
- Expo Doctor passes 20 of 21 checks. Its only finding is that 17 Expo SDK 57 packages are behind their current SDK 57 patch versions.
- A production-dependency `npm audit` reports 28 inherited advisories: 3 moderate, 24 high, and 1 critical. Several have non-breaking transitive fixes, while others propose breaking Expo or Expo Router changes. Dependency upgrades are intentionally not mixed into this auth/media change and should be handled in a separate tested update.
- Email confirmation and Google OAuth still require physical-device testing after the dashboard configuration below is complete. No production Auth or Cloudflare setting was changed by this branch.

## Manual cloud configuration

These steps require project-owner dashboard access and must not be claimed as deployed until completed and tested.

1. Supabase Auth URL configuration:
   - Site URL: a production URL controlled by Varta, or the mobile callback if no web auth landing page is used.
   - Additional redirect URLs:
     - `varta://auth-callback`
     - `varta://reset-password`
     - any exact Expo development/preview callback URLs used for testing.

2. Supabase Email provider:
   - Enable email confirmations.
   - Keep OTP expiry at 3600 seconds or lower.
   - Set resend frequency to at least 60 seconds.
   - Enable secure password change.
   - Set minimum password length to 8.
   - Set password requirements to at least `letters_digits`.
   - Leaked-password protection cannot be enabled without a paid Supabase plan.

3. Supabase Google provider:
   - Enable Google provider.
   - Add the Google OAuth client ID and secret in the Supabase dashboard.
   - In Google Cloud Console, add Supabase's callback URL:
     - `https://pbwlkdxukrbdvjfupewu.supabase.co/auth/v1/callback`
   - After device testing succeeds, build the app with `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
   - Do not commit Google client secrets or OAuth credentials.

4. MFA:
   - Enable TOTP enroll and verify in Supabase Auth MFA settings.
   - Require all Supabase organization/project owners to enable account-level MFA in their Supabase account settings.
   - Require active Varta admin users to enroll TOTP in the app before any future admin panel relies on their user session.
   - Current admin workflows appear service-role/admin-context based, so mobile RLS cannot enforce admin MFA yet.

5. Cloudflare R2:
   - Provide Worker source or dashboard access for the media read layer before marking media read privacy complete.
   - If media must be private, use a Worker that verifies authorization and emits short-lived signed reads instead of exposing raw object keys through a public base URL.

