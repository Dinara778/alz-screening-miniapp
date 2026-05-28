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
  findLatestTelegramPaidForUser,
  isTelegramPaidForUser,
  markTelegramPaid,
  parseInvoicePayload,
} from './telegramPaidStore.mjs';

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
  const raw = (process.env.PAYMENT_PROVIDER || 'none').toLowerCase();
  if (raw === 'auto') {
    if (process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN?.trim()) return 'telegram';
    if (
      process.env.PRODAMUS_FORM_URL?.trim() &&
      process.env.PRODAMUS_SECRET_KEY?.trim() &&
      process.env.PAYMENTS_PUBLIC_BASE_URL?.trim()
    ) {
      return 'prodamus';
    }
    return 'none';
  }
  if (raw === 'off' || raw === 'disabled') return 'none';
  return raw;
}

const PAYMENT_PROVIDER = resolvePaymentProvider();

/** Названия для чека (Telegram title ≤ 32 символа). amount — копейки для Telegram; priceRub — для Prodamus. */
const PRODUCTS = {
  full_report: {
    title: 'Расширенный отчёт Corta',
    description:
      'Аналитический отчёт в PDF для скачивания: интерпретация метрик и персональные рекомендации',
    amount: 19900,
    priceRub: 199,
  },
  consultation: {
    title: 'Сессия с экспертом Corta',
    description: 'Персональная сессия 30–40 минут, разбор метрик, удалённо',
    amount: 549000,
    priceRub: 5490,
  },
};

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
    `ID сессии теста: ${sessionId || '—'}`,
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

async function sendHealthJson(res) {
  const paymentsReady =
    PAYMENT_PROVIDER !== 'none' && Boolean(BOT_TOKEN) && Boolean(PROVIDER_TOKEN?.trim());
  const webhookUrl = resolveWebhookUrl({ ...process.env, TELEGRAM_BOT_TOKEN: BOT_TOKEN });
  let webhookActive = false;
  let webhookLastError = null;
  if (BOT_TOKEN && webhookUrl) {
    const info = await tgApi('getWebhookInfo', {});
    if (info?.ok) {
      webhookActive = info.result?.url === webhookUrl;
      webhookLastError = info.result?.last_error_message ?? null;
    }
  }
  const buildInfo = readFrontendBuildInfo();
  const frontendPaymentsOn = buildInfo?.paymentsEnabled !== false;
  const hints = [];
  if (!paymentsReady) {
    hints.push('Сервер: PAYMENT_PROVIDER=telegram и TELEGRAM_PAYMENT_PROVIDER_TOKEN');
  }
  if (!webhookUrl) {
    hints.push('Задайте TELEGRAM_WEBHOOK_URL или TELEGRAM_MINI_APP_URL (для /webhook)');
  } else if (!webhookActive) {
    hints.push(`Вебхук не на ${webhookUrl} — оплата в Telegram может отменяться`);
  }
  if (buildInfo && !frontendPaymentsOn) {
    hints.push(
      paymentsReady
        ? 'Сборка: VITE_PAYMENTS_ENABLED=false, но сервер payments.ready — на проде оплата 199 ₽ активна'
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
      frontend: buildInfo
        ? {
            paymentsEnabled: frontendPaymentsOn,
            paymentsEnabledEnv: buildInfo.paymentsEnabledEnv ?? null,
            builtAt: buildInfo.builtAt,
          }
        : { paymentsEnabled: null, note: 'пересоберите проект' },
      hint: hints.length ? hints.join(' · ') : 'Сервер и вебхук в порядке. Тестируйте оплату только из Telegram.',
    },
  });
}

app.get('/health', (req, res) => {
  void sendHealthJson(res);
});
app.get('/health/payments', (req, res) => {
  void sendHealthJson(res);
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

    if (!PROVIDER_TOKEN) {
      return failInvoice(500, 'TELEGRAM_PAYMENT_PROVIDER_TOKEN не задан');
    }

    const user = parseTgUser(initData);
    const priorPaid = isTelegramPaidForUser(user?.id, String(sessionId), product);
    if (priorPaid.paid) {
      return res.json({
        provider: 'telegram',
        alreadyPaid: true,
        sessionId: priorPaid.sessionId,
        product: priorPaid.product,
      });
    }

    const payload = `${product}:${String(sessionId).slice(0, 40)}:${Date.now()}`.slice(0, 128);
    const receiptParams = buildTelegramYookassaInvoiceParams(spec);
    const result = await tgApi('createInvoiceLink', {
      title: spec.title.slice(0, 32),
      description: spec.description.slice(0, 255),
      payload,
      provider_token: PROVIDER_TOKEN,
      currency: 'RUB',
      prices: [{ label: 'Услуга', amount: spec.amount }],
      ...receiptParams,
    });

    if (!result.ok) {
      return failInvoice(502, result.description || 'createInvoiceLink failed');
    }
    payAnalytics.trackInvoiceCreated({ ...payCtx(), tgUserId: user?.id ?? null });
    return res.json({ provider: 'telegram', invoiceUrl: result.result });
  } catch (e) {
    console.error(e);
    return failInvoice(500, e instanceof Error ? e.message : String(e));
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

app.post('/consultation-lead', async (req, res) => {
  try {
    if (!BOT_TOKEN) {
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN не задан' });
    }
    const { initData, consultationEmail, sessionId = '', participant } = req.body ?? {};
    if (!initData || typeof initData !== 'string') {
      return res.status(400).json({ error: 'initData обязателен' });
    }
    if (!validateInitData(initData, BOT_TOKEN)) {
      return res.status(401).json({ error: 'Неверная подпись initData' });
    }
    const email = typeof consultationEmail === 'string' ? consultationEmail.trim() : '';
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Некорректный consultationEmail' });
    }

    const tgUser = parseTgUser(initData);

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
    app.use(express.static(distDir));
    app.get(/^(?!\/(webhook|invoice|health|api|prodamus|consultation-lead|payment-order-status|payment-return-confirm|payment-recover-session)).*$/, (_req, res) => {
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
    void ensureTelegramWebhook(tgApi, { ...process.env, TELEGRAM_BOT_TOKEN: BOT_TOKEN });
    void tgApi('setMyCommands', {
      commands: [{ command: 'start', description: 'Открыть Corta' }],
    });
  } else {
    console.warn('[bot] TELEGRAM_BOT_TOKEN не задан — /start не будет отвечать');
  }
});
