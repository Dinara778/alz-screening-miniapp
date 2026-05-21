/**
 * Локальная проверка цепочки оплат без Telegram и без реального Prodamus.
 * Запуск: cd server && npm run payment-selftest
 * С .env: подхватит TELEGRAM_BOT_TOKEN и проверит конфиг.
 */
import 'dotenv/config';
import crypto from 'crypto';
import {
  createSignedInitData,
  validateInitData,
} from './telegramInitData.mjs';
import { prodamusCreateSignature, prodamusVerifySignature } from './prodamusHmac.mjs';

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '123456789:TEST_TOKEN_FOR_SELFTEST').trim();
const PROVIDER = (process.env.PAYMENT_PROVIDER || 'prodamus').toLowerCase();

const failures = [];

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
}

console.log('\n=== Payment self-test ===\n');

// 1) Алгоритм initData (главный баг был здесь)
const signed = createSignedInitData(BOT_TOKEN);
if (validateInitData(signed, BOT_TOKEN, { maxAgeSec: 0 })) {
  ok('initData: подпись WebAppData + bot token');
} else {
  fail('initData: подпись не сходится — проверьте telegramInitData.mjs');
}

const wrongKey = crypto.createHmac('sha256', BOT_TOKEN).update('WebAppData').digest();
const badSigned = (() => {
  const params = new URLSearchParams(signed);
  const hash = params.get('hash');
  params.delete('hash');
  const keys = Array.from(params.keys()).sort();
  const dcs = keys.map((k) => `${k}=${params.get(k)}`).join('\n');
  const h = crypto.createHmac('sha256', wrongKey).update(dcs).digest('hex');
  params.set('hash', h);
  return params.toString();
})();
if (!validateInitData(badSigned, BOT_TOKEN, { maxAgeSec: 0 })) {
  ok('initData: ложная подпись отклоняется');
} else {
  fail('initData: ложная подпись принимается');
}

const expired = createSignedInitData(BOT_TOKEN, {
  auth_date: String(Math.floor(Date.now() / 1000) - 90000),
});
if (!validateInitData(expired, BOT_TOKEN)) {
  ok('initData: просроченный auth_date отклоняется');
} else {
  fail('initData: просроченный auth_date принимается');
}

// 2) Prodamus HMAC
const sample = { order_id: 'c_test_1', currency: 'rub', products: [{ name: 'Test', price: 199, quantity: 1 }] };
const sig = prodamusCreateSignature(sample, 'secret');
if (prodamusVerifySignature({ ...sample, signature: sig }, 'secret', sig)) {
  ok('Prodamus: подпись запроса/вебхука');
} else {
  fail('Prodamus: подпись не сходится');
}

// 3) Переменные окружения (как на Amvera «Запуск»)
console.log('\n--- Env (runtime) ---\n');
const runtime = {
  TELEGRAM_BOT_TOKEN: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
  PAYMENT_PROVIDER: PROVIDER,
  PRODAMUS_FORM_URL: Boolean(process.env.PRODAMUS_FORM_URL?.trim()),
  PRODAMUS_SECRET_KEY: Boolean(process.env.PRODAMUS_SECRET_KEY?.trim()),
  TELEGRAM_MINI_APP_URL: Boolean(process.env.TELEGRAM_MINI_APP_URL?.trim()),
  PAYMENTS_PUBLIC_BASE_URL: Boolean(process.env.PAYMENTS_PUBLIC_BASE_URL?.trim()),
  SERVE_STATIC: process.env.SERVE_STATIC === 'true',
  PORT: process.env.PORT || '8787',
};

for (const [k, v] of Object.entries(runtime)) {
  if (v === false || v === '') fail(`${k}: не задан`);
  else ok(`${k}: ${typeof v === 'string' ? v : 'ok'}`);
}

if (PROVIDER === 'prodamus') {
  const base = process.env.PAYMENTS_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  const mini = process.env.TELEGRAM_MINI_APP_URL?.trim().replace(/\/$/, '');
  if (base && mini && base !== mini) {
    fail('PAYMENTS_PUBLIC_BASE_URL и TELEGRAM_MINI_APP_URL должны совпадать');
  } else if (base && mini) {
    ok('домены PAYMENTS_PUBLIC_BASE_URL = TELEGRAM_MINI_APP_URL');
  }
  if (base && !/^https:\/\//i.test(base)) {
    fail('PAYMENTS_PUBLIC_BASE_URL должен быть https://');
  }
}

console.log('\n--- Build-time (Vite, этап «Сборка» Amvera) ---\n');
console.log('  (проверяется только при npm run build в CI/Amvera)');
console.log('  VITE_PAYMENTS_ENABLED=true');
console.log('  VITE_TELEGRAM_PAYMENTS_URL=https://ваш-домен.amvera.io');

if (failures.length) {
  console.log(`\nИтого: ${failures.length} ошибок\n`);
  process.exit(1);
}
console.log('\nИтого: все проверки пройдены.\n');
console.log('После деплоя откройте: https://ваш-домен/health/payments\n');
