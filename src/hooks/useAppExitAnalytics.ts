import { useCallback, useEffect, useRef } from 'react';
import type { AppStage, ParticipantProfile } from '../types';
import { sendFunnelAnalyticsBeacon } from '../utils/sessionFunnelAnalytics';

type Params = {
  stage: AppStage;
  sessionId: string;
  visitFunnelKey: string;
  screenDetail: string | null;
  participant: ParticipantProfile | null;
};

function buildScreen(stage: AppStage, screenDetail: string | null): string {
  return screenDetail ? `${stage}/${screenDetail}` : stage;
}

/** Отправляет app_exit при сворачивании / закрытии Mini App (sendBeacon). */
export function useAppExitAnalytics({
  stage,
  sessionId,
  visitFunnelKey,
  screenDetail,
  participant,
}: Params) {
  const screenRef = useRef(buildScreen(stage, screenDetail));
  const lastSentRef = useRef<{ screen: string; at: number } | null>(null);

  screenRef.current = buildScreen(stage, screenDetail);

  const sendExit = useCallback(
    (exitReason: string) => {
      const screen = screenRef.current;
      const now = Date.now();
      const prev = lastSentRef.current;
      if (prev && prev.screen === screen && now - prev.at < 2500) return;
      lastSentRef.current = { screen, at: now };

      void sendFunnelAnalyticsBeacon(visitFunnelKey, {
        eventType: 'app_exit',
        sessionId,
        stage,
        screen,
        screenDetail: screenDetail ?? undefined,
        exitReason,
        participant: participant
          ? {
              name: participant.name,
              email: participant.email,
              phone: participant.phone,
              sex: participant.sex,
              age: participant.age,
              education: participant.education,
              pcConfidence: participant.pcConfidence,
            }
          : undefined,
      });
    },
    [sessionId, visitFunnelKey, stage, screenDetail, participant],
  );

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendExit('hidden');
    };
    const onPageHide = () => sendExit('pagehide');

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [sendExit]);
}
