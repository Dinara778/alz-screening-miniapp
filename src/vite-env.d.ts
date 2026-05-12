/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEETS_WEBHOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'html2pdf.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf: any;
  export default html2pdf;
}
