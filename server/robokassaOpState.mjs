/**
 * OpStateExt — статус операции Робокассы по InvId.
 * @see https://docs.robokassa.ru/ru/xml-interfaces/
 */
import crypto from 'crypto';

function stripEnvQuotes(raw) {
  const t = String(raw ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function envStr(env, key) {
  return stripEnvQuotes(env[key]).replace(/[\r\n\uFEFF]/g, '');
}

function md5(text) {
  return crypto.createHash('md5').update(String(text), 'utf8').digest('hex');
}

function xmlText(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const m = String(xml).match(re);
  return m ? m[1].trim() : null;
}

function parseUserFields(xml) {
  const fields = {};
  const re =
    /<Field>\s*<Name>([^<]+)<\/Name>\s*<Value>([^<]*)<\/Value>\s*<\/Field>/gi;
  let m;
  while ((m = re.exec(String(xml)))) {
    fields[m[1]] = m[2];
  }
  return fields;
}

/**
 * @returns {Promise<null | { stateCode: number, outSum: number | null, paid: boolean, sessionId: string | null, product: string | null, email: string | null }>}
 */
export async function fetchRobokassaOpState(invoiceId, env = process.env) {
  const login = envStr(env, 'ROBOKASSA_MERCHANT_LOGIN');
  const pass2 = envStr(env, 'ROBOKASSA_PASSWORD2');
  const invId = String(invoiceId ?? '').trim();
  if (!login || !pass2 || !invId) return null;

  const signature = md5(`${login}:${invId}:${pass2}`);
  const url =
    `https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt` +
    `?MerchantLogin=${encodeURIComponent(login)}` +
    `&InvoiceID=${encodeURIComponent(invId)}` +
    `&Signature=${encodeURIComponent(signature)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const xml = await res.text();
    if (!res.ok) {
      console.warn('[robokassa] OpStateExt http', res.status, invId);
      return null;
    }
    const resultCodes = [...String(xml).matchAll(/<Code>(\d+)<\/Code>/gi)].map((x) => Number(x[1]));
    const resultCode = resultCodes[0];
    const stateMatch = xml.match(/<State>[\s\S]*?<Code>(\d+)<\/Code>/i);
    const stateCode = stateMatch ? Number(stateMatch[1]) : Number.NaN;
    const outSumRaw = xmlText(xml, 'OutSum');
    const outSum = outSumRaw != null ? Number(String(outSumRaw).replace(',', '.')) : null;
    const userFields = parseUserFields(xml);
    const sessionId =
      userFields.Shp_sessionId || userFields.shp_sessionId || userFields.Shp_SessionId || null;
    const product = userFields.Shp_product || userFields.shp_product || userFields.Shp_Product || null;
    const email = userFields.Shp_email || userFields.shp_email || userFields.Shp_Email || null;

    if (Number.isFinite(resultCode) && resultCode !== 0 && !Number.isFinite(stateCode)) {
      return {
        stateCode: -1,
        outSum: null,
        paid: false,
        sessionId: null,
        product: null,
        email: null,
      };
    }
    return {
      stateCode: Number.isFinite(stateCode) ? stateCode : -1,
      outSum: Number.isFinite(outSum) ? outSum : null,
      paid: stateCode === 100,
      sessionId,
      product,
      email,
    };
  } catch (e) {
    console.warn('[robokassa] OpStateExt failed', invId, e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
