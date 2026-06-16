
alter table public.sessions
  add column if not exists overrides jsonb not null default '{}'::jsonb;
