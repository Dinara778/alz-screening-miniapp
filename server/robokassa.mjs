/**
 * Робокасса: ссылка на оплату и проверка Result URL.
 * @see https://docs.robokassa.ru/ru/pay-interface/
 * Подпись оплаты: MerchantLogin:OutSum:InvId:Пароль#1[:Shp_key=value…]
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

export function isRobokassaTestMode(env = process.env) {
  return env.ROBOKASSA_IS_TEST === 'true' || env.ROBOKASSA_IS_TEST === '1';
}

/** Shp_* из callback — в подписи строго по алфавиту, формат :Shp_key=value */
function sortedShpSignaturePart(params) {
  const keys = Object.keys(params)
    .filter((k) => k.startsWith('Shp_'))
    .sort();
  if (!keys.length) return '';
  return `:${keys.map((k) => `${k}=${params[k]}`).join(':')}`;
}

/** Строка для SignatureValue при инициализации оплаты (без Shp — sessionId храним по InvId). */
export function buildPaymentSignatureBase({ login, outSum, invId, pass1, shp = {} }) {
  return `${login}:${outSum}:${invId}:${pass1}${sortedShpSignaturePart(shp)}`;
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

export function getRobokassaHealthInfo(env = process.env) {
  const login = env.ROBOKASSA_MERCHANT_LOGIN?.trim() || '';
  const pass1 = env.ROBOKASSA_PASSWORD1?.trim() || '';
  const pass2 = env.ROBOKASSA_PASSWORD2?.trim() || '';
  return {
    configured: isRobokassaConfigured(env),
    merchantLogin: login || null,
    password1Length: pass1.length,
    password2Length: pass2.length,
    isTestMode: isRobokassaTestMode(env),
    hashAlgorithm: 'MD5',
    paymentSignatureFormula: 'MerchantLogin:OutSum:InvId:Password1',
    docsError29:
      'Неверный SignatureValue — проверьте MerchantLogin, Пароль#1 и формулу подписи (docs.robokassa.ru/ru/pay-interface/#errors)',
  };
}

export function buildRobokassaPaymentUrl({ invId, amountRub, description, sessionId, product }, env = process.env) {
  if (!isRobokassaConfigured(env)) {
    throw new Error('ROBOKASSA не настроена');
  }
  const login = env.ROBOKASSA_MERCHANT_LOGIN.trim();
  const pass1 = env.ROBOKASSA_PASSWORD1.trim();
  const outSum = Number(amountRub).toFixed(2);
  // Без Shp_* в ссылке: заказ уже привязан к InvId на сервере (см. docs — меньше риска ошибки 29).
  const sigBase = buildPaymentSignatureBase({ login, outSum, invId, pass1 });
  const signatureValue = md5(sigBase);

  const params = new URLSearchParams({
    MerchantLogin: login,
    OutSum: outSum,
    InvId: String(invId),
    Description: String(description).slice(0, 100),
    SignatureValue: signatureValue,
  });
  if (isRobokassaTestMode(env)) {
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
