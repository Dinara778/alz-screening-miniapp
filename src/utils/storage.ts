import { SavedProgress, SessionResult } from '../types';

const HISTORY_KEY = 'alz_history_v1';
const PROGRESS_KEY = 'alz_progress_v1';

export const loadHistory = (): SessionResult[] => {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SessionResult[];
  } catch {
    return [];
  }
};

export const saveSession = (session: SessionResult): void => {
  const history = loadHistory();
  localStorage.setItem(HISTORY_KEY, JSON.stringify([session, ...history]));
};

export const loadProgress = (): SavedProgress | null => {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
};

export const saveProgress = (progress: SavedProgress): void => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
};

export const clearProgress = (): void => {
  localStorage.removeItem(PROGRESS_KEY);
};
