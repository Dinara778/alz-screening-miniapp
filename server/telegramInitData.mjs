import crypto from 'crypto';

/** Проверка initData Mini App по документации Telegram. */
export function validateInitData(initData, botToken, options = {}) {
  const { maxAgeSec = 86400 } = options;
  if (!initData || !botToken) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const keys = Array.from(params.keys()).sort();
  const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  let hashOk = false;
  try {
    hashOk = crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
  if (!hashOk) return false;
  if (maxAgeSec > 0) {
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate)) return false;
    if (Math.floor(Date.now() / 1000) - authDate > maxAgeSec) return false;
  }
  return true;
}

/** Тестовая подпись initData (для self-test и unit-проверок алгоритма). */
export function createSignedInitData(botToken, extra = {}) {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify({ id: 1, first_name: 'Test' }));
  for (const [k, v] of Object.entries(extra)) {
    if (k !== 'hash') params.set(k, String(v));
  }
  const keys = Array.from(params.keys()).sort();
  const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const digest = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', digest);
  return params.toString();
}

export function parseTgUser(initData) {
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
