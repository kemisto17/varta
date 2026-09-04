drop policy if exists "Users can view own profile"
on public.profiles;

drop policy if exists "Verified users can view university profiles"
on public.profiles;

create policy "Users can view own or university profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (
    (select private.is_verified_user())
    and (select private.profile_is_in_current_university(id))
  )
);

comment on policy "Users can view own or university profiles"
on public.profiles is
  'Keeps onboarding self-read access and verified same-university discovery in one policy.';

;
