import fs from 'fs';
import path from 'path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.resolve('.env.production'));

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
