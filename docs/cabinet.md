# Личный кабинет Corta

Вход по **magic link** (Supabase Auth) — ссылка на email, без пароля.

URL: **https://cortaapp.ru/cabinet**

## 1. Supabase: включить Auth

1. Dashboard → **Authentication** → **Providers** → **Email** → включить
2. **Authentication** → **URL Configuration**:
   - **Site URL:** `https://cortaapp.ru`
   - **Redirect URLs:** добавить `https://cortaapp.ru/cabinet`

## 2. SQL-миграция

В SQL Editor выполните `supabase/migrations/004_cabinet.sql` (колонка `compensation_tip` + триггер пользователя).

## 3. Переменные Amvera

**Сборка** (как VITE_TELEGRAM_PAYMENTS_URL):

```env
VITE_SUPABASE_URL=https://keboaqukrbjuhktdcfqv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # anon public из Settings → API
```

**Запуск** (уже должны быть):

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 4. Что видит пользователь

- Текущий индекс и домены (последняя оценка)
- История за 7 дней
- Последнее упражнение-компенсация из отчёта
- Статус: бесплатно / разовая покупка / подписка

## 5. Как войти

1. Открыть `/cabinet`
2. Ввести email (тот же, что при тесте)
3. Получить письмо от Supabase → нажать ссылку
4. Откроется кабинет с данными
