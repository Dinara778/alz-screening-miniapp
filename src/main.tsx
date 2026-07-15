import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AppProvider } from './context/AppContext';
import { registerServiceWorker } from './utils/pwaInstall';
import { CabinetPage } from './pages/CabinetPage';
import { CabinetReportPage } from './pages/CabinetReportPage';

/** До первого кадра — высота видимой области (Instagram / iOS chrome). */
(() => {
  const inner = window.innerHeight;
  const vvH = window.visualViewport?.height ?? inner;
  const height = vvH >= inner * 0.85 ? Math.min(inner, vvH) : inner;
  document.documentElement.style.setProperty('--app-vh', `${Math.round(height)}px`);
})();

const path = typeof window !== 'undefined' ? window.location.pathname : '';
const isCabinetReportRoute = path === '/cabinet/report' || path.startsWith('/cabinet/report/');
const isCabinetRoute =
  path === '/cabinet' || path === '/cabinet/' || isCabinetReportRoute;

/** Dev: в консоли `__COGNITIVE_SELF_TEST__()` — текстовый отчёт по синтетическим кейсам scoring. */
if (import.meta.env.DEV) {
  void import('./debug/cognitiveSelfTest').then((m) => {
    window.__COGNITIVE_SELF_TEST__ = m.formatCognitiveSelfValidationText;
  });
}

if (!isCabinetRoute) {
  void registerServiceWorker();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isCabinetReportRoute ? (
      <CabinetReportPage />
    ) : isCabinetRoute ? (
      <CabinetPage />
    ) : (
      <AppProvider>
        <App />
      </AppProvider>
    )}
  </React.StrictMode>,
);
