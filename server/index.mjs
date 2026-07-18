/**
 * Минимальный сервер для Telegram Mini App + нативная оплата.
 *
 * 1) Заполните .env по образцу .env.example
 * 2) npm install && npm start
 * 3) Выставьте вебхук бота на POST /webhook этого сервера (HTTPS):
 *    https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain/webhook
 *    Без вебхука команда /start не доходит до сервера — ответа с кнопкой не будет.
 * 4) Задайте TELEGRAM_MINI_APP_URL — тот же HTTPS URL мини-приложения, что в @BotFather (Mini App).
 * 5) Во фронте укажите VITE_TELEGRAM_PAYMENTS_URL=https://your-domain (без /webhook)
 *
 * Оплата Prodamus: PAYMENT_PROVIDER=prodamus, PRODAMUS_FORM_URL, PRODAMUS_SECRET_KEY,
 * PAYMENTS_PUBLIC_BASE_URL (HTTPS этого сервера, как у VITE_TELEGRAM_PAYMENTS_URL), вебхук POST /prodamus/notify.
 * Документация: https://help.prodamus.ru/payform/integracii/rest-api/instrukcii-dlya-samostoyatelnaya-integracii-servisov
 *
 * Заявка на разбор: POST /consultation-lead (initData + consultationEmail) → письмо на CONSULTATION_LEAD_TO
 * при настроенном SMTP, и/или сообщение в TELEGRAM_ADMIN_CHAT_ID. См. server/.env.example
 *
 * Документация: https://core.telegram.org/bots/webapps
 * createInvoiceLink: https://core.telegram.org/bots/api#createinvoicelink
 */
import 'dotenv/config';
import crypto from 'crypto';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import {
  ensureTelegramWebhook,
  isStartCommand,
  resolveWebhookUrl,
  sendStartMessage,
} from './botStart.mjs';
import {
  prodamusRegisterPendingOrder,
  prodamusCreatePaymentLink,
  prodamusMarkOrderPaid,
  prodamusOrderPaidForUser,
  prodamusConfirmReturnForUser,
  prodamusFindPaidForUserSession,
} from './prodamus.mjs';
import { prodamusVerifySignature } from './prodamusHmac.mjs';
import { buildTelegramYookassaInvoiceParams } from './yookassaReceipt.mjs';
import { createPaymentAnalytics } from './paymentAnalytics.mjs';
import {
  buildRobokassaPaymentUrl,
  getRobokassaHealthInfo,
  isRobokassaConfigured,
  robokassaGetOrder,
  robokassaRegisterOrder,
  verifyRobokassaResultSignature,
  verifyRobokassaSuccessSignature,
} from './robokassa.mjs';
import { isWebPaidForSession, markWebPaid } from './webPaidStore.mjs';
import {
  extractAdminPassword,
  getAdminDashboardHealthInfo,
  getDashboardStats,
  isAdminDashboardConfigured,
  parseDashboardPeriod,
  repairPaymentAmountsFromCatalog,
  verifyAdminPassword,
} from './dashboardStore.mjs';
import { importSheetsCsvText } from './sheetsCsvImport.mjs';
import {
  getCabinetData,
  getCabinetParticipantProfile,
  getCabinetReportSession,
  getCabinetHealthInfo,
  isCabinetConfigured,
  verifySupabaseAccessToken,
  cancelCabinetSubscription,
} from './cabinetStore.mjs';
import { requestCabinetOtp, verifyCabinetOtp, refreshCabinetSession } from './cabinetOtp.mjs';
import {
  getSupabaseHealthInfo,
  getPublicSupabaseConfig,
  isSupabaseConfigured,
  recordPayment,
  findPaidProductPayment,
  reassignPaidPaymentSession,
  upsertAssessment,
  upsertFunnelSession,
  activateSubscription,
  findActiveSubscriptionByEmail,
  isSubscriptionProduct,
  subscriptionDaysForProduct,
} from './supabaseStore.mjs';
import {
  findLatestTelegramPaidForUser,
  isTelegramPaidForUser,
  markTelegramPaid,
  parseInvoicePayload,
} from './telegramPaidStore.mjs';
import { createResolveWebPaymentRecovery } from './paymentRecovery.mjs';

function normalizeBotToken(raw) {
  const t = String(raw ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

const BOT_TOKEN = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
const PROVIDER_TOKEN = process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN;
const PORT = Number(process.env.PORT) || 8787;
function resolvePaymentProvider() {
  const raw = (process.env.PAYMENT_PROVIDER || 'auto').toLowerCase();
  if (raw === 'off' || raw === 'disabled' || raw === 'none') return 'none';

  // Единственный поддерживаемый способ оплаты — Робокасса (сайт + Mini App через redirect).
  // Telegram Payments / ЮKassa / Prodamus отключены намеренно.
  if (isRobokassaConfigured(process.env)) return 'robokassa';

  if (raw === 'robokassa') return 'robokassa'; // конфиг ещё неполный — отдаст 503 в /invoice*
  return 'none';
}

const PAYMENT_PROVIDER = resolvePaymentProvider();

/** Названия для чека (Telegram title ≤ 32 символа). amount — копейки для Telegram; priceRub — для Prodamus. */
const PRODUCTS = {
  full_report: {
    title: 'Расширенный отчёт Corta',
    description:
      'Расширенный отчёт: интерпретация метрик и персональные рекомендации',
    amount: 14900,
    priceRub: 149,
  },
  subscription_1m: {
    title: 'Подписка Corta 1 мес',
    description: 'Подписка Corta: сравнение изменений, полные отчёты и практика',
    amount: 49900,
    priceRub: 499,
  },
  subscription_3m: {
    title: 'Подписка Corta 3 мес',
    description: 'Подписка Corta на 3 месяца: полный разбор и история',
    amount: 99000,
    priceRub: 990,
  },
  consultation: {
    title: 'Сессия с экспертом Corta',
    description: 'Персональная сессия 30–40 минут, разбор метрик, удалённо',
    amount: 549000,
    priceRub: 5490,
  },
};

function isReportUnlockProduct(product) {
  return (
    product === 'full_report' || product === 'subscription_1m' || product === 'subscription_3m'
  );
}

/** Один invId — один fulfill (Result URL и Success URL часто приходят одновременно). */
const fulfillPaidOrderInFlight = new Map();

async function fulfillPaidOrder({ sessionId, product, amountRub, invId, email }) {
  const lockKey =
    invId != null && String(invId).trim()
      ? `inv:${String(invId).trim()}`
      : `sid:${String(sessionId ?? '').trim()}:${String(product ?? '')}`;
  const existing = fulfillPaidOrderInFlight.get(lockKey);
  if (existing) return existing;

  const run = (async () => {
    const sid = String(sessionId ?? '').trim();
    const prod = String(product ?? '');
    const normalizedEmail = normalizeRecoverEmail(email);

    if (isReportUnlockProduct(prod)) {
      markWebPaid({ sessionId: sid, product: 'full_report', invId: String(invId ?? '') });
    } else if (prod) {
      markWebPaid({ sessionId: sid, product: prod, invId: String(invId ?? '') });
    }

    if (!isSupabaseConfigured()) return { subscriptionUntil: null };

    let subscriptionUntil = null;
    if (isSubscriptionProduct(prod)) {
      // Сначала платёж в дашборд — активация подписки не должна блокировать учёт денег.
      const saved = await recordPayment({
        sessionId: sid,
        product: prod,
        amountRub,
        type: 'subscription',
        status: 'paid',
        externalId: invId != null ? String(invId) : undefined,
        email: normalizedEmail,
      });
      if (!saved) {
        console.error('[supabase] fulfillPaidOrder: subscription payment not saved', {
          sid,
          prod,
          invId,
          email: normalizedEmail,
        });
      }
      const activated = await activateSubscription({
        email: normalizedEmail,
        product: prod,
        days: subscriptionDaysForProduct(prod),
      });
      subscriptionUntil = activated?.endDate ?? null;
    } else if (prod === 'full_report') {
      const saved = await recordPayment({
        sessionId: sid,
        product: prod,
        amountRub,
        type: 'one_time',
        status: 'paid',
        externalId: invId != null ? String(invId) : undefined,
        email: normalizedEmail,
      });
      if (!saved) {
        console.error('[supabase] fulfillPaidOrder: one_time payment not saved', {
          sid,
          prod,
          invId,
          email: normalizedEmail,
        });
      }
    } else if (prod === 'consultation') {
      const saved = await recordPayment({
        sessionId: sid,
        product: prod,
        amountRub,
        type: 'one_time',
        status: 'paid',
        externalId: invId != null ? String(invId) : undefined,
        email: normalizedEmail,
      });
      if (!saved) {
        console.error('[supabase] fulfillPaidOrder: consultation payment not saved', {
          sid,
          prod,
          invId,
          email: normalizedEmail,
        });
      }
    }

    return { subscriptionUntil };
  })().finally(() => {
    fulfillPaidOrderInFlight.delete(lockKey);
  });

  fulfillPaidOrderInFlight.set(lockKey, run);
  return run;
}

function syncPaidToSupabase({ sessionId, product, amountRub, invId, email }) {
  if (!isSupabaseConfigured()) return;
  void fulfillPaidOrder({ sessionId, product, amountRub, invId, email }).catch((e) =>
    console.error('[supabase] sync payment', e),
  );
}

function normalizeRecoverEmail(raw) {
  const e = String(raw ?? '').trim().toLowerCase();
  return e.includes('@') ? e : null;
}

const resolveWebPaymentRecovery = createResolveWebPaymentRecovery({
  isWebPaidForSession,
  markWebPaid,
  findPaidProductPayment,
  findActiveSubscriptionByEmail,
  reassignPaidPaymentSession,
  isSupabaseConfigured,
  robokassaGetOrder,
  isSubscriptionProduct,
});

function extractRobokassaShp(body) {
  const shp = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (k.startsWith('Shp_')) shp[k] = String(v);
  }
  return shp;
}

/** sessionId + product из Shp_* когда robokassa-orders.json потерян после перезапуска. */
function resolveRobokassaPaidFromShp(outSum, shp) {
  const sessionId = String(shp.Shp_sessionId ?? '').slice(0, 80);
  const product = String(shp.Shp_product ?? '');
  const spec = PRODUCTS[product];
  if (!sessionId || !spec) return null;
  if (Number(outSum).toFixed(2) !== Number(spec.priceRub).toFixed(2)) return null;
  return { sessionId, product, amountRub: spec.priceRub };
}

async function confirmRobokassaSuccessReturn({ invId, outSum, signatureValue, shp, order, source }) {
  if (!outSum || !signatureValue || !isRobokassaConfigured(process.env)) return null;
  const sigBody = { OutSum: outSum, InvId: String(invId), SignatureValue: signatureValue, ...shp };
  if (!verifyRobokassaSuccessSignature(sigBody, process.env)) return null;

  const resolved = order
    ? {
        sessionId: order.sessionId,
        product: order.product,
        amountRub: order.amountRub,
        email: order.email || String(shp.Shp_email ?? ''),
      }
    : {
        ...resolveRobokassaPaidFromShp(outSum, shp),
        email: String(shp.Shp_email ?? ''),
      };
  if (!resolved?.sessionId) return null;
  const outSumRub = Number(outSum);
  const paidAmountRub =
    Number.isFinite(outSumRub) && outSumRub > 0
      ? Number(outSumRub.toFixed(2))
      : resolved.amountRub;
  if (Number(outSum).toFixed(2) !== Number(resolved.amountRub).toFixed(2)) return null;

  await fulfillPaidOrder({
    sessionId: resolved.sessionId,
    product: resolved.product,
    amountRub: paidAmountRub,
    invId,
    email: resolved.email,
  });
  payAnalytics.trackPaidOnServer({
    sessionId: resolved.sessionId,
    product: resolved.product,
    tgUserId: null,
    payload: `${source}:${invId}`,
  });
  console.info(`[${source}] confirmed`, invId, resolved.sessionId, resolved.product);
  return resolved;
}

function normalizeHttpsUrl(raw, label) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) throw new Error(`${label}: пустой URL`);
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withScheme).toString().replace(/\/$/, '');
}

function miniAppUrlWithQuery(miniAppUrl, params) {
  const u = new URL(miniAppUrl);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

function validateInitData(initData, botToken) {
  if (!initData || !botToken) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const keys = Array.from(params.keys()).sort();
  const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

async function tgApi(method, body = {}) {
  if (!BOT_TOKEN) return { ok: false, description: 'TELEGRAM_BOT_TOKEN не задан' };
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    const raw = await res.text();
    try {
      return JSON.parse(raw);
    } catch {
      return { ok: false, description: raw.slice(0, 300) };
    }
  } catch (e) {
    console.error('[tgApi]', method, e);
    return { ok: false, description: e instanceof Error ? e.message : String(e) };
  }
}

/** sendPhoto с файлом с диска (multipart). */
async function tgApiForm(method, formData) {
  if (!BOT_TOKEN) return { ok: false, description: 'TELEGRAM_BOT_TOKEN не задан' };
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(45_000),
    });
    const raw = await res.text();
    try {
      return JSON.parse(raw);
    } catch {
      return { ok: false, description: raw.slice(0, 300) };
    }
  } catch (e) {
    console.error('[tgApiForm]', method, e);
    return { ok: false, description: e instanceof Error ? e.message : String(e) };
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LEAD_TO_DEFAULT = 'hello@bookvolon.ru';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseTgUser(initData) {
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeJson(obj, maxLen = 1800) {
  try {
    const s = JSON.stringify(obj ?? {}, null, 2);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return '';
  }
}

async function sendConsultationEmail({ consultationEmail, sessionId, participant, tgUser }) {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const to = (process.env.CONSULTATION_LEAD_TO || LEAD_TO_DEFAULT).trim();

  if (!host || !user || !pass || !from) {
    return false;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const secureExplicit = process.env.SMTP_SECURE;
  const secure =
    secureExplicit === 'true' || (secureExplicit !== 'false' && port === 465);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const subject = `Заявка на разбор: ${consultationEmail}`;
  const lines = [
    'Пользователь оставил заявку на разбор в мини-приложении.',
    '',
    `Email для связи: ${consultationEmail}`,
    `ID сессии оценки: ${sessionId || '—'}`,
  ];
  if (tgUser?.id) {
    lines.push(`Telegram: id ${tgUser.id}${tgUser.username ? `, @${tgUser.username}` : ''}`);
  }
  if (participant && Object.keys(participant).length) {
    lines.push('', 'Анкета участника:', safeJson(participant, 1200));
  }

  const text = lines.join('\n');

  await transporter.sendMail({
    from,
    to,
    replyTo: consultationEmail,
    subject: subject.slice(0, 200),
    text,
  });
  return true;
}

async function sendConsultationTelegram({ consultationEmail, sessionId, participant, tgUser }) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!chatId || !BOT_TOKEN) return false;

  const parts = [
    'Заявка на разбор (мини-приложение)',
    `Email: ${consultationEmail}`,
    `Сессия: ${sessionId || '—'}`,
  ];
  if (tgUser?.id) {
    parts.push(`Telegram: ${tgUser.id}${tgUser.username ? ` @${tgUser.username}` : ''}`);
  }
  if (participant && Object.keys(participant).length) {
    parts.push('', safeJson(participant, 1500));
  }
  const text = parts.join('\n').slice(0, 3900);

  const result = await tgApi('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
  return result.ok === true;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

function readFrontendBuildInfo() {
  try {
    const p = path.join(__dirname, '../dist/build-info.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    /* ignore */
  }
  return null;
}

function stripEnvQuotes(raw) {
  const t = String(raw ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function resolveSheetsWebhookUrl() {
  const fromEnv = stripEnvQuotes(process.env.SHEETS_WEBHOOK_URL);
  const fromBuild = stripEnvQuotes(readFrontendBuildInfo()?.sheetsWebhookUrl);
  const candidate = fromEnv || fromBuild || '';
  if (!candidate.startsWith('https://script.google.com/')) return null;
  if (candidate.includes('/dev')) return null;
  if (candidate.includes('REPLACE_WITH_YOUR')) return null;
  if (!candidate.includes('/exec')) return null;
  return candidate;
}

function sheetsWebhookSource() {
  if (stripEnvQuotes(process.env.SHEETS_WEBHOOK_URL).startsWith('https://script.google.com/')) {
    return 'runtime';
  }
  const fromBuild = stripEnvQuotes(readFrontendBuildInfo()?.sheetsWebhookUrl);
  if (fromBuild.startsWith('https://script.google.com/')) return 'build-info';
  return null;
}

async function forwardToGoogleSheets(payload) {
  const url = resolveSheetsWebhookUrl();
  if (!url) {
    return { ok: false, status: 503, error: 'SHEETS_WEBHOOK_URL не задан (сборка VITE_SHEETS_WEBHOOK_URL)' };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
    redirect: 'follow',
  });
  return { ok: res.ok, status: res.status, error: res.ok ? null : await res.text().catch(() => 'upstream error') };
}

const payAnalytics = createPaymentAnalytics({
  forwardToGoogleSheets,
  tgApi,
  botToken: BOT_TOKEN,
});

/** Amvera и фронт часто дергают /health — не ходим в Telegram API на каждый запрос. */
const WEBHOOK_HEALTH_CACHE_MS = 10 * 60 * 1000;
let webhookHealthCache = { expiresAt: 0, webhookUrl: '', active: false, lastError: null };

async function getCachedTelegramWebhookHealth(expectedUrl) {
  const now = Date.now();
  if (webhookHealthCache.expiresAt > now && webhookHealthCache.webhookUrl === expectedUrl) {
    return { webhookActive: webhookHealthCache.active, webhookLastError: webhookHealthCache.lastError };
  }
  const info = await tgApi('getWebhookInfo', {});
  let active = false;
  let lastError = null;
  if (info?.ok) {
    active = info.result?.url === expectedUrl;
    lastError = info.result?.last_error_message ?? null;
  }
  webhookHealthCache = {
    expiresAt: now + WEBHOOK_HEALTH_CACHE_MS,
    webhookUrl: expectedUrl,
    active,
    lastError,
  };
  return { webhookActive: active, webhookLastError: lastError };
}

async function sendHealthJson(res) {
  const paymentsReady =
    PAYMENT_PROVIDER === 'robokassa'
      ? isRobokassaConfigured(process.env)
      : PAYMENT_PROVIDER !== 'none' && Boolean(BOT_TOKEN) && Boolean(PROVIDER_TOKEN?.trim());
  const webhookUrl = resolveWebhookUrl({ ...process.env, TELEGRAM_BOT_TOKEN: BOT_TOKEN });
  let webhookActive = false;
  let webhookLastError = null;
  const skipWebhookProbe = PAYMENT_PROVIDER === 'robokassa';
  if (!skipWebhookProbe && BOT_TOKEN && webhookUrl) {
    const wh = await getCachedTelegramWebhookHealth(webhookUrl);
    webhookActive = wh.webhookActive;
    webhookLastError = wh.webhookLastError;
  }
  const buildInfo = readFrontendBuildInfo();
  const frontendPaymentsOn = buildInfo?.paymentsEnabled !== false;
  const hints = [];
  if (!paymentsReady) {
    hints.push('Сервер: PAYMENT_PROVIDER=telegram и TELEGRAM_PAYMENT_PROVIDER_TOKEN');
  }
  if (!webhookUrl) {
    hints.push('Задайте TELEGRAM_WEBHOOK_URL или TELEGRAM_MINI_APP_URL (для /webhook)');
  } else if (!skipWebhookProbe && !webhookActive) {
    hints.push(`Вебхук не на ${webhookUrl} — оплата в Telegram может отменяться`);
  }
  if (buildInfo && !frontendPaymentsOn) {
    hints.push(
      paymentsReady
        ? 'Сборка: VITE_PAYMENTS_ENABLED=false, но сервер payments.ready — на проде оплата 149 ₽ активна'
        : 'Фронт: VITE_PAYMENTS_ENABLED=false и сервер без оплаты — отчёт без оплаты',
    );
  }
  if (!buildInfo) {
    hints.push('Нет dist/build-info.json — пересоберите Docker после git push');
  }
  const sheetsUrl = resolveSheetsWebhookUrl();
  if (!sheetsUrl) {
    hints.push(
      'Аналитика: SHEETS_WEBHOOK_URL на «Запуск» (проще) или VITE_SHEETS_WEBHOOK_URL на «Сборка», URL …/exec',
    );
  }
  res.json({
    ok: true,
    analytics: {
      sheetsConfigured: Boolean(sheetsUrl),
      source: sheetsWebhookSource(),
      testUrl: '/api/sheets-test',
    },
    supabase: getSupabaseHealthInfo(process.env),
    adminDashboard: getAdminDashboardHealthInfo(process.env),
    cabinet: getCabinetHealthInfo(process.env),
    payments: {
      ready: paymentsReady,
      provider: PAYMENT_PROVIDER,
      botToken: Boolean(BOT_TOKEN),
      providerToken: Boolean(PROVIDER_TOKEN?.trim()),
      serveStatic: process.env.SERVE_STATIC === 'true',
      miniAppUrl: Boolean(process.env.TELEGRAM_MINI_APP_URL?.trim()),
      webhookUrl: webhookUrl || null,
      webhookActive,
      webhookLastError,
      robokassaConfigured: isRobokassaConfigured(process.env),
      robokassa: getRobokassaHealthInfo(process.env),
      webPayments: PAYMENT_PROVIDER === 'robokassa' || isRobokassaConfigured(process.env),
      frontend: buildInfo
        ? {
            paymentsEnabled: frontendPaymentsOn,
            paymentsEnabledEnv: buildInfo.paymentsEnabledEnv ?? null,
            builtAt: buildInfo.builtAt,
          }
        : { paymentsEnabled: null, note: 'пересоберите проект' },
      hint: hints.length
        ? hints.join(' · ')
        : PAYMENT_PROVIDER === 'robokassa'
          ? 'Робокасса настроена. Проверяйте оплату на cortaapp.ru в браузере.'
          : 'Сервер и вебхук в порядке. Проверяйте оплату только из Telegram.',
    },
  });
}

app.get('/health', (req, res) => {
  void sendHealthJson(res);
});
app.get('/health/payments', (req, res) => {
  void sendHealthJson(res);
});
app.get('/health/robokassa', (_req, res) => {
  res.json({ ok: true, ...getRobokassaHealthInfo(process.env) });
});

/** Полная ссылка на оплату для проверки в поддержке Робокассы (с SignatureValue). */
app.get('/health/robokassa/payment-url', (req, res) => {
  try {
    if (!isRobokassaConfigured(process.env)) {
      return res.status(503).json({ ok: false, error: 'robokassa not configured' });
    }
    const sessionId = String(req.query.sessionId ?? 'health-check').slice(0, 80);
    const product = String(req.query.product ?? 'full_report');
    const spec = PRODUCTS[product];
    if (!spec) return res.status(400).json({ ok: false, error: 'unknown product' });
    const order = robokassaRegisterOrder({
      sessionId,
      product,
      amountRub: spec.priceRub,
    });
    const paymentUrl = buildRobokassaPaymentUrl({
      invId: order.invId,
      amountRub: spec.priceRub,
      description: spec.description,
      receiptItemName: spec.title,
      sessionId,
      product,
    });
    const hasSignature = paymentUrl.includes('SignatureValue=');
    return res.json({
      ok: true,
      invId: order.invId,
      hasSignatureValue: hasSignature,
      paymentUrl,
      hint: 'Скопируйте paymentUrl целиком в поддержку Робокассы — параметр SignatureValue обязателен.',
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.post('/api/sheets-event', async (req, res) => {
  try {
    const result = await forwardToGoogleSheets(req.body ?? {});
    if (!result.ok && result.status === 503) {
      return res.status(503).json({ ok: false, error: result.error });
    }
    if (!result.ok) {
      console.error('[sheets] upstream', result.status, result.error);
      return res.status(502).json({ ok: false, error: result.error, status: result.status });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[sheets]', err);
    return res.status(502).json({ ok: false, error: String(err) });
  }
});

/** Проверка цепочки Amvera → Google без Mini App. Откройте в браузере. */
app.get('/api/sheets-test', async (_req, res) => {
  try {
    const result = await forwardToGoogleSheets({
      eventType: 'server_test',
      sessionId: `amvera-${Date.now()}`,
      stage: 'debug',
      screen: 'debug',
      timestamp: new Date().toISOString(),
    });
    if (!result.ok && result.status === 503) {
      return res.status(503).json({ ok: false, error: result.error });
    }
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: result.error, status: result.status });
    }
    return res.json({
      ok: true,
      message: 'Строка server_test должна появиться на листе events в Google Таблице',
    });
  } catch (err) {
    console.error('[sheets-test]', err);
    return res.status(502).json({ ok: false, error: String(err) });
  }
});

app.get('/health/bot', async (_req, res) => {
  const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL?.trim() || '';
  const webhookUrl = resolveWebhookUrl({ ...process.env, TELEGRAM_BOT_TOKEN: BOT_TOKEN });
  let webhookInfo = null;
  if (BOT_TOKEN) {
    const info = await tgApi('getWebhookInfo', {});
    if (info?.ok) webhookInfo = info.result;
  }
  res.json({
    ok: Boolean(BOT_TOKEN && miniAppUrl),
    botToken: Boolean(BOT_TOKEN),
    miniAppUrl: Boolean(miniAppUrl),
    webhookUrl: webhookUrl || null,
    webhookPending: webhookInfo?.pending_update_count ?? null,
    webhookLastError: webhookInfo?.last_error_message ?? null,
  });
});

app.post('/invoice', async (req, res) => {
  const { initData, product = 'full_report', sessionId = '' } = req.body ?? {};
  const sessionKey = String(sessionId).slice(0, 80);
  const userFromInit = initData && typeof initData === 'string' ? parseTgUser(initData) : null;
  const payCtx = () => ({
    sessionId: sessionKey,
    product,
    tgUserId: userFromInit?.id ?? null,
  });
  const failInvoice = (httpStatus, error, json = { error }) => {
    payAnalytics.trackInvoiceError({ ...payCtx(), httpStatus, error });
    return res.status(httpStatus).json(json);
  };

  try {
    if (!BOT_TOKEN) {
      return failInvoice(500, 'TELEGRAM_BOT_TOKEN не задан');
    }
    if (!initData || typeof initData !== 'string') {
      return failInvoice(400, 'initData обязателен');
    }
    if (!validateInitData(initData, BOT_TOKEN)) {
      return failInvoice(
        401,
        'Неверная подпись initData',
        {
          error:
            'Неверная подпись initData. В Amvera → Переменные запуска TELEGRAM_BOT_TOKEN должен быть токеном того же бота @BotFather, через который открыто мини-приложение Corta (без кавычек и пробелов).',
        },
      );
    }
    const spec = PRODUCTS[product];
    if (!spec) return failInvoice(400, 'Неизвестный product');

    if (PAYMENT_PROVIDER === 'none') {
      return failInvoice(503, 'Оплата временно отключена', {
        error: 'Оплата временно отключена',
        paymentsDisabled: true,
      });
    }

    if (PAYMENT_PROVIDER === 'prodamus') {
      const formUrl = process.env.PRODAMUS_FORM_URL?.trim();
      const secretKey = process.env.PRODAMUS_SECRET_KEY?.trim();
      const miniAppUrlRaw = process.env.TELEGRAM_MINI_APP_URL?.trim();
      const publicBaseRaw = process.env.PAYMENTS_PUBLIC_BASE_URL?.trim();
      const sys = process.env.PRODAMUS_SYS?.trim();
      if (!formUrl || !secretKey || !miniAppUrlRaw || !publicBaseRaw) {
        return failInvoice(500, 'Prodamus: не заданы URL/ключи');
      }
      let miniAppUrl;
      let publicBase;
      try {
        miniAppUrl = normalizeHttpsUrl(miniAppUrlRaw, 'TELEGRAM_MINI_APP_URL');
        publicBase = normalizeHttpsUrl(publicBaseRaw, 'PAYMENTS_PUBLIC_BASE_URL');
      } catch (e) {
        return failInvoice(500, e instanceof Error ? e.message : 'Некорректный URL');
      }
      const tgUser = parseTgUser(initData);
      const tgUserId = tgUser?.id;
      if (tgUserId == null) {
        return failInvoice(400, 'Не удалось определить пользователя Telegram');
      }
      const existingPaid = prodamusFindPaidForUserSession(tgUserId, sessionId, product);
      if (existingPaid.paid) {
        return res.json({
          provider: 'prodamus',
          alreadyPaid: true,
          product: existingPaid.product,
          sessionId: existingPaid.sessionId,
        });
      }
      const orderId = `c_${product}_${String(sessionId).slice(0, 24)}_${crypto.randomBytes(6).toString('hex')}`;
      const notifyUrl = `${publicBase}/prodamus/notify`;
      const urlSuccess = miniAppUrlWithQuery(miniAppUrl, {
        prodamus_order: orderId,
        prodamus_status: 'ok',
      });
      const urlReturn = miniAppUrlWithQuery(miniAppUrl, {
        prodamus_order: orderId,
        prodamus_status: 'cancel',
      });

      prodamusRegisterPendingOrder(orderId, { product, sessionId, tgUserId });

      const products = [
        {
          name: spec.title,
          price: spec.priceRub,
          quantity: 1,
          type: 'service',
        },
      ];

      let paymentUrl;
      try {
        paymentUrl = await prodamusCreatePaymentLink({
          formUrl,
          secretKey,
          sys: sys || undefined,
          orderId,
          products,
          urlSuccess,
          urlReturn,
          urlNotification: notifyUrl,
        });
      } catch (e) {
        console.error('[prodamus] create link', e);
        return failInvoice(502, e instanceof Error ? e.message : String(e));
      }
      payAnalytics.trackInvoiceCreated({ ...payCtx(), tgUserId });
      return res.json({ provider: 'prodamus', paymentUrl, orderId });
    }

    if (PAYMENT_PROVIDER === 'robokassa') {
      if (!isRobokassaConfigured(process.env)) {
        return failInvoice(503, 'robokassa_pending', {
          error: 'Оплата картой подключается (Робокасса). Попробуйте позже или напишите hello@bookvolon.ru',
          paymentsDisabled: true,
        });
      }
      if (!sessionKey) {
        return failInvoice(400, 'sessionId обязателен');
      }
      const payerEmail = normalizeRecoverEmail(req.body?.email);
      if (!payerEmail) {
        return failInvoice(400, 'email обязателен для оплаты');
      }
      const prior = await resolveWebPaymentRecovery({
        sessionId: sessionKey,
        product,
        email: payerEmail,
      });
      if (prior.paid) {
        return res.json({
          provider: 'robokassa',
          alreadyPaid: true,
          sessionId: prior.sessionId,
          product: prior.product,
        });
      }
      const order = robokassaRegisterOrder({
        sessionId: sessionKey,
        product,
        amountRub: spec.priceRub,
        email: payerEmail,
      });
      const paymentUrl = buildRobokassaPaymentUrl({
        invId: order.invId,
        amountRub: spec.priceRub,
        description: spec.description,
        receiptItemName: spec.title,
        sessionId: sessionKey,
        product,
        email: payerEmail,
      });
      payAnalytics.trackInvoiceCreated({ ...payCtx(), tgUserId: userFromInit?.id ?? null });
      return res.json({ provider: 'robokassa', paymentUrl, invId: order.invId });
    }

    return failInvoice(503, 'Оплата доступна только через Робокассу', {
      error: 'Оплата доступна только через Робокассу. Напишите hello@bookvolon.ru',
      paymentsDisabled: true,
    });
  } catch (e) {
    console.error(e);
    return failInvoice(500, e instanceof Error ? e.message : String(e));
  }
});

/** Оплата с сайта (без Telegram initData). Робокасса — когда заданы ROBOKASSA_* в Amvera. */
app.post('/invoice-web', async (req, res) => {
  const { sessionId, product = 'full_report', email } = req.body ?? {};
  const sessionKey = String(sessionId ?? '').slice(0, 80);
  const payerEmail = normalizeRecoverEmail(email);
  const payCtx = () => ({ sessionId: sessionKey, product, tgUserId: null });

  try {
    if (!sessionKey) {
      return res.status(400).json({ error: 'sessionId обязателен' });
    }
    if (!payerEmail) {
      return res.status(400).json({ error: 'email обязателен для оплаты' });
    }
    const spec = PRODUCTS[product];
    if (!spec) {
      return res.status(400).json({ error: 'Неизвестный product' });
    }
    if (!isRobokassaConfigured(process.env)) {
      payAnalytics.trackInvoiceError({
        ...payCtx(),
        httpStatus: 503,
        error: 'robokassa_pending',
      });
      return res.status(503).json({
        error: 'Оплата картой подключается (Робокасса). Попробуйте позже или напишите hello@bookvolon.ru',
        code: 'robokassa_pending',
      });
    }
    const prior = await resolveWebPaymentRecovery({
      sessionId: sessionKey,
      product,
      email: payerEmail,
    });
    if (prior.paid) {
      return res.json({
        provider: 'robokassa',
        alreadyPaid: true,
        sessionId: prior.sessionId,
        product: prior.product,
      });
    }
    const order = robokassaRegisterOrder({
      sessionId: sessionKey,
      product,
      amountRub: spec.priceRub,
      email: payerEmail,
    });
    const paymentUrl = buildRobokassaPaymentUrl({
      invId: order.invId,
      amountRub: spec.priceRub,
      description: spec.description,
      receiptItemName: spec.title,
      sessionId: sessionKey,
      product,
      email: payerEmail,
    });
    payAnalytics.trackInvoiceCreated(payCtx());
    return res.json({ provider: 'robokassa', paymentUrl, invId: order.invId });
  } catch (e) {
    console.error('[invoice-web]', e);
    payAnalytics.trackInvoiceError({
      ...payCtx(),
      httpStatus: 500,
      error: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

/** Проверка оплаты с сайта по sessionId (после возврата с Робокассы). */
app.post('/payment-recover-session-web', async (req, res) => {
  try {
    const { sessionId, product = 'full_report', email, invId } = req.body ?? {};
    if (!sessionId) return res.status(400).json({ paid: false });
    const result = await resolveWebPaymentRecovery({
      sessionId: String(sessionId),
      product,
      email,
      invId,
    });
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ paid: false });
  }
});

/** Восстановление сессии по InvId после возврата с Робокассы (без Shp_* в ссылке). */
app.post('/payment-recover-inv-web', async (req, res) => {
  try {
    const invId = String(req.body?.invId ?? '').trim();
    if (!invId) return res.status(400).json({ paid: false, error: 'invId required' });

    const outSum = String(req.body?.outSum ?? '').trim();
    const signatureValue = String(req.body?.signatureValue ?? '').trim();
    const shp = req.body?.shp && typeof req.body.shp === 'object' ? req.body.shp : {};
    const order = robokassaGetOrder(invId);

    if (outSum && signatureValue) {
      const confirmed = await confirmRobokassaSuccessReturn({
        invId,
        outSum,
        signatureValue,
        shp,
        order,
        source: 'payment-recover-inv-web',
      });
      if (confirmed) {
        return res.json({
          paid: true,
          sessionId: confirmed.sessionId,
          product: confirmed.product,
          invId,
        });
      }
    }

    if (!order) return res.json({ paid: false, error: 'unknown invId' });

    const prior = isWebPaidForSession(order.sessionId, order.product);
    if (prior.paid) {
      return res.json({
        ...prior,
        sessionId: order.sessionId,
        product: order.product,
        invId: order.invId,
      });
    }

    return res.json({
      paid: false,
      sessionId: order.sessionId,
      product: order.product,
      invId: order.invId,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ paid: false });
  }
});

/** Result URL Робокассы (сервер → сервер). */
app.all('/robokassa/result', async (req, res) => {
  try {
    const body = { ...(req.query ?? {}), ...(req.body ?? {}) };
    if (!verifyRobokassaResultSignature(body, process.env)) {
      console.warn('[robokassa/result] bad signature', body.InvId ?? body.inv_id);
      return res.status(400).send('bad signature');
    }
    const invId = String(body.InvId ?? body.inv_id ?? '');
    const outSumRaw = body.OutSum ?? body.out_summ;
    const outSumRub = Number(outSumRaw);
    let order = robokassaGetOrder(invId);
    const shpFromBody = extractRobokassaShp(body);
    if (!order) {
      const outSum = String(outSumRaw ?? '');
      const shp = shpFromBody;
      const resolved = resolveRobokassaPaidFromShp(outSum, shp);
      if (!resolved) {
        console.warn('[robokassa/result] unknown invId', invId);
        return res.status(404).send('unknown order');
      }
      order = {
        invId: Number(invId) || invId,
        sessionId: resolved.sessionId,
        product: resolved.product,
        amountRub: resolved.amountRub,
        email: String(shp.Shp_email ?? ''),
      };
    }
    const paidAmountRub =
      Number.isFinite(outSumRub) && outSumRub > 0 ? Number(outSumRub.toFixed(2)) : order.amountRub;
    markWebPaid({
      sessionId: order.sessionId,
      product: isReportUnlockProduct(order.product) ? 'full_report' : order.product,
      invId: order.invId,
    });
    // Ждём запись в Supabase ДО OK — иначе Робокасса не повторит Result URL при сбое.
    try {
      await fulfillPaidOrder({
        sessionId: order.sessionId,
        product: order.product,
        amountRub: paidAmountRub,
        invId: order.invId,
        email: order.email || shpFromBody.Shp_email,
      });
    } catch (e) {
      console.error('[robokassa/result] supabase fulfill', e);
      return res.status(500).send('fulfill_error');
    }
    payAnalytics.trackPaidOnServer({
      sessionId: order.sessionId,
      product: order.product,
      tgUserId: null,
      payload: `robokassa:${invId}`,
    });
    console.info('[robokassa/result] paid', invId, order.sessionId, order.product, paidAmountRub);
    return res.send(`OK${invId}`);
  } catch (e) {
    console.error('[robokassa/result]', e);
    return res.status(500).send('error');
  }
});

app.post('/payment-order-status', async (req, res) => {
  try {
    if (PAYMENT_PROVIDER !== 'prodamus') {
      return res.json({ paid: false });
    }
    if (!BOT_TOKEN) return res.status(500).json({ paid: false });
    const { initData, orderId } = req.body ?? {};
    if (!initData || typeof initData !== 'string' || !orderId || typeof orderId !== 'string') {
      return res.status(400).json({ paid: false });
    }
    if (!validateInitData(initData, BOT_TOKEN)) {
      return res.status(401).json({ paid: false });
    }
    const user = parseTgUser(initData);
    const st = prodamusOrderPaidForUser(String(orderId), user?.id);
    return res.json(st);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ paid: false });
  }
});

/** Восстановить доступ: есть ли уже оплаченный заказ для этой сессии. */
app.post('/payment-recover-session', async (req, res) => {
  try {
    if (!BOT_TOKEN) return res.status(500).json({ paid: false });
    const { initData, sessionId, product = 'full_report' } = req.body ?? {};
    if (!initData || typeof initData !== 'string' || !sessionId) {
      return res.status(400).json({ paid: false });
    }
    if (!validateInitData(initData, BOT_TOKEN)) {
      return res.status(401).json({ paid: false });
    }
    const user = parseTgUser(initData);
    if (PAYMENT_PROVIDER === 'telegram') {
      const exact = isTelegramPaidForUser(user?.id, String(sessionId), product);
      if (exact.paid) return res.json(exact);
      const anyPaid = findLatestTelegramPaidForUser(user?.id, product);
      return res.json(anyPaid);
    }
    if (PAYMENT_PROVIDER === 'robokassa') {
      const { email } = req.body ?? {};
      return res.json(
        await resolveWebPaymentRecovery({
          sessionId: String(sessionId),
          product,
          email,
        }),
      );
    }
    if (PAYMENT_PROVIDER !== 'prodamus') {
      return res.json({ paid: false });
    }
    const st = prodamusFindPaidForUserSession(user?.id, String(sessionId), product);
    return res.json(st);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ paid: false });
  }
});

/** Возврат с urlSuccess Payform — подтверждаем оплату, если вебхук задержался. */
app.post('/payment-return-confirm', async (req, res) => {
  try {
    if (PAYMENT_PROVIDER !== 'prodamus') {
      return res.json({ paid: false });
    }
    if (!BOT_TOKEN) return res.status(500).json({ paid: false });
    const { initData, orderId } = req.body ?? {};
    if (!initData || typeof initData !== 'string' || !orderId || typeof orderId !== 'string') {
      return res.status(400).json({ paid: false });
    }
    if (!validateInitData(initData, BOT_TOKEN)) {
      return res.status(401).json({ paid: false });
    }
    const user = parseTgUser(initData);
    const st = prodamusConfirmReturnForUser(String(orderId), user?.id);
    if (st.paid) {
      console.info('[prodamus] return confirm', String(orderId), st.product);
    }
    return res.json(st);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ paid: false });
  }
});

app.post(
  '/prodamus/notify',
  express.urlencoded({ extended: true, limit: '512kb' }),
  (req, res) => {
    try {
      if (PAYMENT_PROVIDER !== 'prodamus') {
        return res.status(404).send('disabled');
      }
      const secretKey = process.env.PRODAMUS_SECRET_KEY?.trim();
      if (!secretKey) {
        return res.status(500).send('no secret');
      }
      const sign = req.get('Sign') || req.get('sign') || '';
      if (!prodamusVerifySignature(req.body, secretKey, sign)) {
        console.warn('[prodamus/notify] bad signature');
        return res.status(400).send('bad sign');
      }
      const oid = req.body.order_id;
      if (oid) {
        const marked = prodamusMarkOrderPaid(String(oid));
        console.info('[prodamus/notify] paid', String(oid), marked ? 'ok' : 'unknown_order');
      }
      return res.status(200).type('text/plain').send('success');
    } catch (e) {
      console.error('[prodamus/notify]', e);
      return res.status(500).send('error');
    }
  },
);

/** Сохранение результата теста в Supabase (после прохождения на фронте). */
app.post('/api/sync-assessment', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ ok: false, error: 'supabase_not_configured' });
    }
    const {
      sessionId,
      email,
      score,
      memoryScore,
      attentionScore,
      speedScore,
      stabilityScore,
      flexibilityScore,
      compensationTip,
      sessionData,
    } = req.body ?? {};

    if (!sessionId || !email) {
      return res.status(400).json({ ok: false, error: 'sessionId and email required' });
    }

    const saved = await upsertAssessment({
      email,
      sessionId,
      score,
      memoryScore,
      attentionScore,
      speedScore,
      stabilityScore,
      flexibilityScore,
      compensationTip,
      sessionData,
    });

    if (!saved) {
      return res.status(500).json({ ok: false, error: 'save_failed' });
    }
    return res.json({ ok: true, assessmentId: saved.id, userId: saved.user_id });
  } catch (e) {
    console.error('[api/sync-assessment]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/** Активная подписка по email (для автоматического доступа к отчёту без экрана тарифов). */
app.post('/api/subscription-status', async (req, res) => {
  try {
    const email = normalizeRecoverEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ active: false, endDate: null, error: 'email required' });
    }
    if (!isSupabaseConfigured()) {
      return res.json({ active: false, endDate: null });
    }
    const sub = await findActiveSubscriptionByEmail(email);
    if (!sub?.end_date) {
      return res.json({ active: false, endDate: null });
    }
    return res.json({ active: true, endDate: sub.end_date });
  } catch (e) {
    console.error('[api/subscription-status]', e);
    return res.status(500).json({ active: false, endDate: null, error: 'server_error' });
  }
});

/** Воронка: email + последний экран (в т.ч. если тест не завершён). */
app.post('/api/sync-funnel', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ ok: false, error: 'supabase_not_configured' });
    }
    const {
      email,
      visitId,
      lastScreen,
      screensPath,
      status = 'in_progress',
      exitReason,
      assessmentSessionId,
    } = req.body ?? {};

    if (!email || !visitId) {
      return res.status(400).json({ ok: false, error: 'email and visitId required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
      return res.status(400).json({ ok: false, error: 'invalid_email' });
    }

    const allowedStatus = new Set(['in_progress', 'completed', 'abandoned']);
    const funnelStatus = allowedStatus.has(status) ? status : 'in_progress';

    const saved = await upsertFunnelSession({
      email: normalizedEmail,
      visitId,
      lastScreen,
      screensPath,
      status: funnelStatus,
      exitReason,
      assessmentSessionId,
    });

    if (!saved) {
      return res.status(500).json({ ok: false, error: 'save_failed' });
    }
    return res.json({ ok: true, funnelId: saved.id, userId: saved.user_id });
  } catch (e) {
    console.error('[api/sync-funnel]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

function resolveAdminHtmlPath() {
  const distPath = path.join(__dirname, '../dist/admin.html');
  if (fs.existsSync(distPath)) return distPath;
  const publicPath = path.join(__dirname, '../public/admin.html');
  if (fs.existsSync(publicPath)) return publicPath;
  return null;
}

app.get('/admin', (_req, res) => {
  const adminPath = resolveAdminHtmlPath();
  if (!adminPath) {
    return res.status(404).type('text/plain').send('admin.html not found');
  }
  return res.type('html').sendFile(adminPath);
});

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    if (!isAdminDashboardConfigured()) {
      return res.status(503).json({ ok: false, error: 'admin_not_configured' });
    }
    const password = extractAdminPassword(req);
    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const data = await getDashboardStats(parseDashboardPeriod(req.query.period));
    if (!data) {
      return res.status(500).json({
        ok: false,
        error: 'dashboard_unavailable',
        hint: 'Проверьте Supabase: таблицы users, funnel_sessions, assessments, payments',
      });
    }
    return res.json({ ok: true, data });
  } catch (e) {
    console.error('[api/admin/dashboard]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/** Выровнять amount в payments по актуальным тарифам (149 / 499 / 990 / 5490). */
app.post('/api/admin/repair-payment-amounts', async (req, res) => {
  try {
    if (!isAdminDashboardConfigured()) {
      return res.status(503).json({ ok: false, error: 'admin_not_configured' });
    }
    const password = extractAdminPassword(req);
    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const result = await repairPaymentAmountsFromCatalog();
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[api/admin/repair-payment-amounts]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * Дозаписать оплату в Supabase вручную (если Result URL не донёс платёж).
 * body: { email, product, invId?, sessionId?, amountRub? }
 */
app.post('/api/admin/record-payment', async (req, res) => {
  try {
    if (!isAdminDashboardConfigured()) {
      return res.status(503).json({ ok: false, error: 'admin_not_configured' });
    }
    const password = extractAdminPassword(req);
    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const product = String(req.body?.product ?? '').trim();
    const email = normalizeRecoverEmail(req.body?.email);
    const invId = req.body?.invId != null ? String(req.body.invId).trim() : '';
    const sessionId = String(req.body?.sessionId ?? `manual-${Date.now()}`).slice(0, 80);
    const spec = PRODUCTS[product];
    if (!spec) {
      return res.status(400).json({ ok: false, error: 'unknown_product' });
    }
    if (!email) {
      return res.status(400).json({ ok: false, error: 'email_required' });
    }
    const amountRub = Number(req.body?.amountRub);
    const paid = Number.isFinite(amountRub) && amountRub > 0 ? amountRub : spec.priceRub;
    await fulfillPaidOrder({
      sessionId,
      product,
      amountRub: paid,
      invId: invId || `manual-${Date.now()}`,
      email,
    });
    return res.json({ ok: true, product, email, amountRub: paid, sessionId });
  } catch (e) {
    console.error('[api/admin/record-payment]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/public-config', (_req, res) => {
  const cfg = getPublicSupabaseConfig(process.env);
  if (!cfg) {
    return res.status(503).json({
      ok: false,
      error: 'supabase_public_not_configured',
      hint: 'Amvera «Запуск»: SUPABASE_ANON_KEY (anon public из Supabase → API)',
    });
  }
  return res.json({ ok: true, ...cfg });
});

app.post('/api/cabinet/request-otp', async (req, res) => {
  try {
    const result = await requestCabinetOtp(req.body?.email);
    if (!result.ok) {
      const status =
        result.error === 'invalid_email'
          ? 400
          : result.error === 'supabase_unreachable'
            ? 502
            : /rate|429/i.test(`${result.error} ${result.message ?? ''}`)
              ? 429
              : 500;
      return res.status(status).json(result);
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[cabinet request-otp]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.post('/api/cabinet/verify-otp', async (req, res) => {
  try {
    const token = req.body?.token ?? req.body?.code;
    const result = await verifyCabinetOtp(req.body?.email, token);
    if (!result.ok) {
      const status =
        result.error === 'invalid_email' || result.error === 'invalid_token'
          ? 400
          : result.error === 'supabase_unreachable'
            ? 502
            : 401;
      return res.status(status).json(result);
    }
    return res.json({
      ok: true,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    });
  } catch (e) {
    console.error('[cabinet verify-otp]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.post('/api/cabinet/refresh', async (req, res) => {
  try {
    const result = await refreshCabinetSession(req.body?.refresh_token);
    if (!result.ok) {
      const status =
        result.error === 'invalid_refresh' || result.error === 'refresh_failed'
          ? 401
          : result.error === 'supabase_unreachable'
            ? 502
            : 400;
      return res.status(status).json(result);
    }
    return res.json({
      ok: true,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    });
  } catch (e) {
    console.error('[cabinet refresh]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.post('/api/cabinet/cancel-subscription', async (req, res) => {
  try {
    if (!isCabinetConfigured()) {
      return res.status(503).json({ ok: false, error: 'cabinet_not_configured' });
    }
    const auth = req.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const email = await verifySupabaseAccessToken(token);
    if (!email) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const result = await cancelCabinetSubscription(email);
    if (!result.ok) {
      const status = result.error === 'no_active_subscription' ? 404 : 500;
      return res.status(status).json({ ok: false, error: result.error });
    }
    return res.json({ ok: true, endDate: result.endDate });
  } catch (e) {
    console.error('[api/cabinet/cancel-subscription]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/cabinet/me', async (req, res) => {
  try {
    if (!isCabinetConfigured()) {
      return res.status(503).json({ ok: false, error: 'cabinet_not_configured' });
    }
    const auth = req.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const email = await verifySupabaseAccessToken(token);
    if (!email) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const data = await getCabinetData(email);
    if (!data) {
      return res.status(500).json({ ok: false, error: 'load_failed' });
    }
    return res.json({ ok: true, data });
  } catch (e) {
    console.error('[api/cabinet/me]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/** Анкета участника из последнего теста (только для вошедшего в кабинет). */
app.get('/api/cabinet/participant-profile', async (req, res) => {
  try {
    if (!isCabinetConfigured()) {
      return res.status(503).json({ ok: false, error: 'cabinet_not_configured' });
    }
    const auth = req.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const email = await verifySupabaseAccessToken(token);
    if (!email) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const profile = await getCabinetParticipantProfile(email);
    return res.json({ ok: true, profile: profile ?? null });
  } catch (e) {
    console.error('[api/cabinet/participant-profile]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/cabinet/report/:sessionId', async (req, res) => {
  try {
    if (!isCabinetConfigured()) {
      return res.status(503).json({ ok: false, error: 'cabinet_not_configured' });
    }
    const auth = req.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const email = await verifySupabaseAccessToken(token);
    if (!email) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const sessionId = String(req.params.sessionId ?? '').trim();
    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'session_required' });
    }
    const result = await getCabinetReportSession(email, sessionId);
    if (!result) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    if (result.error === 'no_report_data') {
      return res.status(404).json({
        ok: false,
        error: 'no_report_data',
        message:
          'Данные отчёта для этого прохождения не сохранены. Пройдите оценку заново на этом устройстве или откройте отчёт там, где проходили.',
      });
    }
    if (result.error === 'payment_required') {
      return res.status(403).json({
        ok: false,
        error: 'payment_required',
        message: 'Расширенный отчёт доступен после оплаты.',
      });
    }
    return res.json({ ok: true, session: result.session, sessionId: result.sessionId });
  } catch (e) {
    console.error('[api/cabinet/report]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.post('/api/admin/import-sheets-csv', express.text({ type: ['text/csv', 'text/plain', '*/*'], limit: '12mb' }), async (req, res) => {
  try {
    if (!isAdminDashboardConfigured()) {
      return res.status(503).json({ ok: false, error: 'admin_not_configured' });
    }
    const password = extractAdminPassword(req);
    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const csvText = typeof req.body === 'string' ? req.body : '';
    if (!csvText.trim()) {
      return res.status(400).json({ ok: false, error: 'empty_csv' });
    }
    const result = await importSheetsCsvText(csvText);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json({ ok: true, stats: result.stats });
  } catch (e) {
    console.error('[api/admin/import-sheets-csv]', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.post('/consultation-lead', async (req, res) => {
  try {
    const { initData, consultationEmail, sessionId = '', participant } = req.body ?? {};
    const email = typeof consultationEmail === 'string' ? consultationEmail.trim() : '';
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Некорректный consultationEmail' });
    }

    let tgUser = null;
    if (initData && typeof initData === 'string') {
      if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN не задан' });
      }
      if (!validateInitData(initData, BOT_TOKEN)) {
        return res.status(401).json({ error: 'Неверная подпись initData' });
      }
      tgUser = parseTgUser(initData);
    }

    let emailSent = false;
    let telegramSent = false;
    try {
      emailSent = await sendConsultationEmail({
        consultationEmail: email,
        sessionId: String(sessionId).slice(0, 80),
        participant: participant && typeof participant === 'object' ? participant : undefined,
        tgUser,
      });
    } catch (e) {
      console.error('[consultation-lead] SMTP', e);
    }
    try {
      telegramSent = await sendConsultationTelegram({
        consultationEmail: email,
        sessionId: String(sessionId).slice(0, 80),
        participant: participant && typeof participant === 'object' ? participant : undefined,
        tgUser,
      });
    } catch (e) {
      console.error('[consultation-lead] Telegram', e);
    }

    if (!emailSent && !telegramSent) {
      return res.status(503).json({
        error:
          'Уведомления не настроены: задайте SMTP_* и SMTP_FROM для письма на менеджера ' +
          `или TELEGRAM_ADMIN_CHAT_ID для сообщения в Telegram. Письмо по умолчанию: ${LEAD_TO_DEFAULT}`,
      });
    }

    console.info('[consultation-lead]', email, { emailSent, telegramSent });
    return res.json({ ok: true, emailSent, telegramSent });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

async function processTelegramUpdate(update) {
  if (!update || !BOT_TOKEN) return;

  if (update.message?.successful_payment) {
    const sp = update.message.successful_payment;
    console.info('[paid]', sp.invoice_payload);
    const parsed = parseInvoicePayload(sp.invoice_payload);
    const tgUserId = update.message.from?.id;
    if (parsed && tgUserId != null) {
      markTelegramPaid({
        tgUserId,
        sessionId: parsed.sessionId,
        product: parsed.product,
        payload: sp.invoice_payload,
      });
      payAnalytics.trackPaidOnServer({
        sessionId: parsed.sessionId,
        product: parsed.product,
        tgUserId,
        payload: sp.invoice_payload,
      });
    } else {
      payAnalytics.trackPayment('payment_paid_server_unparsed', {
        tgUserId: tgUserId ?? null,
        payload: sp.invoice_payload ? String(sp.invoice_payload).slice(0, 128) : null,
      });
    }
  }

  const msg = update.message;
  const text = msg?.text ?? msg?.caption;
  if (msg?.chat?.id != null && text && isStartCommand(text)) {
    console.info('[webhook /start] chat', msg.chat.id, text.slice(0, 40));
    await sendStartMessage(tgApi, tgApiForm, msg.chat.id, {
      ...process.env,
      TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    });
  }
}

app.post('/webhook', async (req, res) => {
  const update = req.body;
  if (update?.pre_checkout_query && BOT_TOKEN) {
    try {
      const ans = await tgApi('answerPreCheckoutQuery', {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
      if (!ans?.ok) {
        console.error('[pre_checkout] answer failed', ans?.description || ans);
        payAnalytics.trackPreCheckoutFailed({
          queryId: update.pre_checkout_query.id,
          error: ans?.description || 'answerPreCheckoutQuery failed',
        });
      }
    } catch (e) {
      console.error('[pre_checkout]', e);
      payAnalytics.trackPreCheckoutFailed({
        queryId: update.pre_checkout_query?.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  res.sendStatus(200);
  void processTelegramUpdate(update).catch((e) => console.error('[webhook]', e));
});

/** SERVE_STATIC=true — раздача dist/ (мини-приложение + API на одном домене, вебхук /webhook). */
if (process.env.SERVE_STATIC === 'true') {
  const distDir = path.join(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    const manifestPath = path.join(distDir, 'manifest.webmanifest');
    if (fs.existsSync(manifestPath)) {
      app.get('/manifest.webmanifest', (_req, res) => {
        res.type('application/manifest+json');
        res.sendFile(manifestPath);
      });
    }
    app.use(
      express.static(distDir, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
          }
          if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        },
      }),
    );
    app.get(/^(?!\/(webhook|invoice|invoice-web|health|api|prodamus|robokassa|consultation-lead|admin|payment-order-status|payment-return-confirm|payment-recover-session|payment-recover-session-web|payment-recover-inv-web)).*$/, (_req, res) => {
      res.type('html');
      res.sendFile(path.join(distDir, 'index.html'));
    });
    console.info('[static] dist:', distDir);
  } else {
    console.warn('[static] dist/ не найден — соберите фронт: npm run build');
  }
}

app.listen(PORT, () => {
  console.log(
    `Payments API: http://127.0.0.1:${PORT}  provider=${PAYMENT_PROVIDER}  (POST /invoice, /webhook, …)`,
  );
  if (BOT_TOKEN) {
    // После рестарта Amvera дать контейнеру подняться, иначе Telegram часто пишет Connection timed out.
    const webhookEnv = { ...process.env, TELEGRAM_BOT_TOKEN: BOT_TOKEN };
    setTimeout(() => {
      void ensureTelegramWebhook(tgApi, webhookEnv);
    }, 2500);
    void tgApi('setMyCommands', {
      commands: [{ command: 'start', description: 'Открыть Corta' }],
    });
  } else {
    console.warn('[bot] TELEGRAM_BOT_TOKEN не задан — /start не будет отвечать');
  }
});
