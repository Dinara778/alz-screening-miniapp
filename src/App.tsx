import { useEffect } from 'react';
import { SupportFooter } from './components/SupportFooter';
import { useApp } from './context/AppContext';
import type { AppStage } from './types';
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

const STAGES_HIDE_SUPPORT_FOOTER: AppStage[] = ['flanker', 'reaction', 'stroop'];

/** Все этапы экрана прохождения теста — без строки о разработчике внизу */
const STAGES_HIDE_DEVELOPER_CREDIT: AppStage[] = [
  'corta-intro',
  'expert-intro',
  'intro-test-offer',
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
  'face-test',
];

function App() {
  const app = useApp();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
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
    <main className="mx-auto flex min-h-screen min-h-[100dvh] max-w-2xl flex-col bg-gradient-to-b from-emerald-50 via-white to-teal-50 px-4 py-6 text-slate-950 shadow-brand dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100 dark:shadow-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {app.stage === 'corta-intro' && <CortaIntroPage onContinue={() => app.setStage('expert-intro')} />}
        {app.stage === 'expert-intro' && <ExpertIntroPage onContinue={() => app.setStage('intro-test-offer')} />}
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
          'face-test',
        ].includes(app.stage) && <TestPage key={app.sessionSeed} />}
        {app.stage === 'result' && <ResultPage onRestart={app.resetSession} />}
        {app.stage === 'full-report' && <FullReportPage />}
        {app.stage === 'consultation-request' && <ConsultationRequestPage />}
      </div>
      {app.stage !== 'welcome' &&
        app.stage !== 'corta-intro' &&
        app.stage !== 'expert-intro' &&
        app.stage !== 'intro-test-offer' &&
        app.stage !== 'result' && (
        <SupportFooter
          showSupport={!STAGES_HIDE_SUPPORT_FOOTER.includes(app.stage)}
          showDeveloperCredit={!STAGES_HIDE_DEVELOPER_CREDIT.includes(app.stage)}
        />
      )}
    </main>
  );
}

export default App;
