# Resend — почта Corta

Два места с **одним** API-ключом Resend:

| Куда | Зачем |
|------|--------|
| **Supabase → Custom SMTP** | Коды входа в `/cabinet` |
| **Amvera → `SMTP_*`** | Письма с сервера (заявка на разбор и т.п.) |

## 1. Resend + домен

1. Аккаунт на [resend.com](https://resend.com).
2. **Domains** → Add Domain → `cortaapp.ru`.
3. У регистратора DNS добавьте записи, которые покажет Resend (DKIM, SPF, иногда MX/DMARC).
4. Дождитесь статуса **Verified**.
5. **API Keys** → Create → скопируйте ключ `re_...`.

Пока домен не верифицирован, можно тестировать с `onboarding@resend.dev` → только на свой email в Resend (не для продакшена).

## 2. Supabase (коды кабинета)

**Project Settings** → **Authentication** → **SMTP Settings** → Enable Custom SMTP:

| Поле | Значение |
|------|----------|
| Host | `smtp.resend.com` |
| Port Number | `465` |
| Username | `resend` |
| Password | `re_...` (API key) |
| Sender email | `noreply@cortaapp.ru` |
| Sender name | `Corta` |
| Minimum interval | `60` (или по умолчанию) |

Сохраните. Шаблон письма: **Authentication** → **Email Templates** → **Magic Link** — с кодом `{{ .Token }}` (см. `docs/cabinet.md`).

Проверка: `/cabinet` → свой Gmail → письмо от Corta. Смотрите также **Authentication → Logs**.

## 3. Amvera (сервер Corta)

**Запуск** → переменные окружения:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_...
SMTP_FROM=Corta <noreply@cortaapp.ru>
CONSULTATION_LEAD_TO=hello@bookvolon.ru
```

Пересоберите / перезапустите приложение на Amvera.

## 4. Частые ошибки

- Письма только на Яндекс, не на Gmail → старый Яндекс SMTP; нужен Resend с доменом.
- `550` / domain not verified → DNS ещё не подтверждён в Resend.
- Код не приходит → Auth Logs в Supabase + Resend → **Emails** / **Logs**.
