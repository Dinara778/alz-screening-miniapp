-- Corta — минимальная схема Supabase
-- Запуск: Supabase Dashboard → SQL Editor → вставить и выполнить
-- или: supabase db push (если установлен Supabase CLI)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint users_email_unique unique (email),
  constraint users_email_lowercase check (email = lower(email))
);

create index if not exists users_email_idx on public.users (email);

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  session_id text not null,
  score smallint not null check (score between 0 and 100),
  memory_score smallint not null check (memory_score between 0 and 100),
  attention_score smallint not null check (attention_score between 0 and 100),
  speed_score smallint not null check (speed_score between 0 and 100),
  stability_score smallint check (stability_score between 0 and 100),
  flexibility_score smallint check (flexibility_score between 0 and 100),
  created_at timestamptz not null default now(),
  constraint assessments_session_id_unique unique (session_id)
);

create index if not exists assessments_user_id_idx on public.assessments (user_id);
create index if not exists assessments_created_at_idx on public.assessments (created_at desc);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create type public.payment_type as enum ('one_time', 'subscription');

create type public.payment_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded',
  'cancelled'
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type public.payment_type not null default 'one_time',
  amount numeric(10, 2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  product text,
  session_id text,
  external_id text,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_session_id_idx on public.payments (session_id);
create index if not exists payments_external_id_idx on public.payments (external_id);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create type public.subscription_status as enum ('active', 'inactive', 'cancelled');

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  status public.subscription_status not null default 'inactive',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create unique index if not exists subscriptions_one_active_per_user_idx
  on public.subscriptions (user_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  push_time time,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger for subscriptions / user_settings
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (для будущего Supabase Auth; service role обходит RLS)
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.assessments enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_settings enable row level security;

-- Пока нет auth.users — политики для authenticated заготовлены под email = jwt claim
-- После подключения Auth замените на auth.uid() = id

create policy "users_select_own"
  on public.users for select
  using (auth.jwt() ->> 'email' = email);

create policy "assessments_select_own"
  on public.assessments for select
  using (
    user_id in (
      select id from public.users where email = auth.jwt() ->> 'email'
    )
  );

create policy "payments_select_own"
  on public.payments for select
  using (
    user_id in (
      select id from public.users where email = auth.jwt() ->> 'email'
    )
  );

create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (
    user_id in (
      select id from public.users where email = auth.jwt() ->> 'email'
    )
  );

create policy "user_settings_select_own"
  on public.user_settings for select
  using (
    user_id in (
      select id from public.users where email = auth.jwt() ->> 'email'
    )
  );

create policy "user_settings_update_own"
  on public.user_settings for update
  using (
    user_id in (
      select id from public.users where email = auth.jwt() ->> 'email'
    )
  );
