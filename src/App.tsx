import { useEffect, useState } from 'react';
import { InstallAppBanner } from './components/InstallAppBanner';
import { useScrollToTopOnStage } from './hooks/useScrollToTopOnStage';
import { useApp } from './context/AppContext';
import { applyTelegramTheme, attachTelegramThemeListener } from './utils/telegramTheme';
import { ensureTelegramWebAppScript } from './utils/loadTelegramWebApp';
import { hasLegalConsent } from './utils/legalConsent';
import { HistoryPage } from './pages/HistoryPage';
import { FullReportPage } from './pages/FullReportPage';
import { ResultPage } from './pages/ResultPage';
import { TestPage } from './pages/TestPage';
import { CortaIntroPage } from './pages/CortaIntroPage';
import { LegalConsentPage } from './pages/LegalConsentPage';
import { PersonalDataConsentDocPage } from './pages/PersonalDataConsentDocPage';
import { UserAgreementDocPage } from './pages/UserAgreementDocPage';
import { ExpertIntroPage } from './pages/ExpertIntroPage';
import { IntroTestOfferPage } from './pages/IntroTestOfferPage';
import { WelcomePage } from './pages/WelcomePage';
import type { AppStage } from './types';
import { MID_TEST_STAGES } from './utils/storage';

const STAGES_REQUIRING_LEGAL_CONSENT = new Set<AppStage>([
  'expert-intro',
  'intro-test-offer',
  'welcome',
  ...MID_TEST_STAGES,
]);

function App() {
  const app = useApp();
  const [legalDocReturn, setLegalDocReturn] = useState<AppStage>('corta-intro');
  const scrollRef = useScrollToTopOnStage(app.stage);

  const openUserAgreement = (returnTo: AppStage) => {
    setLegalDocReturn(returnTo);
    app.setStage('user-agreement-doc');
  };

  const openPersonalDataConsent = (returnTo: AppStage) => {
    setLegalDocReturn(returnTo);
    app.setStage('personal-data-consent-doc');
  };

  const afterIntroContinue = () => {
    app.setStage(hasLegalConsent() ? 'expert-intro' : 'legal-consent');
  };

  useEffect(() => {
    if (STAGES_REQUIRING_LEGAL_CONSENT.has(app.stage) && !hasLegalConsent()) {
      app.setStage('legal-consent');
    }
  }, [app.stage]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    let detachTheme: (() => void) | undefined;

    void ensureTelegramWebAppScript().then(() => {
      if (cancelled) return;
      const tg = window.Telegram?.WebApp;
      if (!tg) return;
      tg.ready();
      tg.expand();
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }
      tg.MainButton?.hide();
      applyTelegramTheme();
      requestAnimationFrame(() => applyTelegramTheme());
      timeoutId = window.setTimeout(() => applyTelegramTheme(), 150);
      detachTheme = attachTelegramThemeListener();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      detachTheme?.();
    };
  }, []);

  return (
    <main className="app-calm-shell mx-auto flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-2xl flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] text-white shadow-none">
      <div
        ref={scrollRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [overflow-anchor:none]"
      >
        <div key={app.stage} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {app.stage === 'corta-intro' && (
            <CortaIntroPage onContinue={afterIntroContinue} />
          )}
          {app.stage === 'legal-consent' && (
            <LegalConsentPage
              onContinue={() => app.setStage('expert-intro')}
              onOpenPersonalDataConsent={() => openPersonalDataConsent('legal-consent')}
              onOpenUserAgreement={() => openUserAgreement('legal-consent')}
            />
          )}
          {app.stage === 'personal-data-consent-doc' && (
            <PersonalDataConsentDocPage onBack={() => app.setStage(legalDocReturn)} />
          )}
          {app.stage === 'user-agreement-doc' && (
            <UserAgreementDocPage onBack={() => app.setStage(legalDocReturn)} />
          )}
          {app.stage === 'expert-intro' && (
            <ExpertIntroPage onContinue={() => app.setStage('intro-test-offer')} />
          )}
          {app.stage === 'intro-test-offer' && (
            <IntroTestOfferPage onContinue={() => app.setStage('welcome')} />
          )}
          {app.stage === 'welcome' && (
            <WelcomePage
              visitId={String(app.sessionSeed)}
              onProfileReady={(profile) => app.setParticipant(profile)}
              onStart={(profile) => app.beginNewAssessment(profile)}
            />
          )}
          {app.stage === 'history' && <HistoryPage onBack={() => app.setStage('welcome')} />}
          {[
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
          ].includes(app.stage) && <TestPage key={app.sessionSeed} />}
          {app.stage === 'result' && <ResultPage onRestart={app.restartApp} />}
          {app.stage === 'full-report' && <FullReportPage />}
        </div>
      </div>
      <InstallAppBanner />
    </main>
  );
}

export default App;
