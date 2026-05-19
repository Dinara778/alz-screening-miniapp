import { useEffect } from 'react';
import { StageViewport } from './components/StageViewport';
import { useApp } from './context/AppContext';
import { useAppViewport } from './hooks/useAppViewport';
import { useScrollToTopOnStage } from './hooks/useScrollToTopOnStage';
import { recoverProdamusPaymentFromUrl } from './utils/telegramPayments';
import { applyTelegramTheme, attachTelegramThemeListener } from './utils/telegramTheme';
import { HistoryPage } from './pages/HistoryPage';
import { FullReportPage } from './pages/FullReportPage';
import { ResultPage } from './pages/ResultPage';
import { TestPage } from './pages/TestPage';
import { ConsultationRequestPage } from './pages/ConsultationRequestPage';
import { CortaIntroPage } from './pages/CortaIntroPage';
import { ExpertIntroPage } from './pages/ExpertIntroPage';
import { IntroTestOfferPage } from './pages/IntroTestOfferPage';
import { WelcomePage } from './pages/WelcomePage';

function App() {
  const app = useApp();
  useAppViewport();
  const scrollRef = useScrollToTopOnStage(app.stage);

  useEffect(() => {
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
    const t = window.setTimeout(() => applyTelegramTheme(), 150);
    const detachTheme = attachTelegramThemeListener();
    return () => {
      window.clearTimeout(t);
      detachTheme();
    };
  }, []);

  useEffect(() => {
    const api = (import.meta.env.VITE_TELEGRAM_PAYMENTS_URL as string | undefined)?.trim();
    if (!api) return;
    void recoverProdamusPaymentFromUrl(api);
  }, []);

  return (
    <main className="app-calm-shell mx-auto flex h-[var(--app-vh,100dvh)] max-h-[var(--app-vh,100dvh)] min-h-0 w-full max-w-2xl flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] text-white shadow-none">
      <div
        ref={scrollRef}
        className="app-stage-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pb-1 [-webkit-overflow-scrolling:touch]"
      >
        {app.stage === 'corta-intro' && (
          <StageViewport>
            <CortaIntroPage onContinue={() => app.setStage('expert-intro')} />
          </StageViewport>
        )}
        {app.stage === 'expert-intro' && (
          <StageViewport>
            <ExpertIntroPage onContinue={() => app.setStage('intro-test-offer')} />
          </StageViewport>
        )}
        {app.stage === 'intro-test-offer' && (
          <StageViewport>
            <IntroTestOfferPage onContinue={() => app.setStage('welcome')} />
          </StageViewport>
        )}
        {app.stage === 'welcome' && (
          <StageViewport>
            <WelcomePage
              onStart={(profile) => app.beginNewAssessment(profile)}
              onHistory={() => app.setStage('history')}
            />
          </StageViewport>
        )}
        {app.stage === 'history' && (
          <StageViewport>
            <HistoryPage onBack={() => app.setStage('welcome')} />
          </StageViewport>
        )}
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
        ].includes(app.stage) && (
          <StageViewport>
            <TestPage key={app.sessionSeed} />
          </StageViewport>
        )}
        {app.stage === 'result' && (
          <StageViewport>
            <ResultPage onRestart={app.resetSession} />
          </StageViewport>
        )}
        {app.stage === 'full-report' && (
          <StageViewport>
            <FullReportPage />
          </StageViewport>
        )}
        {app.stage === 'consultation-request' && (
          <StageViewport>
            <ConsultationRequestPage />
          </StageViewport>
        )}
      </div>
    </main>
  );
}

export default App;
