/**
 * Подпись запросов/вебхуков Prodamus (PayForm).
 * Алгоритм: https://help.prodamus.ru/payform/integracii/rest-api/instrukcii-dlya-samostoyatelnaya-integracii-servisov
 * (аналог @exode-team/prodamus-ru.api/dist/hmac.js, без lodash).
 */
import crypto from 'crypto';

function sortObject(obj) {
  if (Array.isArray(obj) || obj === null || typeof obj !== 'object') return obj;
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const k of sortedKeys) {
    result[k] = obj[k];
  }
  return result;
}

function strValAndSort(data) {
  const sorted = sortObject(data);
  if (Array.isArray(sorted)) {
    return sorted.map((item) => strValAndSort(item));
  }
  if (sorted !== null && typeof sorted === 'object') {
    const out = {};
    for (const key of Object.keys(sorted)) {
      const value = sorted[key];
      if (value === undefined || value === null) continue;
      out[key] = typeof value === 'object' ? strValAndSort(value) : String(value);
    }
    return out;
  }
  return data === null || data === undefined ? '' : String(data);
}

/** Подпись тела запроса без поля signature. */
export function prodamusCreateSignature(data, secretKey) {
  const copy =
    data && typeof data === 'object' && !Array.isArray(data)
      ? { ...data }
      : data;
  if (copy && typeof copy === 'object' && !Array.isArray(copy)) {
    delete copy.signature;
  }
  const prepared = JSON.stringify(strValAndSort(copy)).replace(/\//g, '\\/');
  return crypto.createHmac('sha256', secretKey).update(prepared).digest('hex');
}

export function prodamusVerifySignature(data, secretKey, signHeader) {
  if (!signHeader || typeof signHeader !== 'string') return false;
  const copy =
    data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : {};
  delete copy.signature;
  delete copy.Sign;
  const calculated = prodamusCreateSignature(copy, secretKey);
  return calculated.toLowerCase() === signHeader.toLowerCase();
}
