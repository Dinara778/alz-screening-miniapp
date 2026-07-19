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
  return stripEnvQuotes(env[key]).replace(/[\r\n\uFEFF]/g, '');
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
/** Минимальный JSON чека как в примере docs.robokassa.ru/ru/pay-interface */
export function buildRobokassaReceipt({ itemName, amountRub }, env = process.env) {
  const tax = envStr(env, 'ROBOKASSA_RECEIPT_TAX') || 'none';
  const sum = Number(Number(amountRub).toFixed(2));
  const receipt = {
    items: [
      {
        name: String(itemName).slice(0, 128),
        quantity: 1,
        sum,
        tax,
        payment_method: 'full_payment',
        payment_object: 'service',
      },
    ],
  };
  const sno = envStr(env, 'ROBOKASSA_RECEIPT_SNO');
  if (sno) receipt.sno = sno;
  return JSON.stringify(receipt);
}

/**
 * Receipt в подписи — сырой JSON; в URL — encodeURIComponent.
 * (Док-пример с url-encode в подписи для cortaru даёт ошибку 29.)
 */
export function encodeReceiptForUrl(receiptJson) {
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
    parts.push(receiptJson);
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

export function robokassaRegisterOrder({ sessionId, product, amountRub, email = '' }) {
  const minFromTime = Math.floor(Date.now() / 1000);
  if (nextInvId < minFromTime) nextInvId = minFromTime;
  const invId = nextInvId;
  nextInvId += 1;
  const row = {
    invId,
    sessionId: String(sessionId),
    product,
    amountRub,
    email: String(email ?? '').trim().toLowerCase().slice(0, 80),
    createdAt: Date.now(),
  };
  ordersByInvId.set(String(invId), row);
  saveOrders();
  return row;
}

export function robokassaGetOrder(invId) {
  return ordersByInvId.get(String(invId)) ?? null;
}

/** Все локальные счета (для авто-сверки с OpState). */
export function listRobokassaOrders() {
  return [...ordersByInvId.values()];
}

/** Недавние InvId для OpState-probe (unix-счётчик счетов). */
export function listRecentRobokassaInvIdProbes(limit = 100) {
  const ids = [...ordersByInvId.keys()].map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const max = Math.max(nextInvId - 1, Math.floor(Date.now() / 1000), ...ids, 0);
  const out = [];
  for (let i = 0; i < limit; i += 1) {
    const id = max - i;
    if (id > 1_700_000_000) out.push(String(id));
  }
  return out;
}

function robokassaPublicBaseUrl(env = process.env) {
  const raw = envStr(env, 'PAYMENTS_PUBLIC_BASE_URL') || 'https://cortaapp.ru';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, '');
}

/** Авто-возврат на сайт после оплаты (SuccessUrl2 в ссылке на оплату). */
export function buildRobokassaAutoRedirect(
  env = process.env,
  { sessionId, product } = {},
) {
  const base = robokassaPublicBaseUrl(env);
  const returnPath =
    product === 'expert_program_7d' ||
    product === 'subscription_1m' ||
    product === 'subscription_3m'
      ? '/cabinet'
      : '/';
  const success = new URL(`${base}${returnPath}`);
  success.searchParams.set('robokassa', 'success');
  if (sessionId) success.searchParams.set('sessionId', String(sessionId).slice(0, 80));
  if (product) success.searchParams.set('product', String(product));
  const returnUrl = success.toString();
  const failReturnUrl =
    product === 'expert_program_7d' ||
    product === 'subscription_1m' ||
    product === 'subscription_3m'
      ? `${base}/cabinet?robokassa=fail`
      : `${base}/?robokassa=fail`;
  return {
    /** В подписи — сырой URL (не encodeURIComponent), иначе ошибка 29 при фискализации. */
    successUrl2: returnUrl,
    successUrl2Method: 'GET',
    failUrl2: failReturnUrl,
    failUrl2Method: 'GET',
    returnUrl,
    failReturnUrl,
  };
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
      ? 'MerchantLogin:OutSum:InvId:Receipt:SuccessUrl2:SuccessUrl2Method:FailUrl2:FailUrl2Method:Password1[:Shp_*]'
      : 'MerchantLogin:OutSum:InvId:SuccessUrl2:SuccessUrl2Method:FailUrl2:FailUrl2Method:Password1[:Shp_*]',
    password1Md5: pass1 ? md5(pass1) : null,
    docsError29:
      'Неверный SignatureValue — сверьте password1Md5 с md5(Пароль#1), алгоритм хэша и Receipt',
    autoRedirect: buildRobokassaAutoRedirect(env),
  };
}

export function buildRobokassaPaymentUrl(
  { invId, amountRub, description, receiptItemName, sessionId, product, email = '' },
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

  const shp = {};
  if (sessionId) shp.Shp_sessionId = String(sessionId).slice(0, 80);
  if (product) shp.Shp_product = String(product);
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (normalizedEmail.includes('@')) shp.Shp_email = normalizedEmail.slice(0, 80);

  const redirect = buildRobokassaAutoRedirect(env, { sessionId, product });

  const sigBase = buildPaymentSignatureBase({
    login,
    outSum,
    invId,
    pass1,
    receiptJson,
    redirect,
    shp,
  });
  const signatureValue = computeHash(sigBase, hashAlgorithm);

  // SignatureValue — последний параметр (рекомендация Robokassa).
  let qs = appendQueryParam('', 'MerchantLogin', login);
  qs = appendQueryParam(qs, 'OutSum', outSum);
  qs = appendQueryParam(qs, 'InvId', String(invId));
  qs = appendQueryParam(qs, 'Description', String(description).slice(0, 100));
  qs = appendQueryParam(qs, 'Culture', 'ru');
  if (receiptJson) {
    qs = `${qs}&Receipt=${encodeReceiptForUrl(receiptJson)}`;
  }
  if (isRobokassaTestMode(env)) {
    qs = appendQueryParam(qs, 'IsTest', '1');
  }
  for (const key of Object.keys(shp).sort()) {
    qs = appendQueryParam(qs, key, shp[key]);
  }
  // Email не входит в подпись: предзаполняет форму Робокассы и отправку чека покупателю.
  if (normalizedEmail.includes('@')) {
    qs = appendQueryParam(qs, 'Email', normalizedEmail);
  }
  qs = appendQueryParam(qs, 'SuccessUrl2', redirect.returnUrl);
  qs = appendQueryParam(qs, 'SuccessUrl2Method', redirect.successUrl2Method);
  qs = appendQueryParam(qs, 'FailUrl2', redirect.failReturnUrl);
  qs = appendQueryParam(qs, 'FailUrl2Method', redirect.failUrl2Method);
  qs = appendQueryParam(qs, 'SignatureValue', signatureValue);

  return `https://auth.robokassa.ru/Merchant/Index.aspx?${qs}`;
}

/** Проверка подписи Success URL (редирект пользователя после оплаты). Password1. */
export function verifyRobokassaSuccessSignature(body, env = process.env) {
  if (!isRobokassaConfigured(env)) return false;
  const pass1 = envStr(env, 'ROBOKASSA_PASSWORD1');
  const hashAlgorithm = getRobokassaHashAlgorithm(env);
  const outSum = String(body.OutSum ?? body.out_summ ?? '');
  const invId = String(body.InvId ?? body.inv_id ?? '');
  const signatureValue = String(body.SignatureValue ?? body.crc ?? '');
  if (!outSum || !invId || !signatureValue) return false;

  const shp = {};
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('Shp_')) shp[k] = String(v);
  }
  const expected = computeHash(`${outSum}:${invId}:${pass1}${sortedShpSignaturePart(shp)}`, hashAlgorithm);
  return expected.toLowerCase() === signatureValue.toLowerCase();
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
