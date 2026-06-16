
-- Pin search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

-- Trigger functions: not meant to be called from the API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_crew_owner() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- is_crew_member is called inside RLS policies; keep EXECUTE for authenticated only
revoke execute on function public.is_crew_member(uuid, uuid) from public, anon;
grant execute on function public.is_crew_member(uuid, uuid) to authenticated;

-- Tighten overly-permissive WITH CHECK on crews update
drop policy if exists "crews_update_owner" on public.crews;
create policy "crews_update_owner" on public.crews
  for update to authenticated
  using (exists (select 1 from public.crew_members m
                 where m.crew_id = crews.id and m.user_id = auth.uid() and m.role = 'owner'))
  with check (exists (select 1 from public.crew_members m
                      where m.crew_id = crews.id and m.user_id = auth.uid() and m.role = 'owner'));
