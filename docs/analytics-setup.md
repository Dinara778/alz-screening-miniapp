# Аналитика Corta: Google Таблица и выход с экрана

## Что пишется в таблицу

| eventType | Когда |
|-----------|--------|
| `stage_reached` | Пользователь открыл экран (`stage`, колонка `screen` — то же) |
| `app_exit` | Свернул / закрыл Mini App (`screen`, `exitReason`) |
| `form_started` / `form_submitted` | Анкета |
| `session_completed` | Завершил все задания |
| `full_report_opened` и др. | Отчёт, оплата |

**Где вышел:** фильтр `eventType = app_exit`, смотрите колонку **`screen`**.

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
