/**
 * Робокасса: ссылка на оплату и проверка Result URL.
 * @see https://docs.robokassa.ru/
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORDERS_FILE = path.join(__dirname, 'data', 'robokassa-orders.json');

/** @type {Map<string, { invId: number, sessionId: string, product: string, amountRub: number, createdAt: number }>} */
const ordersByInvId = new Map();
let nextInvId = 1;

function md5(text) {
  return crypto.createHash('md5').update(String(text), 'utf8').digest('hex');
}

function loadOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    if (Array.isArray(data.orders)) {
      for (const row of data.orders) {
        if (row?.invId != null) ordersByInvId.set(String(row.invId), row);
      }
    }
    if (typeof data.nextInvId === 'number' && data.nextInvId > nextInvId) {
      nextInvId = data.nextInvId;
    }
  } catch (e) {
    console.warn('[robokassa] load orders failed', e);
  }
}

function saveOrders() {
  try {
    fs.mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
    fs.writeFileSync(
      ORDERS_FILE,
      JSON.stringify({
        nextInvId,
        orders: [...ordersByInvId.values()].slice(-5000),
      }),
    );
  } catch (e) {
    console.warn('[robokassa] save orders failed', e);
  }
}

loadOrders();

export function isRobokassaConfigured(env = process.env) {
  return Boolean(
    env.ROBOKASSA_MERCHANT_LOGIN?.trim() &&
      env.ROBOKASSA_PASSWORD1?.trim() &&
      env.ROBOKASSA_PASSWORD2?.trim(),
  );
}

function sortedShpSignaturePart(params) {
  const keys = Object.keys(params)
    .filter((k) => k.startsWith('Shp_'))
    .sort();
  if (!keys.length) return '';
  return `:${keys.map((k) => `${k}=${params[k]}`).join(':')}`;
}

export function robokassaRegisterOrder({ sessionId, product, amountRub }) {
  const invId = nextInvId;
  nextInvId += 1;
  const row = {
    invId,
    sessionId: String(sessionId),
    product,
    amountRub,
    createdAt: Date.now(),
  };
  ordersByInvId.set(String(invId), row);
  saveOrders();
  return row;
}

export function robokassaGetOrder(invId) {
  return ordersByInvId.get(String(invId)) ?? null;
}

export function buildRobokassaPaymentUrl({ invId, amountRub, description, sessionId, product }, env = process.env) {
  if (!isRobokassaConfigured(env)) {
    throw new Error('ROBOKASSA не настроена');
  }
  const login = env.ROBOKASSA_MERCHANT_LOGIN.trim();
  const pass1 = env.ROBOKASSA_PASSWORD1.trim();
  const outSum = Number(amountRub).toFixed(2);
  const shp = {
    Shp_sessionId: String(sessionId).slice(0, 64),
    Shp_product: String(product).slice(0, 32),
  };
  const sigBase = `${login}:${outSum}:${invId}:${pass1}${sortedShpSignaturePart(shp)}`;
  const signatureValue = md5(sigBase);

  const params = new URLSearchParams({
    MerchantLogin: login,
    OutSum: outSum,
    InvId: String(invId),
    Description: String(description).slice(0, 100),
    SignatureValue: signatureValue,
    ...shp,
  });
  if (env.ROBOKASSA_IS_TEST === 'true' || env.ROBOKASSA_IS_TEST === '1') {
    params.set('IsTest', '1');
  }

  const publicBase = (env.PAYMENTS_PUBLIC_BASE_URL || env.TELEGRAM_MINI_APP_URL || '').trim().replace(/\/$/, '');
  if (publicBase) {
    const returnQs = new URLSearchParams({
      robokassa: 'success',
      sessionId: String(sessionId),
      product: String(product),
    });
    params.set('SuccessURL', `${publicBase}/?${returnQs}`);
    params.set('FailURL', `${publicBase}/?robokassa=fail`);
  }

  return `https://auth.robokassa.ru/Merchant/Index.aspx?${params}`;
}

/** Проверка подписи Result URL (POST/GET от Робокассы). */
export function verifyRobokassaResultSignature(body, env = process.env) {
  if (!isRobokassaConfigured(env)) return false;
  const pass2 = env.ROBOKASSA_PASSWORD2.trim();
  const outSum = String(body.OutSum ?? body.out_summ ?? '');
  const invId = String(body.InvId ?? body.inv_id ?? '');
  const signatureValue = String(body.SignatureValue ?? body.crc ?? '');
  if (!outSum || !invId || !signatureValue) return false;

  const shp = {};
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('Shp_')) shp[k] = String(v);
  }
  const expected = md5(`${outSum}:${invId}:${pass2}${sortedShpSignaturePart(shp)}`);
  return expected.toLowerCase() === signatureValue.toLowerCase();
}
