import { useEffect } from 'react';
import { SupportFooter } from './components/SupportFooter';
import { useApp } from './context/AppContext';
import type { AppStage } from './types';
import { pickStudyWordList } from './utils/generateStimuli';
import { applyTelegramTheme } from './utils/telegramTheme';
import { HistoryPage } from './pages/HistoryPage';
import { FullReportPage } from './pages/FullReportPage';
import { ResultPage } from './pages/ResultPage';
import { TestPage } from './pages/TestPage';
import { ConsultationRequestPage } from './pages/ConsultationRequestPage';
import { CortaIntroPage } from './pages/CortaIntroPage';
import { WelcomePage } from './pages/WelcomePage';

const STAGES_HIDE_SUPPORT_FOOTER: AppStage[] = ['flanker', 'reaction', 'stroop'];

/** Все этапы экрана прохождения теста — без строки о разработчике внизу */
const STAGES_HIDE_DEVELOPER_CREDIT: AppStage[] = [
  'corta-intro',
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
  }, []);

  return (
    <main className="max-w-2xl mx-auto min-h-screen px-4 py-6 text-slate-950 shadow-brand bg-gradient-to-b from-emerald-50/95 via-white to-teal-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100 dark:shadow-none">
      {app.stage === 'corta-intro' && <CortaIntroPage onContinue={() => app.setStage('welcome')} />}
      {app.stage === 'welcome' && (
        <WelcomePage
          onStart={(profile) => {
            app.setParticipant(profile);
            app.setStudyWordList(pickStudyWordList(app.sessionSeed));
            app.setStage('word-study');
          }}
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
        'stroop',
        'face-test',
      ].includes(app.stage) && <TestPage key={app.sessionSeed} />}
      {app.stage === 'result' && <ResultPage onRestart={app.resetSession} />}
      {app.stage === 'full-report' && <FullReportPage />}
      {app.stage === 'consultation-request' && <ConsultationRequestPage />}
      {app.stage !== 'welcome' && app.stage !== 'corta-intro' && app.stage !== 'result' && (
        <SupportFooter
          showSupport={!STAGES_HIDE_SUPPORT_FOOTER.includes(app.stage)}
          showDeveloperCredit={!STAGES_HIDE_DEVELOPER_CREDIT.includes(app.stage)}
        />
      )}
    </main>
  );
}

export default App;
