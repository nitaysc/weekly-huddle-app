
-- Helper: is current user owner of a given crew
create or replace function public.is_owner_of(_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crew_members
    where user_id = auth.uid()
      and crew_id = _crew_id
      and role = 'owner'
  );
$$;

-- Tighten sessions write policies to owners only
drop policy if exists sessions_insert_members on public.sessions;
drop policy if exists sessions_update_members on public.sessions;
drop policy if exists sessions_delete_members on public.sessions;

create policy sessions_insert_owner on public.sessions
  for insert to authenticated
  with check (public.is_owner_of(crew_id));

create policy sessions_update_owner on public.sessions
  for update to authenticated
  using (public.is_owner_of(crew_id))
  with check (public.is_owner_of(crew_id));

create policy sessions_delete_owner on public.sessions
  for delete to authenticated
  using (public.is_owner_of(crew_id));

-- Mark owner overrides (so we know it's not from the default rotation)
alter table public.sessions
  add column if not exists is_override boolean not null default false;

-- Allow 'rest' as a valid sport id (drop any existing CHECK if present)
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.sessions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%sport_id%'
  loop
    execute format('alter table public.sessions drop constraint %I', c.conname);
  end loop;
end$$;

alter table public.sessions
  add constraint sessions_sport_id_check
  check (sport_id in ('boxing','cali','basket','volley','rest'));
