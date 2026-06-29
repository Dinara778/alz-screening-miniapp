-- Воронка: email при анкете + экран, на котором ушёл пользователь
-- Запуск в SQL Editor после 001_initial_schema.sql

create type public.funnel_status as enum ('in_progress', 'completed', 'abandoned');

create table if not exists public.funnel_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  visit_id text not null,
  last_screen text,
  screens_path text,
  status public.funnel_status not null default 'in_progress',
  exit_reason text,
  assessment_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funnel_sessions_visit_id_unique unique (visit_id)
);

create index if not exists funnel_sessions_user_id_idx on public.funnel_sessions (user_id);
create index if not exists funnel_sessions_status_idx on public.funnel_sessions (status);
create index if not exists funnel_sessions_last_screen_idx on public.funnel_sessions (last_screen);
create index if not exists funnel_sessions_updated_at_idx on public.funnel_sessions (updated_at desc);

drop trigger if exists funnel_sessions_set_updated_at on public.funnel_sessions;
create trigger funnel_sessions_set_updated_at
  before update on public.funnel_sessions
  for each row execute function public.set_updated_at();

alter table public.funnel_sessions enable row level security;

create policy "funnel_sessions_select_own"
  on public.funnel_sessions for select
  using (
    user_id in (
      select id from public.users where email = auth.jwt() ->> 'email'
    )
  );
