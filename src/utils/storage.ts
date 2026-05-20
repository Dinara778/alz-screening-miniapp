import { AppStage, ReportFlowStep, SavedProgress, SessionResult } from '../types';

const VALID_REPORT_STEPS = new Set<ReportFlowStep>(['ready', 'report', 'learned', 'upsell']);

export function normalizeReportStep(raw: unknown): ReportFlowStep | null {
  return typeof raw === 'string' && VALID_REPORT_STEPS.has(raw as ReportFlowStep)
    ? (raw as ReportFlowStep)
    : null;
}

export function loadSavedReportStep(): ReportFlowStep | null {
  return normalizeReportStep(loadProgress()?.reportStep);
}

export function patchProgressReportStep(step: ReportFlowStep): void {
  const prev = loadProgress();
  saveProgress({
    stage: prev?.stage ?? 'full-report',
    latestSessionId: prev?.latestSessionId,
    startedAt: prev?.startedAt ?? null,
    immediateWords: prev?.immediateWords,
    delayedWords: prev?.delayedWords,
    flankerTrials: prev?.flankerTrials,
    reactionSuccessful: prev?.reactionSuccessful,
    reactionAnticipations: prev?.reactionAnticipations,
    stroopTrials: prev?.stroopTrials,
    sessionSeed: prev?.sessionSeed,
    participant: prev?.participant,
    studyWordList: prev?.studyWordList,
    reportStep: step,
  });
}
import { consumeHardReloadFlag, consumeRestartIntent } from './appReload';

const HISTORY_KEY = 'alz_history_v1';
const PROGRESS_KEY = 'alz_progress_v1';
const LAST_SESSION_ID_KEY = 'alz_last_session_id';

const PROGRESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Параметры возврата с Payform / Prodamus в URL мини-приложения. */
export function hasPaymentReturnInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.has('prodamus_order') || q.has('order_id')) return true;
  const status = (q.get('prodamus_status') || q.get('payment_status') || '').toLowerCase();
  return status === 'ok' || status === 'success' || status === 'paid';
}

/** Полная перезагрузка вкладки / pull-to-refresh / кнопка «Обновить». */
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

/** После теста: перезагрузка страницы не должна сбрасывать на intro */
const POST_TEST_STAGES = new Set<AppStage>(['result', 'full-report', 'consultation-request']);

/** Этапы, с которых имеет смысл восстанавливать сессию после закрытия мини-приложения */
const RESTORABLE_STAGES = new Set<AppStage>([
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

export function shouldRestoreProgress(s: SavedProgress | null | undefined): s is SavedProgress {
  if (!s?.stage) return false;
  const okStage = RESTORABLE_STAGES.has(s.stage) || POST_TEST_STAGES.has(s.stage);
  if (!okStage) return false;
  if (typeof s.savedAt === 'number' && Date.now() - s.savedAt > PROGRESS_MAX_AGE_MS) return false;
  if (POST_TEST_STAGES.has(s.stage)) {
    const history = loadHistory();
    if (history.length > 0) return true;
    const sid = s.latestSessionId ?? loadLastSessionId();
    if (sid && history.some((h) => h.id === sid)) return true;
    return Boolean(sid);
  }
  return true;
}

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

/** При F5 на экране результатов не стираем сохранённый этап */
export function shouldClearProgressOnReload(saved: SavedProgress | null): boolean {
  if (!saved?.stage) return false;
  if (POST_TEST_STAGES.has(saved.stage)) return false;
  if (hasPaymentReturnInUrl()) return false;
  return RESTORABLE_STAGES.has(saved.stage);
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
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
};

export const saveProgress = (progress: SavedProgress): void => {
  try {
    const payload: SavedProgress = { ...progress, savedAt: Date.now() };
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
