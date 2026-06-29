import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AppProvider } from './context/AppContext';
import { registerServiceWorker } from './utils/pwaInstall';
import { CabinetPage } from './pages/CabinetPage';

const isCabinetRoute =
  typeof window !== 'undefined' &&
  (window.location.pathname === '/cabinet' || window.location.pathname === '/cabinet/');

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
    {isCabinetRoute ? (
      <CabinetPage />
    ) : (
      <AppProvider>
        <App />
      </AppProvider>
    )}
  </React.StrictMode>,
);
