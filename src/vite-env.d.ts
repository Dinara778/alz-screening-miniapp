/// <reference types="vite/client" />

interface Window {
  /** Dev-only: вызов из консоли для self-validation scoring pipeline */
  __COGNITIVE_SELF_TEST__?: () => string;
}

interface ImportMetaEnv {
  readonly VITE_SHEETS_WEBHOOK_URL?: string;
  /** Dev: skip paywall and invoice for full report */
  readonly VITE_DEV_BYPASS_REPORT_PAYMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'html2pdf.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf: any;
  export default html2pdf;
}
