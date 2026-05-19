import { useEffect } from 'react';
import { Footer } from './components/Footer';
import { STAGES_WITH_APP_FOOTER } from './constants/layout';
import { useApp } from './context/AppContext';
import { useAppViewport } from './hooks/useAppViewport';
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

  const showFooter = STAGES_WITH_APP_FOOTER.has(app.stage);

  return (
    <main className="app-calm-shell mx-auto flex h-[var(--app-vh,100dvh)] max-h-[var(--app-vh,100dvh)] min-h-0 w-full max-w-2xl flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] text-white shadow-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain scroll-pt-2 [-webkit-overflow-scrolling:touch]">
        {app.stage === 'corta-intro' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <CortaIntroPage onContinue={() => app.setStage('expert-intro')} />
          </div>
        )}
        {app.stage === 'expert-intro' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <ExpertIntroPage onContinue={() => app.setStage('intro-test-offer')} />
          </div>
        )}
        {app.stage === 'intro-test-offer' && (
          <div className="flex shrink-0 flex-col">
            <IntroTestOfferPage onContinue={() => app.setStage('welcome')} />
          </div>
        )}
        {app.stage === 'welcome' && (
          <WelcomePage
            onStart={(profile) => app.beginNewAssessment(profile)}
            onHistory={() => app.setStage('history')}
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
        {app.stage === 'result' && <ResultPage onRestart={app.resetSession} />}
        {app.stage === 'full-report' && <FullReportPage />}
        {app.stage === 'consultation-request' && <ConsultationRequestPage />}
        {showFooter ? (
          <div className="mt-3 shrink-0 pb-2">
            <Footer compact />
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default App;
