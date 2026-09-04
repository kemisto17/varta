-- Commit the enum value before the following migration uses it in indexes.
alter type public.notification_type add value if not exists 'mention';
