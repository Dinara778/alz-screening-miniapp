/**
 * Минимальный сервер для Telegram Mini App + нативная оплата.
 *
 * 1) Заполните .env по образцу .env.example
 * 2) npm install && npm start
 * 3) Выставьте вебхук бота на POST /webhook этого сервера (HTTPS):
 *    https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain/webhook
 * 4) Во фронте укажите VITE_TELEGRAM_PAYMENTS_URL=https://your-domain (без /webhook)
 *
 * Документация: https://core.telegram.org/bots/webapps
 * createInvoiceLink: https://core.telegram.org/bots/api#createinvoicelink
 */
import 'dotenv/config';
import crypto from 'crypto';
import cors from 'cors';
import express from 'express';

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
  } catch (e) {
    console.error(e);
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Payments API: http://127.0.0.1:${PORT}  (POST /invoice, POST /webhook)`);
});
