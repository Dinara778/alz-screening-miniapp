import type { ParticipantProfile } from '../types';
import { sendAnalyticsEventBeacon, sendAnalyticsEventToSheets, type AnalyticsEventPayload } from './sheetsWebhook';

const STORAGE_KEY = 'alz_session_funnel_v1';

type FunnelState = {
  visitKey: string;
  steps: string[];
  updatedAt: string;
};

function loadAll(): Record<string, FunnelState> {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, FunnelState>) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, FunnelState>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

/** Уникальный ключ визита (sessionSeed), не меняется после завершения теста. */
export function getVisitFunnelKey(sessionSeed: number): string {
  return String(sessionSeed);
}

/** Запомнить экран в памяти; в таблицу не пишем. */
export function recordAnalyticsScreen(visitKey: string, screen: string): void {
  const label = screen.trim();
  if (!label || !visitKey) return;

  const all = loadAll();
  const prev = all[visitKey];
  const steps = prev?.steps ?? [];
  if (steps[steps.length - 1] === label) return;

  all[visitKey] = {
    visitKey,
    steps: [...steps, label],
    updatedAt: new Date().toISOString(),
  };
  saveAll(all);
}

export function getAnalyticsScreensPath(visitKey: string): string {
  const steps = loadAll()[visitKey]?.steps ?? [];
  return steps.join(' → ');
}

export function clearAnalyticsFunnel(visitKey: string): void {
  const all = loadAll();
  delete all[visitKey];
  saveAll(all);
}

function participantPayload(participant: ParticipantProfile | null | undefined) {
  if (!participant) return undefined;
  return {
    name: participant.name,
    email: participant.email,
    phone: participant.phone,
    sex: participant.sex,
    age: participant.age,
    education: participant.education,
    pcConfidence: participant.pcConfidence,
  };
}

/** Дополняет payload путём по экранам для одной строки в таблице. */
export function withFunnelFields(
  visitKey: string,
  payload: AnalyticsEventPayload,
): AnalyticsEventPayload {
  const screensPath = getAnalyticsScreensPath(visitKey);
  const steps = loadAll()[visitKey]?.steps ?? [];
  const lastScreen = steps[steps.length - 1] ?? payload.screen ?? payload.stage ?? '';
  return {
    ...payload,
    screensPath,
    screen: lastScreen,
    funnelSteps: steps,
  };
}

export async function sendFunnelAnalyticsEvent(
  visitKey: string,
  event: AnalyticsEventPayload,
): Promise<boolean> {
  return sendAnalyticsEventToSheets(withFunnelFields(visitKey, event));
}

export async function sendFunnelAnalyticsBeacon(
  visitKey: string,
  event: AnalyticsEventPayload,
): Promise<boolean> {
  return sendAnalyticsEventBeacon(withFunnelFields(visitKey, event));
}
