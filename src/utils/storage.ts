import { AppStage, SavedProgress, SessionResult } from '../types';

const HISTORY_KEY = 'alz_history_v1';
const PROGRESS_KEY = 'alz_progress_v1';

const PROGRESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
  'stroop',
  'face-test',
]);

export function shouldRestoreProgress(s: SavedProgress | null | undefined): s is SavedProgress {
  if (!s?.stage) return false;
  if (!RESTORABLE_STAGES.has(s.stage)) return false;
  if (typeof s.savedAt === 'number' && Date.now() - s.savedAt > PROGRESS_MAX_AGE_MS) return false;
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
