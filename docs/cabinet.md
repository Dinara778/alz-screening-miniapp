# Личный кабинет Corta

Вход по **коду из email** (Supabase OTP) — без пароля.

URL: **https://cortaapp.ru/cabinet**

## 1. Supabase: включить Auth

1. Dashboard → **Authentication** → **Providers** → **Email** → включить
2. **Authentication** → **URL Configuration**:
   - **Site URL:** `https://cortaapp.ru`
   - **Redirect URLs:** добавить `https://cortaapp.ru/cabinet`

3. **Authentication** → **Email Templates** → **Magic Link** — тело письма с **кодом** (не ссылкой):

```text
Ваш код для входа в Corta: {{ .Token }}

Код действует ограниченное время. Если вы не запрашивали вход — проигнорируйте письмо.
```

Тема письма, например: `Код для входа в Corta`.

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
3. Получить письмо с **6-значным кодом**
4. Ввести код на экране → «Войти»

## 5. Имя отправителя «Corta»

| Вариант | Имя «от кого» | Нужен SMTP? |
|--------|----------------|-------------|
| Стандартная почта Supabase | Обычно «Supabase» / технический адрес | Нет |
| Свой SMTP (Resend и т.д.) | **Corta**, `noreply@cortaapp.ru` | Да |

Без SMTP изменить имя отправителя на **Corta** почти нельзя — только тема/текст письма (и то после настройки SMTP в Supabase).
