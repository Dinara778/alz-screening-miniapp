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

## 1.1. SMTP — важно для Gmail, Mail.ru и др.

Коды входа отправляет **Supabase**, не сервер Corta. Если работает только `@yandex.ru` — проблема в **SMTP в Supabase**, не в приложении.

Проверка: Supabase → **Authentication** → **Logs** — при ошибке будет `Error sending confirmation email`.

### Почему Яндекс SMTP не подходит для всех

`smtp.yandex.ru` с личного ящика часто:
- нормально доставляет на **другие ящики Яндекса**;
- **не отправляет** или не доходит до Gmail, Mail.ru, Outlook (лимиты, антиспам, политика SMTP).

### Рекомендуется: Resend + домен cortaapp.ru

Пошагово: **[docs/resend.md](./resend.md)**. Кратко:

1. Зарегистрируйтесь на [resend.com](https://resend.com).
2. **Domains** → добавьте `cortaapp.ru` → пропишите DNS-записи (SPF, DKIM) у регистратора домена.
3. Supabase → **Project Settings** → **Authentication** → **SMTP Settings** → включить Custom SMTP:

| Поле | Значение |
|------|----------|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) или `587` (TLS) |
| Username | `resend` |
| Password | API-ключ из Resend (`re_...`) |
| Sender email | `noreply@cortaapp.ru` (или другой на вашем домене) |
| Sender name | `Corta` |

4. Сохраните, запросите код на Gmail — проверьте **Входящие** и **Спам**.
5. Шаблон **Magic Link** по-прежнему с `{{ .Token }}`.

### Если пока остаётесь на Яндекс SMTP

- **Project Settings → Authentication → SMTP**: `smtp.yandex.ru`, порт `465`, логин — полный email, пароль — **пароль приложения** (тип «Почта»), IMAP включён в настройках Яндекс.Почты.
- Для Gmail/Mail.ru надёжной доставки **не будет** — нужен Resend или аналог (SendGrid, Mailgun, Amazon SES) с доменом.

### Длина кода 6 vs 8 цифр

**Authentication** → **Providers** → **Email** → **OTP length** → `6` → **Save** → запросите **новый** код (старые письма не меняются). Если в письме всё ещё 8 — введите все 8 цифр; приложение принимает 6–10.

## 2. SQL-миграция

В SQL Editor выполните `supabase/migrations/004_cabinet.sql`.

## 3. Переменные Amvera

**Сборка:**

```env
VITE_SUPABASE_URL=https://....supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # anon public, тот же что SUPABASE_ANON_KEY
```

**Запуск:**

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # только сервер, секретный
SUPABASE_ANON_KEY=eyJ...        # anon public из Supabase → API (НЕ service_role!)
```

В Supabase: **Project Settings → API** → скопируйте **anon public**, не **service_role**.

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
