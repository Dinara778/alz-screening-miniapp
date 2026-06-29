# Supabase для Corta

Минимальная схема: пользователи, прохождения теста, оплаты, подписки, настройки.

## 1. Создать проект

1. [supabase.com](https://supabase.com) → **New project**
2. Запомните **Project URL** и **service_role** key (Settings → API)

## 2. Применить схему

Supabase Dashboard → **SQL Editor** → New query → вставьте содержимое файла:

`supabase/migrations/001_initial_schema.sql`

→ **Run**

## 3. Переменные на Amvera (Запуск)

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...   # service_role, не anon!
```

Пересоберите проект после добавления переменных.

## 4. Таблицы

| Таблица | Назначение |
|---------|------------|
| `users` | email, created_at |
| `assessments` | score, memory/attention/speed (+ stability, flexibility), session_id |
| `payments` | type (one_time / subscription), amount, status, product |
| `subscriptions` | status, start_date, end_date |
| `user_settings` | push_time, notifications_enabled |
| `funnel_sessions` | email-визит, last_screen, screens_path, status (in_progress / completed / abandoned) |

## 5. Как данные попадают в БД

| Событие | Что пишется |
|---------|-------------|
| Email в анкете | `users` + `funnel_sessions` (экран `welcome/email`) |
| Переход по экранам | `funnel_sessions.last_screen` обновляется |
| Закрытие вкладки | `funnel_sessions.status = abandoned` |
| Завершение теста | `users` + `assessments` + `funnel_sessions.status = completed` |
| Успешная оплата Робокассы | `payments` (автоматически на сервере) |

После деплоя выполните в SQL Editor также `supabase/migrations/002_funnel_sessions.sql`.

Проверка: `/health` → блок `supabase.configured: true`

## 6. Безопасность

- На сервере только **service_role** (никогда во фронтенд)
- RLS включён; запись идёт через API с service role
- Политики `select` заготовлены под будущий Supabase Auth

## 7. Дальше (по желанию)

- Magic Link / email auth → привязать `users.id` к `auth.users`
- Подписки → webhook + таблица `subscriptions`
- Push → `user_settings.push_time` + Edge Function по cron
