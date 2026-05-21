import fs from 'fs';
import path from 'path';

const outDir = path.resolve('dist');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'build-info.json'),
  JSON.stringify({
    paymentsEnabled: process.env.VITE_PAYMENTS_ENABLED !== 'false',
    paymentsUrl: process.env.VITE_TELEGRAM_PAYMENTS_URL?.trim() || null,
    builtAt: new Date().toISOString(),
  }),
);
