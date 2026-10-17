# Varta admin account moderation implementation prompt

Use this prompt in the separate `C:\socnet\varta-admin` work thread:

> Implement the Varta admin-panel side of account moderation and report evidence. Read `C:\socnet\varta-admin\AGENTS.md` and the installed Next.js 16 docs under `node_modules/next/dist/docs/` before editing. Inspect the existing students, reports, Server Actions, privileged queries/mutations, capability checks, audit UI, and server-only Supabase client. Use Codebase Memory when available, then verify against current source.
>
> The canonical campus migration is `C:\socnet\campus\supabase\migrations\20261014133730_add_account_moderation_enforcement.sql`. Do not create or copy a migration into `varta-admin`, and do not push or repair migration history. The migration adds:
>
> - `public.account_moderation` with `active | warned | restricted | suspended | banned`, a user-visible `user_message`, optional `expires_at`, and audit metadata;
> - `public.report_evidence`, an append-only report snapshot visible only to `service_role`;
> - `public.apply_account_moderation_action(actor_user_id, target_user_id, next_status, next_user_message, next_expires_at, internal_note)`, executable only by `service_role`. It validates the active admin, rejects reviewer accounts, updates the current state, and appends `admin_audit_logs` atomically.
>
> Extend the existing implementation rather than creating another moderation subsystem:
>
> 1. Keep `createAdminClient()` server-only. Require `reports:moderate` at the page/query/action/mutation boundaries. The current `super_admin`, `admin`, and `moderator` roles have that capability; reviewers do not.
> 2. Extend `getStudent()` to fetch the student's current moderation row. Treat a timed state with `expires_at <= now` as effectively active in the UI, while still showing the last stored state and expiry for audit clarity.
> 3. Add a compact account-moderation section to `/students/[userId]`. Show current/effective status, user-visible reason, expiry, last update, and actions for warn, restrict, suspend, ban, and restore. Require a 3–500 character user-visible message for non-active states. Accept an optional 3–2000 character internal note. Bans cannot have an expiry. Confirm ban and restore actions.
> 4. Add a Zod-validated Server Action and mutation that re-check `reports:moderate` and call the RPC with the authenticated admin's `actor.userId`. Never update `account_moderation` directly and never write a second audit row in application code; the RPC owns both changes atomically. Surface safe errors and revalidate `/students/[userId]`, `/students`, `/reports`, and `/audit` as needed.
> 5. Extend the existing reports query/page to fetch `report_evidence` by report ID and display its text snapshot when live post/comment/profile data was edited or deleted. Clearly label `capture_source = migration_backfill` as a migration-time snapshot. Treat snapshot fields as untrusted data: render plain escaped text, do not inject HTML, and do not log snapshots. Display media object paths as evidence metadata; do not claim the underlying R2 object is immutable or private.
> 6. Preserve the existing report claiming, resolution, content-removal, badge, organization, verification, and audit behavior. Reuse existing UI components and form/action patterns. Do not add dependencies or expose the secret key to the browser.
> 7. Add focused validation/assertions for permission denial, reviewer denial, invalid status/reason/expiry, and successful RPC argument mapping where the current test setup permits. Run `npm run check:secrets`, `npm run lint`, `npm run typecheck`, and `npm run build`. Do not deploy, apply migrations, or change production data.
>
> Report the files changed, checks run, and any unverified production assumptions. The admin implementation must remain unusable until the canonical campus migration has been deliberately reconciled and applied.
