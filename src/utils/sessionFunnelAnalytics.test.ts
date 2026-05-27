import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.hoisted(() => {
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, v);
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
  });
});

import {
  getAnalyticsScreensPath,
  recordAnalyticsScreen,
  withFunnelFields,
} from './sessionFunnelAnalytics';

describe('sessionFunnelAnalytics', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('builds path without duplicate consecutive screens', () => {
    const key = 'visit-1';
    recordAnalyticsScreen(key, 'flanker');
    recordAnalyticsScreen(key, 'flanker');
    recordAnalyticsScreen(key, 'stroop');
    recordAnalyticsScreen(key, 'result/index');
    expect(getAnalyticsScreensPath(key)).toBe('flanker → stroop → result/index');
  });

  it('adds screensPath to payload', () => {
    const key = 'visit-2';
    recordAnalyticsScreen(key, 'welcome');
    recordAnalyticsScreen(key, 'word-study');
    const out = withFunnelFields(key, {
      eventType: 'session_completed',
      sessionId: 'abc',
      stage: 'result',
    });
    expect(out.screensPath).toBe('welcome → word-study');
    expect(out.screen).toBe('word-study');
  });
});
