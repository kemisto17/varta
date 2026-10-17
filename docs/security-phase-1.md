# Security Phase 1 audit notes

Last reviewed: 2026-10-17

This note records the Phase 1 audit for content publishing, media handling, RLS, and authentication hardening. It separates observed live state from code fixes and from dashboard-only steps.

## Scope

- GitHub repository: `kemisto17/varta`
- Supabase project: `pbwlkdxukrbdvjfupewu`
- App stack: Expo SDK 57, Supabase Auth/Postgres/RLS/Edge Functions, Cloudflare R2
- Constraint: no paid subscriptions, no trials, no self-hosting

## Live audit findings

- The hosted Supabase project is active and healthy on Postgres 17.
- The hosted migration ledger contains all 62 canonical migrations through `20261017104000_fix_account_moderation_target_check`. See `supabase-migration-reconciliation.md` for the verified rollout record.
- The hosted public app tables listed by Supabase have RLS enabled.
- Supabase Storage buckets `avatars`, `event-media`, `organization-media`, `post-media`, and `verification-documents` are private buckets with image MIME limits configured.
- `create-media-upload` v25, `delete-media-object` v8, and `send-notification-push` v27 are active hosted Edge Functions.
- The media Edge Functions have platform JWT verification disabled, but their function bodies perform explicit Bearer-token validation with `supabase.auth.getUser()` before upload/delete decisions. `send-notification-push` is also intentionally non-JWT because it validates a private webhook secret.
- A prior audit found all existing users email-confirmed. Recheck current counts before any Auth policy change.
- The public hosted Auth settings currently allow signup, require email confirmation, enable Google, and leave phone authentication disabled.
- Google sign-in is now active. Identity-provider counts were not re-audited in this review.
- MFA is not enrolled for any user yet, including active admin users.
- Supabase Security Advisor currently reports leaked-password protection disabled. Supabase documents leaked-password protection as Pro-plan-and-above, so this cannot be enabled under the zero-paid-subscription constraint.
- Security Advisor also reports RLS-enabled/no-policy for service-only/internal tables and warns about authenticated-callable `SECURITY DEFINER` RPCs. The no-policy tables have grants only for `service_role`, and the callable RPCs need individual review before changing because several are intentional product APIs.

## R2 media read posture

R2-backed media is publicly readable by object URL in the current production configuration. On 2026-10-17, an unauthenticated HEAD request to the configured `EXPO_PUBLIC_MEDIA_BASE_URL` for a current stored post image returned HTTP 200 with an image content type.

The mobile app constructs read URLs from the public base URL plus stored object keys. The repository contains Supabase Edge Functions for upload and deletion, but no Cloudflare Worker source, route configuration, bucket public-access setting, signed-read logic, or R2 custom-domain access policy. Upload and deletion authorization does not make reads private.

Required Cloudflare work before claiming media privacy:

- confirm whether the R2 bucket has public access enabled;
- identify the `EXPO_PUBLIC_MEDIA_BASE_URL` production origin;
- inspect the Worker or custom-domain route serving that origin;
- verify whether reads require signed URLs, authenticated cookies, object-key secrecy only, or no authorization;
- retest direct reads for another user's known object key from a logged-out browser and require denial or a short-lived authorization mechanism.

## Code fixes in this phase

- Registration now passes an explicit mobile auth callback redirect URL for confirmation links.
- The app now handles Supabase auth callback deep links for OAuth, email confirmation, and PKCE-style callback codes.
- Login and registration now include Google sign-in entry points using Supabase OAuth with `prompt=select_account`.
- Google sign-in is hidden unless `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`, allowing the code to ship before provider setup without exposing a broken button.
- The Google flow relies on Supabase automatic identity linking for matching verified emails. It does not call manual linking from the mobile client.
- Password creation and reset now enforce the same app-side policy: at least 8 characters with uppercase, lowercase, a number, and a symbol.
- Local Supabase config now reflects the intended hosted Auth settings: email confirmation enabled, secure password change enabled, 60-second email send frequency, Google OAuth placeholders, and TOTP MFA enabled.

## Account moderation enforcement

Migration `20261014133730_add_account_moderation_enforcement.sql` adds the following server-side controls:

- current account states: active, warned, restricted, suspended, and banned;
- a service-role-only RPC that changes state and appends the matching admin audit record in the same database transaction;
- database triggers that reject writes by restricted, suspended, and banned accounts on user-generated content and organization-management tables;
- restrictive Storage policies that reject object insertion, replacement, and deletion by those accounts while preserving read behavior;
- report-time snapshots of post, comment, or profile evidence, with a clearly marked best-effort backfill for older reports;
- mobile warning/restriction messaging and suspended/banned account gates;
- account-state checks in both Cloudflare R2 upload/deletion Edge Functions and suppression of push delivery to suspended or banned recipients.

Reports, user blocks, and feedback are deliberately excluded from the write-block triggers, although their existing RLS still applies. Suspended and banned users receive an external support contact in the mobile gate. The migration does not add automated text or image classification. Evidence snapshots preserve text and media object paths, but they do not copy R2 image bytes into an immutable evidence bucket.

The canonical migration and matching Edge Functions were deployed on 2026-10-17. The post-deployment checks confirmed five evidence backfills, 14 protected write tables, three restrictive Storage policies, authenticated denial for report evidence and the moderation RPC, and service-role access for the admin panel. A forward-only corrective migration changed the RPC target check from unreadable `auth.users` to `public.profiles`; a service-role call completed inside an explicit rolled-back transaction with no retained moderation or audit rows. No migration-history override was used.

## Verification and dependency follow-up

- `npm run typecheck` passes.
- `npm run lint` passes.
- `git diff --check` passes.
- Expo Doctor passes all 21 checks after aligning Expo SDK 57 packages to their current compatible patch versions.
- A production-dependency `npm audit` reports 22 inherited advisories: 3 moderate, 19 high, and no critical findings. The offered automatic fixes require incompatible Expo/React Native downgrades or an Expo Router SDK 58 upgrade, so no forced audit fix was applied.
- Google sign-in has been user-tested and is the primary signup path. Email/password confirmation and recovery continue to depend on Supabase's shared sender unless optional custom SMTP is configured; this delivery limitation is accepted for the current zero-cost release.

## Manual cloud configuration

These steps require project-owner dashboard access and must not be claimed as deployed until completed and tested.

1. Supabase Auth URL configuration:
   - Site URL: a production URL controlled by Varta, or the mobile callback if no web auth landing page is used.
   - Additional redirect URLs:
     - `varta://auth-callback`
     - `varta://reset-password`
     - any exact Expo development/preview callback URLs used for testing.

2. Supabase Email provider (optional for the current Google-first release):
   - Enable email confirmations.
   - The shared Supabase sender has low limits and is not a dependable high-volume production delivery path. Configure custom SMTP only if reliable email/password onboarding becomes a release requirement.
   - Keep OTP expiry at 3600 seconds or lower.
   - Set resend frequency to at least 60 seconds.
   - Enable secure password change.
   - Set minimum password length to 8.
   - Set password requirements to `lower_upper_letters_digits_symbols`.
   - Leaked-password protection cannot be enabled without a paid Supabase plan.

3. Supabase Google provider:
   - Google is enabled; keep its OAuth client ID and secret in the Supabase dashboard.
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

