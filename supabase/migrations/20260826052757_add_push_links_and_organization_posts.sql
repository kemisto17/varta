-- Enum values are committed separately so the following migration can safely
-- reference them in functions and indexes on every supported Postgres version.

alter type public.notification_type
add value if not exists 'event_updated';

alter type public.notification_type
add value if not exists 'organization_role_assigned';
