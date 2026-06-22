/**
 * Учёт оплат с сайта (Робокасса и др.) по sessionId — без Telegram user id.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, 'data', 'web-paid.json');

/** @type {Map<string, { product: string, sessionId: string, invId: string, paidAt: number }>} */
const paid = new Map();

function storeKey(sessionId, product) {
  return `${String(sessionId)}:${product}`;
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return;
    const rows = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (row?.key && row?.product && row?.sessionId) paid.set(row.key, row);
    }
  } catch (e) {
    console.warn('[web-paid] load failed', e);
  }
}

function saveStore() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    const rows = [...paid.entries()].map(([key, v]) => ({ key, ...v }));
    fs.writeFileSync(STORE_PATH, JSON.stringify(rows.slice(-5000)));
  } catch (e) {
    console.warn('[web-paid] save failed', e);
  }
}

loadStore();

export function markWebPaid({ sessionId, product, invId = '' }) {
  if (!sessionId || !product) return;
  const key = storeKey(sessionId, product);
  paid.set(key, {
    product,
    sessionId: String(sessionId),
    invId: String(invId),
    paidAt: Date.now(),
  });
  saveStore();
  console.info('[web-paid] saved', key);
}

export function isWebPaidForSession(sessionId, product) {
  if (!sessionId || !product) return { paid: false };
  const key = storeKey(sessionId, product);
  if (paid.has(key)) {
    const row = paid.get(key);
    return { paid: true, product: row.product, sessionId: row.sessionId };
  }
  return { paid: false };
}
