# Личный кабинет Corta

Вход по **ссылке из email** (magic link) — без пароля.

URL: **https://cortaapp.ru/cabinet**

Письма со ссылкой отправляет **ваш SMTP на сервере** (не встроенная почта Supabase) — так нет лимита «email rate limit exceeded».

## 1. Supabase: включить Auth

1. Dashboard → **Authentication** → **Providers** → **Email** → включить
2. **Authentication** → **URL Configuration**:
   - **Site URL:** `https://cortaapp.ru`
   - **Redirect URLs:** добавить `https://cortaapp.ru/cabinet`

Шаблон **Magic Link** можно оставить стандартным (со ссылкой `{{ .ConfirmationURL }}`). SMTP не обязателен.

## 2. SQL-миграция

В SQL Editor выполните `supabase/migrations/004_cabinet.sql`.

## 3. Переменные Amvera

**Сборка:**

```env
VITE_SUPABASE_URL=https://....supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Запуск:**

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...

# SMTP — обязательно для отправки ссылки входа (те же переменные, что для заявок на разбор)
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=hello@bookvolon.ru
```

## 4. Как войти

1. Открыть `/cabinet`
2. Ввести email (тот же, что при тесте)
3. Получить письмо → нажать ссылку **в том же браузере**
4. Откроется кабинет

## 5. Имя отправителя «Corta»

| Вариант | Имя «от кого» | Нужен SMTP? |
|--------|----------------|-------------|
| Стандартная почта Supabase | Обычно «Supabase» / технический адрес | Нет |
| Свой SMTP (Resend и т.д.) | **Corta**, `noreply@cortaapp.ru` | Да |

Без SMTP изменить имя отправителя на **Corta** почти нельзя — только тема/текст письма (и то после настройки SMTP в Supabase).
