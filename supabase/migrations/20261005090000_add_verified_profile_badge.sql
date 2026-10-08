-- Public verification badge assignments are intentionally separate from
-- profiles.is_verified. The latter remains the trusted access-control state;
-- this badge is the opt-in visual mark that can be assigned per profile.

insert into public.badges (
  name,
  slug,
  description,
  icon,
  priority,
  visibility
)
values (
  'Verified profile',
  'verified',
  'A profile manually selected to display the Varta verification mark.',
  '✓',
  1000,
  'public'
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    priority = excluded.priority,
    visibility = excluded.visibility;

comment on column public.profiles.is_verified is
  'Trusted student verification state used for access control. Do not use this column as the public profile badge toggle.';
