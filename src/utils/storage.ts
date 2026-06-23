import { AppStage, SavedProgress, SessionResult } from '../types';
import { consumeHardReloadFlag, consumeRestartIntent } from './appReload';

const HISTORY_KEY = 'alz_history_v1';
const PROGRESS_KEY = 'alz_progress_v1';
const LAST_SESSION_ID_KEY = 'alz_last_session_id';

const PROGRESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** После теста — не восстанавливаем при открытии / обновлении (пока отключено). */
const POST_TEST_STAGES = new Set<AppStage>(['result', 'full-report', 'consultation-request']);

/** Этапы теста, которые можно сохранять при прохождении (без шагов result/report). */
export const MID_TEST_STAGES = new Set<AppStage>([
  'word-study',
  'word-immediate',
  'flanker-instruction',
  'flanker',
  'reaction-instruction',
  'reaction',
  'interference-wait',
  'word-delayed',
  'face-study',
  'stroop-instruction',
  'stroop-confirm',
  'stroop',
  'face-test-instruction',
  'face-test',
]);

function robokassaSessionFromQuery(q: URLSearchParams): string | null {
  return (
    q.get('sessionId')?.trim() ||
    q.get('Shp_sessionId')?.trim() ||
    q.get('Shp_sessionid')?.trim() ||
    null
  );
}

/** Успешный возврат с Payform или Робокассы. */
export function hasRobokassaReturnInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get('robokassa') === 'fail' || q.get('robokassa') === 'cancel') return false;
  if (q.get('robokassa') === 'success' && Boolean(robokassaSessionFromQuery(q))) return true;
  // Кабинет: Success URL = https://cortaapp.ru/ (GET, без ?). Робокасса дописывает OutSum, InvId, Shp_*.
  return Boolean(q.get('OutSum') && q.get('InvId') && robokassaSessionFromQuery(q));
}

export function robokassaReturnSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('robokassa') === 'success' || (q.get('OutSum') && q.get('InvId'))) {
    return robokassaSessionFromQuery(q);
  }
  return null;
}

export function hasPaymentReturnInUrl(): boolean {
  if (hasRobokassaReturnInUrl()) return true;
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  const orderId = q.get('prodamus_order') || q.get('order_id');
  if (!orderId?.trim()) return false;
  const status = (q.get('prodamus_status') || q.get('payment_status') || '').toLowerCase();
  if (status === 'cancel' || status === 'cancelled' || status === 'fail' || status === 'failed') {
    return false;
  }
  return status === 'ok' || status === 'success' || status === 'paid';
}

/** Полная перезагрузка вкладки / кнопка «Обновить». */
export function isPageReload(): boolean {
  if (hasPaymentReturnInUrl()) return false;
  if (consumeHardReloadFlag()) return true;
  if (typeof window === 'undefined' || typeof performance === 'undefined') return false;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === 'reload') return true;
  const legacy = (performance as Performance & { navigation?: { type?: number } }).navigation;
  return legacy?.type === 1;
}

export function isRestartBoot(): boolean {
  return consumeRestartIntent();
}

export function isPostTestStage(stage: AppStage): boolean {
  return POST_TEST_STAGES.has(stage);
}

export function shouldRestoreProgress(s: SavedProgress | null | undefined): s is SavedProgress {
  if (!s?.stage) return false;
  if (!MID_TEST_STAGES.has(s.stage)) return false;
  if (typeof s.savedAt === 'number' && Date.now() - s.savedAt > PROGRESS_MAX_AGE_MS) return false;
  return true;
}

/** При обновлении страницы сбрасываем любой сохранённый этап. */
export function shouldClearProgressOnReload(_saved: SavedProgress | null): boolean {
  if (hasPaymentReturnInUrl()) return false;
  return true;
}

export const loadHistory = (): SessionResult[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionResult[];
  } catch {
    return [];
  }
};

export const saveSession = (session: SessionResult): void => {
  try {
    const history = loadHistory();
    localStorage.setItem(HISTORY_KEY, JSON.stringify([session, ...history]));
  } catch (e) {
    console.error('[storage] saveSession failed', e);
  }
};

export const loadProgress = (): SavedProgress | null => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    if (parsed?.stage && isPostTestStage(parsed.stage)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveProgress = (progress: SavedProgress): void => {
  if (isPostTestStage(progress.stage)) return;
  try {
    const payload: SavedProgress = { ...progress, savedAt: Date.now() };
    delete payload.reportStep;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('[storage] saveProgress failed', e);
  }
};

export const clearProgress = (): void => {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* ignore */
  }
};

export function saveLastSessionId(sessionId: string): void {
  try {
    localStorage.setItem(LAST_SESSION_ID_KEY, sessionId);
  } catch {
    /* ignore */
  }
}

export function loadLastSessionId(): string | null {
  try {
    return localStorage.getItem(LAST_SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function loadSessionFromHistory(sessionId?: string | null): SessionResult | null {
  const history = loadHistory();
  if (!history.length) return null;
  if (sessionId) {
    return history.find((h) => h.id === sessionId) ?? history[0];
  }
  return history[0];
}
