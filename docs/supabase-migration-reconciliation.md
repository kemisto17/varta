# Supabase migration reconciliation

The mobile and admin applications share one Supabase project. The authoritative migration history is `campus/supabase/migrations`; files under `varta-admin/supabase/migrations` are historical mirrors only.

## Verified state on 2026-10-17

- The canonical campus directory contains 62 migrations.
- The linked hosted ledger contains all 62 canonical versions through `20261017104000_fix_account_moderation_target_check`.
- The historical admin foundation migrations `20260825115552` and `20260825133630` are now present in both the canonical history and hosted ledger.
- The October 5 hardening migrations and the organization-owner role-management migration are applied remotely.
- The account-moderation migration was applied on 2026-10-17 after a linked dry run proposed exactly that one file.
- The first live moderation request exposed a `permission denied for table users` error because the service-role RPC checked `auth.users`. The forward-only corrective migration now checks the target student in `public.profiles` without widening access to the Auth schema.
- The five existing reports were backfilled into `report_evidence`; no account moderation rows were created automatically.
- The matching `create-media-upload` v25, `delete-media-object` v8, and `send-notification-push` v27 Edge Functions are active.

Do not run `db push --include-all`, migration repair, or any migration-history override. Those options are unnecessary and could execute historical definitions out of order.

## Completed account-moderation rollout

The production rollout completed in this order:

1. Recorded the existing ledger and Edge Function versions. The project is on the free plan, so no immediately restorable platform backup was available; the migration was accepted because it is transactional and additive.
2. Confirmed the linked dry run listed only `20261014133730_add_account_moderation_enforcement.sql`.
3. Applied that canonical campus migration once.
4. Verified the enum, RLS, column grants, service-role-only RPC, three restrictive Storage policies, report/evidence triggers, and write enforcement on all 14 intended tables.
5. Deployed and smoke-tested the three Edge Functions. Unauthenticated requests are denied.
6. Deployed the reviewed admin panel through its production Git integration.
7. Applied `20261017104000_fix_account_moderation_target_check.sql` after a one-file dry run, then completed a service-role RPC smoke test inside an explicit rolled-back transaction. No moderation or audit rows were retained by that test.

Physical-device validation of warn/restrict/suspend/ban/expiry/restore behavior remains part of the Android 1.0.6 release test.

## Failure precautions

- Stop before deploying clients if the migration fails or any grant/policy differs from the reviewed SQL.
- Prefer a new forward-only corrective migration. Do not edit or rerun an applied migration.
- Roll back Edge Functions to their recorded previous versions if their post-deployment checks fail.
- Keep the current production versions available as rollback targets until staged validation passes.
- Do not drop moderation rows or report evidence during rollback. Preserving those records is safer than attempting destructive schema reversal.

A disposable local migration test was unavailable because Docker or Podman is not installed on the workstation. The production rollout instead used the linked dry run, transactional migration apply, and post-deployment schema checks above. Authenticated test-account and physical-device validation remain required before releasing Android 1.0.6.
