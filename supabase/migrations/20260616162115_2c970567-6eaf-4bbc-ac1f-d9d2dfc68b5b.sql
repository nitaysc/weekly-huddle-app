
-- =================== profiles ===================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  initials text not null,
  avatar_color text not null default 'hsl(45 90% 50%)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- updated_at trigger fn
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  name_val text;
  init_val text;
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  name_val := coalesce(nullif(trim(raw_name), ''), 'Friend');
  init_val := upper(substring(regexp_replace(name_val, '[^a-zA-Z]', '', 'g'), 1, 2));
  if init_val is null or init_val = '' then init_val := 'FR'; end if;

  insert into public.profiles (id, display_name, initials)
  values (new.id, name_val, init_val)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =================== crews ===================
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.crews to authenticated;
grant all on public.crews to service_role;

alter table public.crews enable row level security;

-- =================== crew_members ===================
create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  unique (crew_id, user_id)
);

grant select, insert, delete on public.crew_members to authenticated;
grant all on public.crew_members to service_role;

alter table public.crew_members enable row level security;

-- security-definer membership check (avoid RLS recursion)
create or replace function public.is_crew_member(_user_id uuid, _crew_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crew_members
    where user_id = _user_id and crew_id = _crew_id
  );
$$;

-- crews policies
create policy "crews_select_members" on public.crews
  for select to authenticated
  using (public.is_crew_member(auth.uid(), id));
-- allow looking up a crew by invite code so you can join it
create policy "crews_select_by_invite" on public.crews
  for select to authenticated using (true);
create policy "crews_insert_self" on public.crews
  for insert to authenticated with check (auth.uid() = created_by);
create policy "crews_update_owner" on public.crews
  for update to authenticated
  using (exists (select 1 from public.crew_members m
                 where m.crew_id = crews.id and m.user_id = auth.uid() and m.role = 'owner'))
  with check (true);

-- crew_members policies
create policy "members_select_same_crew" on public.crew_members
  for select to authenticated
  using (public.is_crew_member(auth.uid(), crew_id));
create policy "members_insert_self" on public.crew_members
  for insert to authenticated with check (auth.uid() = user_id);
create policy "members_delete_self_or_owner" on public.crew_members
  for delete to authenticated
  using (
    user_id = auth.uid() or exists (
      select 1 from public.crew_members m
      where m.crew_id = crew_members.crew_id and m.user_id = auth.uid() and m.role = 'owner'
    )
  );

-- auto-add the creator as owner
create or replace function public.add_crew_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.crew_members (crew_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;
create trigger crews_add_owner after insert on public.crews
  for each row execute function public.add_crew_owner();

-- =================== sessions ===================
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  session_date date not null,
  sport_id text not null,
  starts_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (crew_id, session_date)
);

grant select, insert, update, delete on public.sessions to authenticated;
grant all on public.sessions to service_role;

alter table public.sessions enable row level security;

create policy "sessions_select_members" on public.sessions
  for select to authenticated using (public.is_crew_member(auth.uid(), crew_id));
create policy "sessions_insert_members" on public.sessions
  for insert to authenticated with check (public.is_crew_member(auth.uid(), crew_id));
create policy "sessions_update_members" on public.sessions
  for update to authenticated using (public.is_crew_member(auth.uid(), crew_id))
  with check (public.is_crew_member(auth.uid(), crew_id));
create policy "sessions_delete_members" on public.sessions
  for delete to authenticated using (public.is_crew_member(auth.uid(), crew_id));

-- =================== attendance ===================
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('going','maybe','out')),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

grant select, insert, update, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;

alter table public.attendance enable row level security;

create policy "attendance_select_members" on public.attendance
  for select to authenticated using (
    public.is_crew_member(auth.uid(),
      (select crew_id from public.sessions where id = attendance.session_id))
  );
create policy "attendance_insert_self_member" on public.attendance
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_crew_member(auth.uid(),
      (select crew_id from public.sessions where id = attendance.session_id))
  );
create policy "attendance_update_self" on public.attendance
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "attendance_delete_self" on public.attendance
  for delete to authenticated using (user_id = auth.uid());

create trigger attendance_set_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();
