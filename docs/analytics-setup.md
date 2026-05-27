# Аналитика Corta: Google Таблица и выход с экрана

## Что пишется в таблицу

| eventType | Когда |
|-----------|--------|
| `funnel_milestone` | Крупный этап: intro, анкета, старт теста, результат, отчёт |
| `app_exit` | Свернул / закрыл Mini App; в колонке **screen** — весь путь по экранам |
| `session_completed` | Завершил тест; в **screen** — путь `intro → … → result` |
| `form_started` / `form_submitted` | Анкета |
| `session_completed` | Завершил все задания |
| `full_report_opened` и др. | Отчёт, оплата |

**Где вышел:** фильтр `eventType = app_exit`, смотрите колонку **`screen`** (полный маршрут через ` → `, не одна строка на каждый шаг теста).

Примеры `screen`:

- `flanker` — задание фланкер
- `result` — первый экран результата
- `result/measured` — «Что мы измерили»
- `result/report-offer` — экран продажи отчёта
- `full-report/report` — платный отчёт

Если на одном `sessionId` несколько `app_exit` — берите **последний** по `timestamp`.

---

## Подключение таблицы (один раз)

### 1. Google Таблица

1. [sheets.google.com](https://sheets.google.com) → новая таблица.
2. **Расширения → Apps Script**.
3. Удалите код по умолчанию, вставьте файл `scripts/google-sheets/Code.gs` из репозитория.
4. Сохраните (Ctrl+S).

### 2. Веб-приложение

1. **Развёртывание → Новое развёртывание**.
2. Тип: **Веб-приложение**.
3. Запуск от: **Я**, доступ: **Все** (Anyone).
4. Скопируйте URL вида `https://script.google.com/macros/s/…/exec`.

### 3. Amvera

В настройках сборки mini app добавьте переменную (при **сборке**, не только в runtime):

```env
VITE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/ВАШ_ID/exec
```

Пересоберите и задеплойте приложение.

**Важно:** Mini App в Telegram **не может** надёжно слать POST напрямую в Google (CORS). События идут через **ваш сервер на Amvera**: `POST /api/sheets-event` → Google. URL берётся из `VITE_SHEETS_WEBHOOK_URL` при сборке (см. `dist/build-info.json`). Опционально дублируйте при запуске: `SHEETS_WEBHOOK_URL` (тот же `/exec`).

Проверка сервера: `GET https://ваш-домен.amvera.io/health` → `"analytics":{"sheetsConfigured":true}`.

**Быстрый тест без Telegram:** откройте в браузере  
`https://ваш-домен.amvera.io/api/sheets-test`  
→ `{"ok":true,...}` и строка `server_test` на листе `events`.

Если `sheetsConfigured: false`, проще всего на Amvera **«Запуск»** добавить  
`SHEETS_WEBHOOK_URL` (тот же `/exec`, что в Google) и **перезапустить** контейнер — без пересборки.

### 4. Проверка

1. Откройте Mini App, пройдите 1–2 экрана, закройте.
2. В таблице на листе **`events`** должны появиться строки `stage_reached` и при закрытии — `app_exit`.

В редакторе Apps Script можно запустить **Run → testAppend** — появится тестовая строка.

---

## Таблица ещё не подключена

События сохраняются в браузере (последние ~80) в `sessionStorage` под ключом `alz_analytics_preview_v1`.

В консоли разработчика (Telegram Desktop / браузер):

```js
JSON.parse(sessionStorage.getItem('alz_analytics_preview_v1'))
```

После настройки `VITE_SHEETS_WEBHOOK_URL` данные пойдут в Google Таблицу автоматически.

---

## Старая таблица без колонок `screen` / `exitReason`

Создайте вручную колонки **E** = `screen`, **F** = `exitReason` после `stage` или создайте новый лист `events` — скрипт при первом запуске на пустой книге создаст заголовки сам.

Полный JSON события всегда дублируется в колонке **`extra`**.
