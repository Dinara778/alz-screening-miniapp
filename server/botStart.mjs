/** Ответ бота на /start: приветствие и кнопка открытия мини-приложения. */

let cachedBotUsername = null;

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

function appendAppLinkToText(text, link) {
  if (!link) return text;
  return `${text}\n\nОткрыть Corta:\n${link}`;
}

export async function fetchBotUsername(tgApi) {
  if (cachedBotUsername) return cachedBotUsername;
  try {
    const me = await tgApi('getMe', {});
    if (me?.ok && me.result?.username) {
      cachedBotUsername = String(me.result.username).replace(/^@/, '');
    }
  } catch {
    /* ignore */
  }
  return cachedBotUsername;
}

/** Ссылка t.me на бота (если нет short name Mini App в BotFather). */
export function buildTmeBotLink(env = process.env, botUsername = null) {
  const direct = env.TELEGRAM_MINI_APP_TME_LINK?.trim();
  if (direct && /^https:\/\/t\.me\//i.test(direct)) return direct;
  const user = env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || botUsername;
  if (user) return `https://t.me/${user}`;
  return '';
}

export async function buildStartMessagePayload(chatId, tgApi, env = process.env) {
  const miniAppUrl = normalizeMiniAppUrl(env.TELEGRAM_MINI_APP_URL);
  const tmeLink = env.TELEGRAM_MINI_APP_TME_LINK?.trim();
  const botUser = await fetchBotUsername(tgApi);
  let openUrl = resolveAppOpenUrl(miniAppUrl, tmeLink) || buildTmeBotLink(env, botUser);
  const welcomeText =
    env.TELEGRAM_START_MESSAGE?.trim() ||
    'Здравствуйте! Нажмите кнопку ниже, чтобы открыть мини-приложение Corta и пройти скрининг.';
  const buttonLabel = env.TELEGRAM_START_BUTTON_TEXT?.trim() || 'Открыть приложение';

  const linkForText = openUrl || miniAppUrl;
  const payload = {
    chat_id: chatId,
    text: appendAppLinkToText(welcomeText, linkForText),
    disable_web_page_preview: false,
  };

  const rows = [];
  if (miniAppUrl) {
    rows.push([{ text: buttonLabel, web_app: { url: miniAppUrl } }]);
  }
  if (openUrl) {
    rows.push([{ text: miniAppUrl ? 'Открыть по ссылке' : buttonLabel, url: openUrl }]);
  }
  if (rows.length) {
    payload.reply_markup = { inline_keyboard: rows };
  } else {
    payload.text +=
      '\n\n⚠️ Администратору: задайте TELEGRAM_MINI_APP_URL и TELEGRAM_BOT_TOKEN на сервере (Amvera → Запуск).';
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
  const { payload, miniAppUrl, openUrl } = await buildStartMessagePayload(chatId, tgApi, env);
  let sent = await tgApi('sendMessage', payload);
  if (sent?.ok) {
    console.info('[bot /start] сообщение отправлено', chatId);
    return sent;
  }

  const fallbackUrl = openUrl || miniAppUrl;
  if (fallbackUrl) {
    console.warn('[bot /start] повтор с кнопкой-ссылкой:', sent?.description || sent);
    const welcomeText =
      env.TELEGRAM_START_MESSAGE?.trim() ||
      'Здравствуйте! Нажмите кнопку ниже, чтобы открыть мини-приложение Corta.';
    sent = await tgApi('sendMessage', {
      ...buildStartMessagePayloadUrlFallback(chatId, fallbackUrl, env),
      text: appendAppLinkToText(welcomeText, fallbackUrl),
    });
  }

  if (!sent?.ok) {
    console.error('[bot /start] sendMessage failed', chatId, sent?.description || sent);
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

function fetchErrorMessage(err) {
  if (!err) return 'unknown';
  const cause = err.cause;
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message);
  return err instanceof Error ? err.message : String(err);
}

/** Регистрация вебхука при старте. Сбой fetch к api.telegram.org не ломает оплату Prodamus. */
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

  const body = {
    url,
    allowed_updates: ['message', 'pre_checkout_query'],
    drop_pending_updates: false,
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await tgApi('setWebhook', body);
      if (result.ok) {
        console.info('[bot] webhook установлен:', url);
        try {
          const info = await tgApi('getWebhookInfo', {});
          if (info?.ok) {
            const wh = info.result;
            console.info('[bot] webhook info:', wh?.url, 'pending:', wh?.pending_update_count);
            if (wh?.last_error_message) {
              console.warn('[bot] webhook last error:', wh.last_error_message);
            }
          }
        } catch {
          /* ignore */
        }
      } else {
        console.warn('[bot] setWebhook:', result.description || result);
      }
      return result;
    } catch (e) {
      const msg = fetchErrorMessage(e);
      if (attempt < 3) {
        console.warn(`[bot] setWebhook попытка ${attempt}/3: ${msg}`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      console.warn(
        '[bot] setWebhook: нет связи с api.telegram.org (оплата Prodamus и /invoice работают; /start — если вебхук уже был зарегистрирован ранее):',
        msg,
      );
      return { ok: false, reason: 'fetch_failed', error: msg };
    }
  }
  return { ok: false, reason: 'fetch_failed' };
}
