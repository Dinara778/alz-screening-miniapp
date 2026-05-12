import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AppProvider } from './context/AppContext';

/** Dev: в консоли `__COGNITIVE_SELF_TEST__()` — текстовый отчёт по синтетическим кейсам scoring. */
if (import.meta.env.DEV) {
  void import('./debug/cognitiveSelfTest').then((m) => {
    window.__COGNITIVE_SELF_TEST__ = m.formatCognitiveSelfValidationText;
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
