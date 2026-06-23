/**
 * Робокасса: ссылка на оплату и проверка Result URL.
 * @see https://docs.robokassa.ru/ru/pay-interface/
 * @see https://docs.robokassa.ru/ru/fiscalization/
 * Подпись: MerchantLogin:OutSum:InvId[:Receipt]:Пароль#1[:Shp_key=value…]
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

function stripEnvQuotes(raw) {
  const t = String(raw ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function envStr(env, key) {
  return stripEnvQuotes(env[key]);
}

function md5(text) {
  return crypto.createHash('md5').update(String(text), 'utf8').digest('hex');
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function computeHash(text, algorithm = 'MD5') {
  const algo = String(algorithm).toUpperCase();
  if (algo === 'SHA256' || algo === 'SHA-256') return sha256(text);
  return md5(text);
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
    envStr(env, 'ROBOKASSA_MERCHANT_LOGIN') &&
      envStr(env, 'ROBOKASSA_PASSWORD1') &&
      envStr(env, 'ROBOKASSA_PASSWORD2'),
  );
}

export function isRobokassaTestMode(env = process.env) {
  const v = envStr(env, 'ROBOKASSA_IS_TEST');
  return v === 'true' || v === '1';
}

export function getRobokassaHashAlgorithm(env = process.env) {
  const raw = envStr(env, 'ROBOKASSA_HASH_ALGORITHM') || 'MD5';
  return raw.toUpperCase() === 'SHA256' || raw.toUpperCase() === 'SHA-256' ? 'SHA256' : 'MD5';
}

export function isRobokassaReceiptEnabled(env = process.env) {
  const v = envStr(env, 'ROBOKASSA_RECEIPT_ENABLED');
  if (v === '0' || v === 'false') return false;
  return true;
}

/** Shp_* из callback — в подписи строго по алфавиту, формат :Shp_key=value */
function sortedShpSignaturePart(params) {
  const keys = Object.keys(params)
    .filter((k) => k.startsWith('Shp_'))
    .sort();
  if (!keys.length) return '';
  return `:${keys.map((k) => `${k}=${params[k]}`).join(':')}`;
}

/**
 * Фискальный чек (54-ФЗ). Без Receipt при включённой фискализации в кабинете — ошибка 29.
 * @see https://docs.robokassa.ru/ru/fiscalization/
 */
export function buildRobokassaReceipt({ itemName, amountRub }, env = process.env) {
  const sno = envStr(env, 'ROBOKASSA_RECEIPT_SNO') || 'usn_income';
  const tax = envStr(env, 'ROBOKASSA_RECEIPT_TAX') || 'none';
  const sum = Number(Number(amountRub).toFixed(2));
  return JSON.stringify({
    sno,
    items: [
      {
        name: String(itemName).slice(0, 128),
        quantity: 1,
        sum,
        payment_method: 'full_payment',
        payment_object: 'service',
        tax,
      },
    ],
  });
}

/**
 * Receipt в URL и в подписи — один и тот же encodeURIComponent (%20 для пробелов).
 * @see https://docs.robokassa.ru/ru/pay-interface/
 */
export function encodeReceiptForSignature(receiptJson) {
  return encodeURIComponent(receiptJson);
}

function appendQueryParam(qs, key, value) {
  const enc = encodeURIComponent(String(value));
  return qs ? `${qs}&${key}=${enc}` : `${key}=${enc}`;
}

/**
 * Строка для SignatureValue при инициализации оплаты.
 * Модификаторы строго по порядку: Receipt → SuccessUrl2 → SuccessUrl2Method → FailUrl2 → FailUrl2Method.
 */
export function buildPaymentSignatureBase({
  login,
  outSum,
  invId,
  pass1,
  receiptJson = '',
  redirect = null,
  shp = {},
}) {
  const parts = [login, outSum, String(invId)];
  if (receiptJson) {
    parts.push(encodeReceiptForSignature(receiptJson));
  }
  if (redirect) {
    parts.push(
      redirect.successUrl2,
      redirect.successUrl2Method,
      redirect.failUrl2,
      redirect.failUrl2Method,
    );
  }
  parts.push(pass1);
  return `${parts.join(':')}${sortedShpSignaturePart(shp)}`;
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
  const login = envStr(env, 'ROBOKASSA_MERCHANT_LOGIN');
  const pass1 = envStr(env, 'ROBOKASSA_PASSWORD1');
  const pass2 = envStr(env, 'ROBOKASSA_PASSWORD2');
  const receiptEnabled = isRobokassaReceiptEnabled(env);
  const hashAlgorithm = getRobokassaHashAlgorithm(env);
  return {
    configured: isRobokassaConfigured(env),
    merchantLogin: login || null,
    password1Length: pass1.length,
    password2Length: pass2.length,
    isTestMode: isRobokassaTestMode(env),
    hashAlgorithm,
    receiptEnabled,
    receiptSno: envStr(env, 'ROBOKASSA_RECEIPT_SNO') || 'usn_income',
    receiptTax: envStr(env, 'ROBOKASSA_RECEIPT_TAX') || 'none',
    paymentSignatureFormula: receiptEnabled
      ? 'MerchantLogin:OutSum:InvId:Receipt(uri-encode):Password1:Shp_product:Shp_sessionId'
      : 'MerchantLogin:OutSum:InvId:Password1:Shp_product:Shp_sessionId',
    docsError29:
      'Неверный SignatureValue — проверьте Пароль#1, алгоритм хэша (MD5) и Receipt при фискализации',
  };
}

export function buildRobokassaPaymentUrl(
  { invId, amountRub, description, receiptItemName, sessionId, product },
  env = process.env,
) {
  if (!isRobokassaConfigured(env)) {
    throw new Error('ROBOKASSA не настроена');
  }
  const login = envStr(env, 'ROBOKASSA_MERCHANT_LOGIN');
  const pass1 = envStr(env, 'ROBOKASSA_PASSWORD1');
  const outSum = Number(amountRub).toFixed(2);
  const hashAlgorithm = getRobokassaHashAlgorithm(env);
  const receiptEnabled = isRobokassaReceiptEnabled(env);
  const receiptJson = receiptEnabled
    ? buildRobokassaReceipt({ itemName: receiptItemName || description, amountRub }, env)
    : '';

  // Shp_* возвращаются на SuccessURL из настроек кабинета (без SuccessUrl2 в подписи).
  const shp = {
    Shp_product: String(product),
    Shp_sessionId: String(sessionId),
  };

  const sigBase = buildPaymentSignatureBase({
    login,
    outSum,
    invId,
    pass1,
    receiptJson,
    shp,
  });
  const signatureValue = computeHash(sigBase, hashAlgorithm);

  let qs = appendQueryParam('', 'MerchantLogin', login);
  qs = appendQueryParam(qs, 'OutSum', outSum);
  qs = appendQueryParam(qs, 'InvId', String(invId));
  qs = appendQueryParam(qs, 'Description', String(description).slice(0, 100));
  qs = appendQueryParam(qs, 'SignatureValue', signatureValue);
  qs = appendQueryParam(qs, 'Shp_product', shp.Shp_product);
  qs = appendQueryParam(qs, 'Shp_sessionId', shp.Shp_sessionId);
  if (receiptJson) {
    qs = `${qs}&Receipt=${encodeReceiptForSignature(receiptJson)}`;
  }
  if (isRobokassaTestMode(env)) {
    qs = appendQueryParam(qs, 'IsTest', '1');
  }

  return `https://auth.robokassa.ru/Merchant/Index.aspx?${qs}`;
}

/** Проверка подписи Result URL (POST/GET от Робокассы). */
export function verifyRobokassaResultSignature(body, env = process.env) {
  if (!isRobokassaConfigured(env)) return false;
  const pass2 = envStr(env, 'ROBOKASSA_PASSWORD2');
  const hashAlgorithm = getRobokassaHashAlgorithm(env);
  const outSum = String(body.OutSum ?? body.out_summ ?? '');
  const invId = String(body.InvId ?? body.inv_id ?? '');
  const signatureValue = String(body.SignatureValue ?? body.crc ?? '');
  if (!outSum || !invId || !signatureValue) return false;

  const shp = {};
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('Shp_')) shp[k] = String(v);
  }
  const expected = computeHash(`${outSum}:${invId}:${pass2}${sortedShpSignaturePart(shp)}`, hashAlgorithm);
  return expected.toLowerCase() === signatureValue.toLowerCase();
}
