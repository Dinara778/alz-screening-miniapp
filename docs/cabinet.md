# Личный кабинет Corta

Вход по **ссылке из email** (Supabase magic link) — без пароля и без SMTP.

URL: **https://cortaapp.ru/cabinet**

## 1. Supabase: включить Auth

1. Dashboard → **Authentication** → **Providers** → **Email** → включить
2. **Authentication** → **URL Configuration**:
   - **Site URL:** `https://cortaapp.ru`
   - **Redirect URLs:** добавить `https://cortaapp.ru/cabinet`

3. **Authentication** → **Email Templates** → **Magic Link** — в теле письма ссылка:

```html
<a href="https://cortaapp.ru/cabinet?token_hash={{ .TokenHash }}&type=magiclink">Войти в личный кабинет</a>
```

Так ссылка работает **в любом браузере** (не только там, где запрашивали вход). Альтернатива — стандартная `{{ .ConfirmationURL }}`, но тогда ссылку нужно открывать **в том же браузере**.

SMTP (Яндекс): **Project Settings → Authentication → SMTP Settings**.

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
