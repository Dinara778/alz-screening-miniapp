/** Ответ бота на /start: приветствие и кнопка открытия мини-приложения. */

export function isStartCommand(text) {
  if (typeof text !== 'string') return false;
  return /^\/start(@[A-Za-z0-9_]+)?(\s|$)/i.test(text.trim());
}

export function normalizeMiniAppUrl(url) {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u) return '';
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') return '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

/** Прямая ссылка t.me/.../shortname из BotFather (если задана). */
export function resolveAppOpenUrl(miniAppUrl, directTmeLink) {
  const direct = typeof directTmeLink === 'string' ? directTmeLink.trim() : '';
  if (direct && /^https:\/\/t\.me\//i.test(direct)) return direct;
  return normalizeMiniAppUrl(miniAppUrl);
}

export function buildStartMessagePayload(chatId, env = process.env) {
  const miniAppUrl = normalizeMiniAppUrl(env.TELEGRAM_MINI_APP_URL);
  const tmeLink = env.TELEGRAM_MINI_APP_TME_LINK?.trim();
  const openUrl = resolveAppOpenUrl(miniAppUrl, tmeLink);
  const welcomeText =
    env.TELEGRAM_START_MESSAGE?.trim() ||
    'Здравствуйте! Нажмите кнопку ниже, чтобы открыть мини-приложение Corta и пройти скрининг.';
  const buttonLabel = env.TELEGRAM_START_BUTTON_TEXT?.trim() || 'Открыть приложение';

  const payload = {
    chat_id: chatId,
    text: welcomeText,
    disable_web_page_preview: true,
  };

  if (miniAppUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: buttonLabel, web_app: { url: miniAppUrl } }]],
    };
  } else if (openUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: buttonLabel, url: openUrl }]],
    };
  } else {
    payload.text +=
      '\n\n⚠️ Администратору: задайте TELEGRAM_MINI_APP_URL (HTTPS из @BotFather → Mini App) на сервере с вебхуком /webhook.';
  }

  return { payload, miniAppUrl, openUrl };
}

export function buildStartMessagePayloadUrlFallback(chatId, openUrl, env = process.env) {
  const welcomeText =
    env.TELEGRAM_START_MESSAGE?.trim() ||
    'Здравствуйте! Нажмите кнопку ниже, чтобы открыть мини-приложение Corta и пройти скрининг.';
  const buttonLabel = env.TELEGRAM_START_BUTTON_TEXT?.trim() || 'Открыть приложение';
  return {
    chat_id: chatId,
    text: welcomeText,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: buttonLabel, url: openUrl }]],
    },
  };
}

export async function sendStartMessage(tgApi, chatId, env = process.env) {
  const { payload, miniAppUrl, openUrl } = buildStartMessagePayload(chatId, env);
  let sent = await tgApi('sendMessage', payload);
  if (sent.ok) return sent;

  const fallbackUrl = openUrl || miniAppUrl;
  if (fallbackUrl) {
    console.warn('[bot /start] web_app send failed, retry url button:', sent.description || sent);
    sent = await tgApi('sendMessage', buildStartMessagePayloadUrlFallback(chatId, fallbackUrl, env));
  }

  return sent;
}

export function resolveWebhookUrl(env = process.env) {
  const explicit = env.TELEGRAM_WEBHOOK_URL?.trim();
  if (explicit) {
    return explicit.includes('/webhook') ? explicit : `${explicit.replace(/\/$/, '')}/webhook`;
  }
  const base = env.PAYMENTS_PUBLIC_BASE_URL?.trim();
  if (base) return `${base.replace(/\/$/, '')}/webhook`;
  return '';
}

export async function ensureTelegramWebhook(tgApi, env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const url = resolveWebhookUrl(env);
  if (!token) {
    console.warn('[bot] TELEGRAM_BOT_TOKEN не задан — вебхук не регистрируется');
    return { ok: false, reason: 'no_token' };
  }
  if (!url) {
    console.warn(
      '[bot] Задайте TELEGRAM_WEBHOOK_URL или PAYMENTS_PUBLIC_BASE_URL — иначе /start не придёт на сервер',
    );
    return { ok: false, reason: 'no_webhook_url' };
  }
  const result = await tgApi('setWebhook', {
    url,
    allowed_updates: ['message', 'pre_checkout_query'],
    drop_pending_updates: false,
  });
  if (result.ok) {
    console.info('[bot] webhook установлен:', url);
  } else {
    console.error('[bot] setWebhook failed:', result.description || result);
  }
  return result;
}
