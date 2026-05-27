import fs from 'fs';
import path from 'path';

const outDir = path.resolve('dist');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'build-info.json'),
  JSON.stringify({
    paymentsEnabled: process.env.VITE_PAYMENTS_ENABLED !== 'false',
    paymentsEnabledEnv: process.env.VITE_PAYMENTS_ENABLED ?? null,
    paymentsUrl: process.env.VITE_TELEGRAM_PAYMENTS_URL?.trim() || null,
    sheetsWebhookUrl: process.env.VITE_SHEETS_WEBHOOK_URL?.trim() || null,
    builtAt: new Date().toISOString(),
  }),
);
