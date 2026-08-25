alter function public.search_people(text, integer) security invoker;
alter function public.search_organizations(text, integer) security invoker;
alter function public.search_events(text, integer) security invoker;
alter function public.get_discovery_organizations(integer) security invoker;

create index if not exists student_verifications_reviewer_id_idx
  on public.student_verifications (reviewer_id)
  where reviewer_id is not null;

comment on function public.search_people(text, integer) is
  'RLS-enforced same-university verified profile search with current-user block filtering.';
