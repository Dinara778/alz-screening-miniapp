/// <reference types="vite/client" />

interface Window {
  /** Dev-only: вызов из консоли для self-validation scoring pipeline */
  __COGNITIVE_SELF_TEST__?: () => string;
}

interface ImportMetaEnv {
  readonly VITE_SHEETS_WEBHOOK_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Dev: skip paywall and invoice for full report */
  readonly VITE_DEV_BYPASS_REPORT_PAYMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
