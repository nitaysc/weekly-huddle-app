
-- New caller-locked helper (no _user_id parameter)
create or replace function public.is_member_of(_crew_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crew_members
    where user_id = auth.uid() and crew_id = _crew_id
  );
$$;
revoke execute on function public.is_member_of(uuid) from public, anon;
grant execute on function public.is_member_of(uuid) to authenticated;

-- Re-create policies that referenced is_crew_member
drop policy if exists "crews_select_members" on public.crews;
create policy "crews_select_members" on public.crews
  for select to authenticated using (public.is_member_of(id));

drop policy if exists "members_select_same_crew" on public.crew_members;
create policy "members_select_same_crew" on public.crew_members
  for select to authenticated using (public.is_member_of(crew_id));

drop policy if exists "sessions_select_members" on public.sessions;
drop policy if exists "sessions_insert_members" on public.sessions;
drop policy if exists "sessions_update_members" on public.sessions;
drop policy if exists "sessions_delete_members" on public.sessions;
create policy "sessions_select_members" on public.sessions
  for select to authenticated using (public.is_member_of(crew_id));
create policy "sessions_insert_members" on public.sessions
  for insert to authenticated with check (public.is_member_of(crew_id));
create policy "sessions_update_members" on public.sessions
  for update to authenticated using (public.is_member_of(crew_id))
  with check (public.is_member_of(crew_id));
create policy "sessions_delete_members" on public.sessions
  for delete to authenticated using (public.is_member_of(crew_id));

drop policy if exists "attendance_select_members" on public.attendance;
drop policy if exists "attendance_insert_self_member" on public.attendance;
create policy "attendance_select_members" on public.attendance
  for select to authenticated using (
    public.is_member_of((select crew_id from public.sessions where id = attendance.session_id))
  );
create policy "attendance_insert_self_member" on public.attendance
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_member_of(
      (select crew_id from public.sessions where id = attendance.session_id))
  );

-- Drop the old helper
drop function if exists public.is_crew_member(uuid, uuid);
