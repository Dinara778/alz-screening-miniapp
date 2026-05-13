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
import nodemailer from 'nodemailer';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PROVIDER_TOKEN = process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN;
const PORT = Number(process.env.PORT) || 8787;

const PRODUCTS = {
  full_report: {
    title: 'Полный анализ когнитивной устойчивости',
    description: 'Расширенный отчёт по прохождению теста',
    amount: 39900,
  },
  consultation: {
    title: 'Разбор когнитивного профиля с экспертом',
    description: 'Сессия 30–40 минут, удалённо',
    amount: 549000,
  },
};

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

/** /start или /start@YourBot с необязательным payload */
function isStartCommand(text) {
  if (typeof text !== 'string') return false;
  return /^\/start(@[A-Za-z0-9_]+)?(\s|$)/.test(text.trim());
}

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
    if (!BOT_TOKEN || !PROVIDER_TOKEN) {
      return res.status(500).json({
        error: 'Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_PAYMENT_PROVIDER_TOKEN в .env',
      });
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
    return res.json({ invoiceUrl: result.result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

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
    if (msg?.text && BOT_TOKEN && isStartCommand(msg.text)) {
      const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL?.trim();
      const welcomeText =
        process.env.TELEGRAM_START_MESSAGE?.trim() ||
        'Здравствуйте! Нажмите кнопку ниже, чтобы открыть мини-приложение и пройти скрининг.';
      const buttonLabel =
        process.env.TELEGRAM_START_BUTTON_TEXT?.trim() || 'Открыть приложение';

      const payload = {
        chat_id: msg.chat.id,
        text: welcomeText,
        disable_web_page_preview: true,
      };
      if (miniAppUrl) {
        payload.reply_markup = {
          inline_keyboard: [[{ text: buttonLabel, web_app: { url: miniAppUrl } }]],
        };
      } else {
        payload.text +=
          '\n\n(Администратору: задайте на сервере переменную TELEGRAM_MINI_APP_URL — HTTPS-адрес веб-приложения из настроек бота в @BotFather, иначе кнопка не появится.)';
      }

      const sent = await tgApi('sendMessage', payload);
      if (!sent.ok) {
        console.error('[webhook /start] sendMessage', sent.description || sent);
      }
    }
  } catch (e) {
    console.error(e);
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(
    `Payments API: http://127.0.0.1:${PORT}  (POST /invoice, POST /consultation-lead, POST /webhook — /start + оплата)`,
  );
});
