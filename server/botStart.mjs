/** Ответ бота на /start: фото + текст с кнопкой открытия мини-приложения. */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const START_PHOTO_CANDIDATES = [
  path.join(BOT_DIR, '../public/corta-logo.png'),
  path.join(BOT_DIR, '../dist/corta-logo.png'),
  path.join(BOT_DIR, '../public/dinara-isaeva.png'),
  path.join(BOT_DIR, '../dist/dinara-isaeva.png'),
];

/** Пункты подписи к фото: жирный заголовок (как в сервисных списках Telegram), обычный текст ниже. */
const START_PHOTO_BLOCKS = [
  {
    title: 'Показывает уровень когнитивного ресурса сейчас',
    body: 'Насколько ваш мозг готов к нагрузке, концентрации и принятию решений.',
  },
  {
    title: 'Переводит состояние в понятную картину',
    body: 'Не просто показатели, а ответ: что это значит для вас сегодня.',
  },
  { title: 'Помогает замечать перегрузку до того, как она срывает день' },
  {
    title: 'Показывает личные закономерности',
    body: 'Что усиливает ваш ресурс, а что незаметно его снижает.',
  },
  { title: 'Помогает точнее планировать день под своё состояние' },
];

const BULLET = '•';
const START_PHOTO_HEADING = 'Что умеет этот бот?';

/**
 * Список в стиле Telegram: системный шрифт, маркер •, подзаголовок bold через entities
 * (надёжнее, чем parse_mode HTML в подписях к фото).
 */
export function buildTelegramListCaption(blocks, { bullet = BULLET, heading = '' } = {}) {
  let caption = '';
  const caption_entities = [];

  if (heading) {
    caption_entities.push({ type: 'bold', offset: 0, length: heading.length });
    caption = heading;
  }

  for (let i = 0; i < blocks.length; i++) {
    if (caption.length) caption += '\n\n';
    const titleLine = `${bullet} ${blocks[i].title}`;
    caption_entities.push({ type: 'bold', offset: caption.length, length: titleLine.length });
    caption += titleLine;
    if (blocks[i].body) caption += `\n${blocks[i].body}`;
  }

  return { caption, caption_entities };
}

const DEFAULT_START_PHOTO = buildTelegramListCaption(START_PHOTO_BLOCKS, {
  heading: START_PHOTO_HEADING,
});

const DEFAULT_START_MESSAGE_TEXT = [
  'Привет! 👋',
  '',
  'Иногда мы пытаемся собраться усилием, не понимая, что ресурс уже снижен.',
  '',
  'Corta помогает увидеть состояние вашего мозга прямо сейчас и лучше понять, как распределять нагрузку в течение дня.',
  '',
  'Нажмите кнопку ниже, чтобы открыть приложение, оценка состояния мозга займёт всего 5 минут 👇',
].join('\n');

const DEFAULT_START_MESSAGE_ENTITIES = [{ type: 'bold', offset: 0, length: 'Привет'.length }];

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

/** HTTPS-картинка для sendPhoto (по умолчанию {miniApp}/corta-logo.png). */
export function resolveStartPhotoUrl(env = process.env) {
  const custom = env.TELEGRAM_START_PHOTO_URL?.trim();
  if (custom && /^https:\/\//i.test(custom)) return custom;
  const mini = normalizeMiniAppUrl(env.TELEGRAM_MINI_APP_URL);
  if (mini) return `${mini}/corta-logo.png`;
  return '';
}

export function resolveStartPhotoFile(env = process.env) {
  if (env.TELEGRAM_START_PHOTO_DISABLED === 'true') return null;
  const custom = env.TELEGRAM_START_PHOTO_PATH?.trim();
  const candidates = custom
    ? [path.isAbsolute(custom) ? custom : path.join(BOT_DIR, custom)]
    : START_PHOTO_CANDIDATES;
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) return filePath;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function hasHtmlMarkup(text) {
  return /<[a-z][\s\S]*?>/i.test(text);
}

/** Подпись к фото: entities (по умолчанию) или HTML из TELEGRAM_START_PHOTO_CAPTION. */
function resolveStartPhotoCaption(env = process.env) {
  const custom = env.TELEGRAM_START_PHOTO_CAPTION?.trim();
  if (custom) {
    if (hasHtmlMarkup(custom)) {
      return { caption: custom, caption_entities: null, parse_mode: 'HTML' };
    }
    return { caption: custom, caption_entities: null, parse_mode: null };
  }
  return {
    caption: DEFAULT_START_PHOTO.caption,
    caption_entities: DEFAULT_START_PHOTO.caption_entities,
    parse_mode: null,
  };
}

function resolveStartMessageOptions(env = process.env) {
  const custom = env.TELEGRAM_START_MESSAGE?.trim();
  const text = custom || DEFAULT_START_MESSAGE_TEXT;
  if (custom && hasHtmlMarkup(custom)) {
    return { text, entities: null, parse_mode: 'HTML' };
  }
  if (!custom) {
    return { text, entities: DEFAULT_START_MESSAGE_ENTITIES, parse_mode: null };
  }
  return { text, entities: null, parse_mode: null };
}

function applyMessageFields(target, resolved) {
  target.text = resolved.text;
  if (resolved.entities?.length) {
    target.entities = resolved.entities;
  } else if (resolved.parse_mode) {
    target.parse_mode = resolved.parse_mode;
  }
}

function applyCaptionFields(target, resolved) {
  target.caption = resolved.caption;
  if (resolved.caption_entities?.length) {
    target.caption_entities = resolved.caption_entities;
  } else if (resolved.parse_mode) {
    target.parse_mode = resolved.parse_mode;
  }
}

/** Первое сообщение на /start — с фото (как на макете). */
export async function sendStartWelcomePhoto(tgApi, tgApiForm, chatId, env = process.env) {
  const resolvedCaption = resolveStartPhotoCaption(env);
  const photoUrl = resolveStartPhotoUrl(env);

  if (photoUrl) {
    const body = { chat_id: chatId, photo: photoUrl };
    applyCaptionFields(body, resolvedCaption);
    const sent = await tgApi('sendPhoto', body);
    if (sent?.ok) {
      console.info('[bot /start] фото (URL) отправлено', chatId);
      return sent;
    }
    console.warn('[bot /start] sendPhoto URL:', sent?.description || sent);
  }

  const filePath = resolveStartPhotoFile(env);
  if (!filePath || !tgApiForm) return null;

  try {
    const blob = await fs.openAsBlob(filePath);
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', resolvedCaption.caption);
    if (resolvedCaption.caption_entities?.length) {
      form.append('caption_entities', JSON.stringify(resolvedCaption.caption_entities));
    } else if (resolvedCaption.parse_mode) {
      form.append('parse_mode', resolvedCaption.parse_mode);
    }
    form.append('photo', blob, path.basename(filePath));
    const sent = await tgApiForm('sendPhoto', form);
    if (sent?.ok) {
      console.info('[bot /start] фото (файл) отправлено', chatId);
      return sent;
    }
    console.warn('[bot /start] sendPhoto file:', sent?.description || sent);
  } catch (e) {
    console.warn('[bot /start] sendPhoto file error:', e instanceof Error ? e.message : e);
  }
  return null;
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
  const openUrl = resolveAppOpenUrl(miniAppUrl, tmeLink) || buildTmeBotLink(env, botUser);
  const message = resolveStartMessageOptions(env);
  const buttonLabel = env.TELEGRAM_START_BUTTON_TEXT?.trim() || 'Открыть приложение';

  const payload = {
    chat_id: chatId,
    disable_web_page_preview: true,
  };
  applyMessageFields(payload, message);

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
      '\n\n⚠️ Администратору: задайте TELEGRAM_MINI_APP_URL и TELEGRAM_BOT_TOKEN на сервере (Amvera → Запуск).';
  }

  return { payload, miniAppUrl, openUrl };
}

export function buildStartMessagePayloadUrlFallback(chatId, openUrl, env = process.env) {
  const message = resolveStartMessageOptions(env);
  const buttonLabel = env.TELEGRAM_START_BUTTON_TEXT?.trim() || 'Открыть приложение';
  const payload = {
    chat_id: chatId,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: buttonLabel, url: openUrl }]],
    },
  };
  applyMessageFields(payload, message);
  return payload;
}

export async function sendStartMessage(tgApi, tgApiForm, chatId, env = process.env) {
  await sendStartWelcomePhoto(tgApi, tgApiForm, chatId, env);

  const { payload, miniAppUrl, openUrl } = await buildStartMessagePayload(chatId, tgApi, env);
  let sent = await tgApi('sendMessage', payload);
  if (sent?.ok) {
    console.info('[bot /start] сообщение отправлено', chatId);
    return sent;
  }

  const fallbackUrl = openUrl || miniAppUrl;
  if (fallbackUrl) {
    console.warn('[bot /start] повтор с кнопкой-ссылкой:', sent?.description || sent);
    sent = await tgApi('sendMessage', buildStartMessagePayloadUrlFallback(chatId, fallbackUrl, env));
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
  for (const key of ['PAYMENTS_PUBLIC_BASE_URL', 'TELEGRAM_MINI_APP_URL']) {
    const base = env[key]?.trim();
    if (base) return `${base.replace(/\/$/, '')}/webhook`;
  }
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
      '[bot] Задайте TELEGRAM_WEBHOOK_URL, PAYMENTS_PUBLIC_BASE_URL или TELEGRAM_MINI_APP_URL — иначе /start и оплата (pre_checkout) не придут на сервер',
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
