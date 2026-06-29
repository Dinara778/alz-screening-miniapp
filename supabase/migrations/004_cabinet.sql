-- Личный кабинет: компенсация + синхронизация public.users при регистрации в Auth
-- Запуск в SQL Editor после 003_admin_dashboard.sql

alter table public.assessments
  add column if not exists compensation_tip text;

-- При входе через Supabase Auth создаём строку в public.users
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    insert into public.users (email)
    values (lower(trim(new.email)))
    on conflict (email) do nothing;

    insert into public.user_settings (user_id, notifications_enabled)
    select id, false from public.users where email = lower(trim(new.email))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();
