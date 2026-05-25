import { SessionResult } from '../types';
import { getPaymentsApiUrl } from './telegramPayments';

const WEBHOOK_URL_RAW = (import.meta.env.VITE_SHEETS_WEBHOOK_URL as string | undefined)?.trim();

function getSheetsWebhookUrl(): string | null {
  if (!WEBHOOK_URL_RAW) return null;
  if (!WEBHOOK_URL_RAW.startsWith('https://script.google.com/')) return null;
  if (WEBHOOK_URL_RAW.includes('REPLACE_WITH_YOUR')) return null;
  return WEBHOOK_URL_RAW;
}

/** Есть канал доставки: прокси на том же домене (Amvera) или прямой URL в сборке. */
export const isSheetsWebhookConfigured = (): boolean =>
  Boolean(getSheetsProxyUrl()) || Boolean(getSheetsWebhookUrl());

export type AnalyticsEventPayload = {
  eventType: string;
  sessionId: string;
  stage?: string;
  /** Полный путь экрана, напр. result/measured или flanker */
  screen?: string;
  screenDetail?: string;
  exitReason?: string;
  timestamp?: string;
  participant?: {
    name?: string;
    email?: string;
    phone?: string;
    sex?: string;
    age?: number;
    education?: string;
    pcConfidence?: number;
  };
  [key: string]: unknown;
};

const PREVIEW_KEY = 'alz_analytics_preview_v1';

/** Пока таблица не подключена — последние события в sessionStorage (для отладки). */
export function stashAnalyticsPreview(event: AnalyticsEventPayload): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const payload = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
    const raw = sessionStorage.getItem(PREVIEW_KEY);
    const list: AnalyticsEventPayload[] = raw ? JSON.parse(raw) : [];
    list.push(payload);
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(list.slice(-80)));
  } catch {
    /* ignore quota */
  }
  if (import.meta.env.DEV) {
    console.info('[analytics]', event.eventType, event.screen ?? event.stage, event);
  }
}

function getSheetsProxyUrl(): string | null {
  const api = getPaymentsApiUrl();
  if (!api) return null;
  return `${api.replace(/\/$/, '')}/api/sheets-event`;
}

/** Прямой POST в Google из Mini App часто блокируется CORS — шлём через свой API на Amvera. */
async function postViaSheetsProxy(payload: AnalyticsEventPayload, keepalive: boolean): Promise<boolean> {
  const proxy = getSheetsProxyUrl();
  if (!proxy) return false;
  try {
    const res = await fetch(proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive,
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Запасной канал: text/plain без preflight (может сработать без прокси). */
async function postDirectToGoogle(payload: AnalyticsEventPayload, keepalive: boolean): Promise<boolean> {
  const url = getSheetsWebhookUrl();
  if (!url) return false;
  const body = JSON.stringify(payload);

  if (keepalive && typeof navigator.sendBeacon === 'function') {
    try {
      if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=utf-8' }))) return true;
    } catch {
      /* fetch below */
    }
  }

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      keepalive,
      body,
    });
    return true;
  } catch {
    return false;
  }
}

async function deliverAnalyticsPayload(
  payload: AnalyticsEventPayload,
  transport: 'fetch' | 'beacon',
): Promise<boolean> {
  const keepalive = transport === 'beacon';
  const hasProxy = Boolean(getSheetsProxyUrl());
  const hasDirect = Boolean(getSheetsWebhookUrl());

  if (!hasProxy && !hasDirect) {
    stashAnalyticsPreview(payload);
    return false;
  }

  if (hasProxy && (await postViaSheetsProxy(payload, keepalive))) return true;
  if (hasDirect && (await postDirectToGoogle(payload, keepalive))) return true;

  stashAnalyticsPreview(payload);
  return false;
}

export const sendAnalyticsEventToSheets = async (event: AnalyticsEventPayload): Promise<boolean> => {
  const payload = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  if (!payload.screen && payload.stage) {
    payload.screen = payload.screenDetail ? `${payload.stage}/${payload.screenDetail}` : payload.stage;
  }
  return deliverAnalyticsPayload(payload, 'fetch');
};

/** Для app_exit при закрытии — sendBeacon / keepalive. */
export const sendAnalyticsEventBeacon = async (event: AnalyticsEventPayload): Promise<boolean> => {
  const payload = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  if (!payload.screen && payload.stage) {
    payload.screen = payload.screenDetail ? `${payload.stage}/${payload.screenDetail}` : payload.stage;
  }
  return deliverAnalyticsPayload(payload, 'beacon');
};

export const sendSessionToSheets = async (session: SessionResult): Promise<void> => {
  const payload: AnalyticsEventPayload = {
    ...session,
    riskLevel: session.status,
    eventType: 'session_completed',
    sessionId: session.id,
    stage: 'result',
    screen: 'result',
    timestamp: new Date().toISOString(),
  };

  await deliverAnalyticsPayload(payload, 'fetch');
};
