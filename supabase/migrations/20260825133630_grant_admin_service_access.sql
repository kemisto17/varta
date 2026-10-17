-- The Varta project can use Supabase's opt-in Data API grants. The admin
-- panel's secret key maps to service_role, which bypasses RLS but still needs
-- ordinary Postgres privileges on every table it reaches through PostgREST.
-- No anon or authenticated/mobile grants are changed here.

grant select
  on table
    public.universities,
    public.institutes,
    public.profiles,
    public.student_verifications,
    public.badges,
    public.profile_badges,
    public.organizations,
    public.organization_members,
    public.organization_follows,
    public.events,
    public.event_interests,
    public.reports,
    public.posts,
    public.comments,
    public.feedback
  to service_role;

grant update
  on table public.student_verifications
  to service_role;

grant insert, update, delete
  on table public.profile_badges
  to service_role;

grant insert, update
  on table public.organizations
  to service_role;

grant insert, update, delete
  on table public.organization_members
  to service_role;

grant insert, update
  on table public.events
  to service_role;

grant update
  on table public.reports
  to service_role;

grant delete
  on table public.posts, public.comments
  to service_role;

