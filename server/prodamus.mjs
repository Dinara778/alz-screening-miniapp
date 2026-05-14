import { prodamusCreateSignature } from './prodamusHmac.mjs';

/** order_id -> { product, sessionId, tgUserId, status, createdAt } */
const orders = new Map();

const ORDER_TTL_MS = 48 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, o] of orders) {
    if (now - o.createdAt > ORDER_TTL_MS) orders.delete(id);
  }
}, 60 * 60 * 1000).unref?.();

export function prodamusRegisterPendingOrder(orderId, { product, sessionId, tgUserId }) {
  orders.set(orderId, {
    product,
    sessionId: String(sessionId).slice(0, 80),
    tgUserId,
    status: 'pending',
    createdAt: Date.now(),
  });
}

export function prodamusMarkOrderPaid(orderId) {
  const o = orders.get(orderId);
  if (!o) return false;
  o.status = 'paid';
  o.paidAt = Date.now();
  orders.set(orderId, o);
  return true;
}

/** Оплачен ли заказ этим пользователем Telegram (без раскрытия чужих заказов). */
export function prodamusOrderPaidForUser(orderId, tgUserId) {
  if (!orderId || tgUserId == null) return { paid: false };
  const o = orders.get(orderId);
  if (!o || o.tgUserId !== tgUserId) return { paid: false };
  if (o.status !== 'paid') return { paid: false };
  return { paid: true, product: o.product, sessionId: o.sessionId };
}

/**
 * Собирает query string в стиле PHP http_build_query для плоских ключей и products[i][k].
 */
function buildPayformQuery(payload) {
  const parts = [];
  const rootKeys = Object.keys(payload).sort();
  for (const k of rootKeys) {
    const v = payload[k];
    if (v === undefined || v === null) continue;
    if (k === 'products' && Array.isArray(v)) {
      v.forEach((p, i) => {
        if (!p || typeof p !== 'object') return;
        const subKeys = Object.keys(p).sort();
        for (const sk of subKeys) {
          const pv = p[sk];
          if (pv === undefined || pv === null) continue;
          const key = `products[${i}][${sk}]`;
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(pv))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}

/**
 * Запрос do=link к payform.ru; в ответе — текстовая ссылка на оплату.
 */
export async function prodamusCreatePaymentLink({
  formUrl,
  secretKey,
  sys,
  orderId,
  products,
  urlSuccess,
  urlReturn,
  urlNotification,
}) {
  const base = String(formUrl).trim().replace(/\/?$/, '/');
  const data = {
    do: 'link',
    currency: 'rub',
    order_id: orderId,
    products,
    urlSuccess,
    urlReturn,
    urlNotification,
    ...(sys ? { sys } : {}),
  };
  const signature = prodamusCreateSignature(data, secretKey);
  const query = buildPayformQuery({ ...data, signature });
  const res = await fetch(`${base}?${query}`, { method: 'GET' });
  const text = (await res.text()).trim();
  if (!res.ok) {
    throw new Error(`Prodamus HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!/^https?:\/\//i.test(text)) {
    throw new Error(`Prodamus: ожидалась ссылка, получено: ${text.slice(0, 120)}`);
  }
  return text;
}
