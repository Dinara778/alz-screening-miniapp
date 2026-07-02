-- Снимок сессии для просмотра отчёта из личного кабинета
alter table public.assessments
  add column if not exists session_data jsonb;

create index if not exists assessments_user_created_idx
  on public.assessments (user_id, created_at desc);
