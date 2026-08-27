-- ============================================================
-- LOCK DOWN PG_NET
--
-- Varta uses pg_net only from trusted server-side database
-- code:
--
--   private.enqueue_notification_push()
--   pg_cron receipt processing
--
-- Mobile clients must never need direct access to pg_net.
--
-- In particular, net.http_request_queue may temporarily contain
-- request headers used for internal webhooks.
-- ============================================================


-- ------------------------------------------------------------
-- REMOVE SCHEMA ACCESS
-- ------------------------------------------------------------

revoke usage
on schema net
from anon, authenticated;


-- ------------------------------------------------------------
-- REMOVE TABLE ACCESS
-- ------------------------------------------------------------

revoke all privileges
on all tables in schema net
from anon, authenticated;


-- ------------------------------------------------------------
-- REMOVE SEQUENCE ACCESS
-- ------------------------------------------------------------

revoke all privileges
on all sequences in schema net
from anon, authenticated;


-- ------------------------------------------------------------
-- REMOVE FUNCTION EXECUTION
-- ------------------------------------------------------------

revoke all privileges
on all functions in schema net
from anon, authenticated;


-- ============================================================
-- NOTES
--
-- Do not grant pg_net access back to application roles.
--
-- Trusted notification dispatch continues through:
--
--   private.enqueue_notification_push()
--
-- which executes with its privileged function owner.
--
-- The scheduled receipt-processing job also runs server-side
-- and does not depend on anon/authenticated privileges.
-- ============================================================