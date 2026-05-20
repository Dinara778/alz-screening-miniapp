import { useEffect } from 'react';
import { useScrollToTopOnStage } from './hooks/useScrollToTopOnStage';
import { useApp } from './context/AppContext';
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
import { AppRefreshControls } from './components/AppRefreshControls';

function App() {
  const app = useApp();
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

  return (
    <main className="app-calm-shell mx-auto flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-2xl flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] text-white shadow-none">
      <div
        ref={scrollRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [overflow-anchor:none]"
      >
        <AppRefreshControls />
        <div key={app.stage} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {app.stage === 'corta-intro' && (
            <CortaIntroPage onContinue={() => app.setStage('expert-intro')} />
          )}
          {app.stage === 'expert-intro' && (
            <ExpertIntroPage onContinue={() => app.setStage('intro-test-offer')} />
          )}
          {app.stage === 'intro-test-offer' && (
            <IntroTestOfferPage onContinue={() => app.setStage('welcome')} />
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
        </div>
      </div>
    </main>
  );
}

export default App;
