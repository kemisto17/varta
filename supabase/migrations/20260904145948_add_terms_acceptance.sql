create table private.terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
alter table private.terms_acceptances enable row level security;
revoke all on private.terms_acceptances from public, anon, authenticated;

create or replace function public.has_accepted_current_terms()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from private.terms_acceptances
    where user_id = (select auth.uid()) and version = '2026-09-04'
  );
$$;
revoke all on function public.has_accepted_current_terms() from public, anon, authenticated;
grant execute on function public.has_accepted_current_terms() to authenticated;

create or replace function public.accept_current_terms(accepted_version text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to accept the terms.' using errcode = '42501';
  end if;
  if accepted_version is distinct from '2026-09-04' then
    raise exception 'Please review the current terms.' using errcode = '22023';
  end if;
  insert into private.terms_acceptances(user_id, version)
  values ((select auth.uid()), accepted_version)
  on conflict do nothing;
end;
$$;
revoke all on function public.accept_current_terms(text) from public, anon, authenticated;
grant execute on function public.accept_current_terms(text) to authenticated;

-- Add requirements alongside existing policies without replacing ownership,
-- moderation, verification, scope or block checks. Deletes remain available.
do $$
declare content_table text;
begin
  foreach content_table in array array['posts', 'comments', 'events', 'lost_found_items'] loop
    execute format(
      'create policy "Publishing requires current terms" on public.%I as restrictive for insert to authenticated with check ((select public.has_accepted_current_terms()))',
      content_table
    );
    execute format(
      'create policy "Editing requires current terms" on public.%I as restrictive for update to authenticated using (true) with check ((select public.has_accepted_current_terms()))',
      content_table
    );
  end loop;
end;
$$;
