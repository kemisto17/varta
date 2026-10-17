# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Varta Mobile Repository Instructions

This repository is an independent checkout. Do not assume `C:\socnet\AGENTS.md` is loaded. When the parent instructions are available, follow both; this file specializes them for the mobile application and does not weaken them.

## Product baseline

Varta is a production, community-first campus application for verified university students.

- Students must not be able to follow other students. Students may follow authorized organizations.
- Do not add popularity rankings, influencer mechanics, or unrelated social graphs without explicit approval.
- Treat email ownership and student identity verification as separate trust decisions.
- Protect student privacy, verification documents, reports, moderation evidence, and user-generated content.
- Preserve reporting, blocking, organization authorization, and moderation safeguards.

## Architecture

- Expo SDK 57, React Native, TypeScript, and Expo Router.
- Routes live in `src/app`; shared UI lives in `src/components`; stateful feature composition uses providers, contexts, and hooks; data and business logic live in `src/lib`.
- The root provider stack coordinates authentication, profile loading, student verification, notifications, saved posts, feed state, terms acceptance, and navigation gates.
- Mobile Supabase access uses the publishable client in `src/lib/supabase.ts`. RLS, RPCs, constraints, and trusted backend functions enforce protected behavior.
- `supabase/migrations` is the canonical migration chain for the shared Varta database. Inspect later migrations before relying on historical schema behavior.
- Supabase Realtime drives notification updates. Expo Notifications and the push Edge Function handle device delivery.
- Ordinary media uses Cloudflare R2 object keys through authenticated Supabase Edge Functions for upload and deletion. Legacy Supabase Storage paths remain supported where implemented.
- The `varta-admin` application shares this Supabase project. Schema, RLS, organization lifecycle, moderation, and storage changes may affect it.

## Mobile development rules

- Reuse existing components, hooks, providers, feature libraries, theme helpers, and navigation patterns before adding code.
- Preserve Android compatibility, safe areas, keyboard behavior, accessibility labels, touch targets, loading states, empty states, and error states.
- Do not add a state-management library when the existing provider/context structure is sufficient.
- Do not replace Expo-compatible code with a native module without reviewing build consequences.
- Do not upgrade Expo, React Native, Expo Router, or other major dependencies without explicit approval.
- Keep authenticated identity as the source of ownership. A user ID supplied by the UI is not an authorization check.
- Keep organization administration, verification decisions, media authorization, and moderation enforcement on trusted backend boundaries.
- Never put Supabase secret/service-role keys, R2 credentials, signing keys, or administrative credentials in the app or public environment variables.
- Do not assume R2 reads are private; the deployed Cloudflare route and bucket policy are outside this repository and require separate verification.

## Database changes

For database or storage work:

1. Inspect the affected migrations, schema types, RLS policies, grants, functions, triggers, and storage rules.
2. Check direct API abuse, unauthenticated access, cross-user access, and organization-role boundaries.
3. Add a forward migration; do not rewrite applied migration history without explicit direction.
4. Keep generated database types and affected mobile/admin callers aligned.
5. Test allowed and denied operations when practical.

Never disable RLS, broaden authenticated access indiscriminately, or modify a live Supabase project without explicit authorization.

## Media and notifications

- Preserve image validation, optimization, cleanup on failed writes, object-key ownership, and backend-mediated R2 operations.
- Preserve notification deduplication, user scoping, preference handling, deep-link routing, and subscription cleanup.
- Treat verification images as private documents; do not route them through ordinary public media delivery.

## Verification

Use the checks appropriate to the change:

- `npm run typecheck`
- `npm run lint`
- focused tests or assertions for new non-trivial and security-sensitive behavior
- relevant Android or Expo build checks when native configuration changes

Do not publish an EAS build, submit to Google Play, deploy Edge Functions, apply migrations, or change production configuration without explicit authorization.
