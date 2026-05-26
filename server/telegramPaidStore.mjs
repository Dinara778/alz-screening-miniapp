/**
 * Учёт успешных оплат Telegram Payments (ЮKassa).
 * Нужен, если Mini App перезапустился до callback openInvoice('paid').
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, 'data', 'telegram-paid.json');

/** @type {Map<string, { product: string, sessionId: string, tgUserId: number, paidAt: number, payload: string }>} */
const paid = new Map();

function storeKey(tgUserId, sessionId, product) {
  return `${tgUserId}:${sessionId}:${product}`;
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return;
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (row?.key && row?.product && row?.sessionId != null && row?.tgUserId != null) {
        paid.set(row.key, row);
      }
    }
  } catch (e) {
    console.warn('[telegram-paid] load failed', e);
  }
}

function saveStore() {
  try {
    const dir = path.dirname(STORE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    const rows = [...paid.entries()].map(([key, v]) => ({ key, ...v }));
    fs.writeFileSync(STORE_PATH, JSON.stringify(rows.slice(-5000)));
  } catch (e) {
    console.warn('[telegram-paid] save failed', e);
  }
}

loadStore();

/** payload от createInvoiceLink: "full_report:sessionId:timestamp" */
export function parseInvoicePayload(payload) {
  const raw = String(payload ?? '').trim();
  if (!raw) return null;
  const parts = raw.split(':');
  if (parts.length < 2) return null;
  const product = parts[0];
  const sessionId = parts[1];
  if (!product || !sessionId) return null;
  return { product, sessionId };
}

export function markTelegramPaid({ tgUserId, sessionId, product, payload = '' }) {
  if (tgUserId == null || !sessionId || !product) return;
  const key = storeKey(tgUserId, sessionId, product);
  paid.set(key, {
    product,
    sessionId: String(sessionId),
    tgUserId: Number(tgUserId),
    paidAt: Date.now(),
    payload: String(payload),
  });
  saveStore();
  console.info('[telegram-paid] saved', key);
}

export function isTelegramPaidForUser(tgUserId, sessionId, product) {
  if (tgUserId == null || !sessionId || !product) return { paid: false };
  const key = storeKey(tgUserId, sessionId, product);
  if (paid.has(key)) {
    const row = paid.get(key);
    return { paid: true, product: row.product, sessionId: row.sessionId };
  }
  return { paid: false };
}
