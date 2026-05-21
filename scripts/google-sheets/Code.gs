/**
 * Google Apps Script для Corta Mini App
 *
 * 1. Создайте Google Таблицу
 * 2. Расширения → Apps Script → вставьте этот код
 * 3. Развёртывание → Новое → Веб-приложение:
 *    - Запуск от: Я
 *    - Доступ: Все (Anyone)
 * 4. Скопируйте URL …/exec в VITE_SHEETS_WEBHOOK_URL при сборке Amvera
 */

const SHEET_NAME = 'events';

function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    appendRow_(body);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/** Тест из редактора: Run → testAppend */
function testAppend() {
  appendRow_({
    eventType: 'test',
    sessionId: 'manual-test',
    stage: 'debug',
    timestamp: new Date().toISOString(),
    participant: { name: 'Тест', email: 'test@example.com' },
  });
}

function appendRow_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'timestamp',
      'eventType',
      'sessionId',
      'stage',
      'name',
      'email',
      'phone',
      'sex',
      'age',
      'status',
      'indexFlags',
      'extra',
    ]);
  }

  const p = data.participant || {};
  const row = [
    data.timestamp || new Date().toISOString(),
    data.eventType || '',
    data.sessionId || data.id || '',
    data.stage || '',
    p.name || '',
    p.email || '',
    p.phone || '',
    p.sex || '',
    p.age != null ? p.age : '',
    data.status || data.riskLevel || '',
    data.flags != null ? data.flags : '',
    JSON.stringify(data).slice(0, 45000),
  ];
  sheet.appendRow(row);
}
