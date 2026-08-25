-- Enum additions must commit before a later migration can safely use the new
-- value in functions, indexes, or constraints.

alter type public.notification_type
add value if not exists 'profile_follow';
