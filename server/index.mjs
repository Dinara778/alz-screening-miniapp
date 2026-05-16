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
  sendStartMessage,
} from './botStart.mjs';
import {
  prodamusRegisterPendingOrder,
  prodamusCreatePaymentLink,
  prodamusMarkOrderPaid,
  prodamusOrderPaidForUser,
} from './prodamus.mjs';
import { prodamusVerifySignature } from './prodamusHmac.mjs';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PROVIDER_TOKEN = process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN;
const PORT = Number(process.env.PORT) || 8787;
const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || 'telegram').toLowerCase();

/** Названия для чека (Telegram title ≤ 32 символа). amount — копейки для Telegram; priceRub — для Prodamus. */
const PRODUCTS = {
  full_report: {
    title: 'Расширенный отчёт Corta',
    description:
      'Аналитический отчёт, интерпретация метрик и персональные рекомендации по результатам когнитивного скрининга',
    amount: 39900,
    priceRub: 399,
  },
  consultation: {
    title: 'Сессия с экспертом Corta',
    description: 'Персональная сессия 30–40 минут, разбор метрик, удалённо',
    amount: 549000,
    priceRub: 5490,
  },
};

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
  const secretKey = crypto.createHmac('sha256', botToken).update('WebAppData').digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

async function tgApi(method, body) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
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

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/invoice', async (req, res) => {
  try {
    if (!BOT_TOKEN) {
      return res.status(500).json({ error: 'Задайте TELEGRAM_BOT_TOKEN в .env' });
    }
    const { initData, product = 'full_report', sessionId = '' } = req.body ?? {};
    if (!initData || typeof initData !== 'string') {
      return res.status(400).json({ error: 'initData обязателен' });
    }
    if (!validateInitData(initData, BOT_TOKEN)) {
      return res.status(401).json({ error: 'Неверная подпись initData' });
    }
    const spec = PRODUCTS[product];
    if (!spec) return res.status(400).json({ error: 'Неизвестный product' });

    if (PAYMENT_PROVIDER === 'prodamus') {
      const formUrl = process.env.PRODAMUS_FORM_URL?.trim();
      const secretKey = process.env.PRODAMUS_SECRET_KEY?.trim();
      const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL?.trim();
      const publicBase = process.env.PAYMENTS_PUBLIC_BASE_URL?.trim();
      const sys = process.env.PRODAMUS_SYS?.trim();
      if (!formUrl || !secretKey || !miniAppUrl || !publicBase) {
        return res.status(500).json({
          error:
            'Prodamus: задайте PRODAMUS_FORM_URL, PRODAMUS_SECRET_KEY, TELEGRAM_MINI_APP_URL, PAYMENTS_PUBLIC_BASE_URL',
        });
      }
      const tgUser = parseTgUser(initData);
      const tgUserId = tgUser?.id;
      if (tgUserId == null) {
        return res.status(400).json({ error: 'Не удалось определить пользователя Telegram' });
      }
      const orderId = `c_${product}_${String(sessionId).slice(0, 24)}_${crypto.randomBytes(6).toString('hex')}`;
      const notifyUrl = `${publicBase.replace(/\/$/, '')}/prodamus/notify`;
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
        return res.status(502).json({ error: e instanceof Error ? e.message : String(e) });
      }
      return res.json({ provider: 'prodamus', paymentUrl, orderId });
    }

    if (!PROVIDER_TOKEN) {
      return res.status(500).json({
        error:
          'Задайте TELEGRAM_PAYMENT_PROVIDER_TOKEN в .env для нативной оплаты Telegram (или PAYMENT_PROVIDER=prodamus)',
      });
    }

    const payload = `${product}:${String(sessionId).slice(0, 40)}:${Date.now()}`.slice(0, 128);
    const result = await tgApi('createInvoiceLink', {
      title: spec.title.slice(0, 32),
      description: spec.description.slice(0, 255),
      payload,
      provider_token: PROVIDER_TOKEN,
      currency: 'RUB',
      prices: [{ label: 'Услуга', amount: spec.amount }],
    });

    if (!result.ok) {
      return res.status(502).json({ error: result.description || 'createInvoiceLink failed' });
    }
    return res.json({ provider: 'telegram', invoiceUrl: result.result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
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

app.post('/webhook', async (req, res) => {
  const update = req.body;
  try {
    if (update?.pre_checkout_query) {
      await tgApi('answerPreCheckoutQuery', {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
    }
    if (update?.message?.successful_payment) {
      console.info('[paid]', update.message.successful_payment.invoice_payload);
    }

    const msg = update?.message;
    const text = msg?.text ?? msg?.caption;
    if (msg?.chat?.id != null && BOT_TOKEN && text && isStartCommand(text)) {
      const sent = await sendStartMessage(tgApi, msg.chat.id);
      if (!sent.ok) {
        console.error('[webhook /start] sendMessage', sent.description || sent);
      }
    }
  } catch (e) {
    console.error('[webhook]', e);
  }
  res.sendStatus(200);
});

/** SERVE_STATIC=true — раздача dist/ (мини-приложение + API на одном домене, вебхук /webhook). */
if (process.env.SERVE_STATIC === 'true') {
  const distDir = path.join(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/(webhook|invoice|health|prodamus|consultation-lead|payment-order-status)).*$/, (_req, res) => {
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
    void ensureTelegramWebhook(tgApi).catch((e) => console.error('[bot] ensureWebhook', e));
  }
});
