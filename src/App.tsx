import { useEffect } from 'react';
import { useApp } from './context/AppContext';
import { HistoryPage } from './pages/HistoryPage';
import { ResultPage } from './pages/ResultPage';
import { TestPage } from './pages/TestPage';
import { WelcomePage } from './pages/WelcomePage';

function App() {
  const app = useApp();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.MainButton?.hide();
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 min-h-screen text-slate-950">
      {app.stage === 'welcome' && (
        <WelcomePage
          onStart={(profile) => {
            app.setParticipant(profile);
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
    </main>
  );
}

export default App;
