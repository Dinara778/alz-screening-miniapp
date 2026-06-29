/**
 * Разовый импорт из CSV (экспорт листа events из Google Sheets).
 */
import { recordPayment, upsertAssessment, upsertFunnelSession, upsertUserByEmail } from './supabaseStore.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw) {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) return null;
  if (email === 'не указано') return null;
  return email;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function parseSheetsCsv(text) {
  const normalized = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim());
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
}

function parseExtra(raw) {
  const text = String(raw ?? '').trim();
  if (!text.startsWith('{')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clampScore(n, fallback = 50) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}

function scoreFromFlags(flagsRaw) {
  const flags = Number(flagsRaw);
  if (!Number.isFinite(flags)) return 50;
  return clampScore(100 - flags * 12, 50);
}

export async function importSheetsCsvRows(rows, env = process.env) {
  const stats = {
    rows: rows.length,
    users: 0,
    funnel: 0,
    assessments: 0,
    payments: 0,
    skipped: 0,
    errors: 0,
  };

  const seenUsers = new Set();

  for (const row of rows) {
    const eventType = String(row.eventtype ?? row.eventType ?? '').trim();
    const email = normalizeEmail(row.email);
    if (!email) {
      stats.skipped += 1;
      continue;
    }

    try {
      const user = await upsertUserByEmail(email, env);
      if (!user) {
        stats.errors += 1;
        continue;
      }
      if (!seenUsers.has(email)) {
        seenUsers.add(email);
        stats.users += 1;
      }

      const sessionId = String(row.sessionid ?? row.sessionId ?? '').trim();
      const screen = String(row.screen ?? row.stage ?? '').trim();
      const timestamp = String(row.timestamp ?? '').trim();

      if (
        eventType === 'form_submitted' ||
        eventType === 'form_started' ||
        (eventType === 'funnel_milestone' && String(row.stage ?? '') === 'welcome')
      ) {
        if (sessionId) {
          const saved = await upsertFunnelSession(
            {
              email,
              visitId: sessionId,
              lastScreen: screen || 'welcome/email',
              status: 'in_progress',
            },
            env,
          );
          if (saved) stats.funnel += 1;
        }
      }

      if (eventType === 'app_exit' && sessionId) {
        const saved = await upsertFunnelSession(
          {
            email,
            visitId: sessionId,
            lastScreen: screen || 'unknown',
            screensPath: screen || undefined,
            status: 'abandoned',
            exitReason: String(row.exitreason ?? row.exitReason ?? '').trim() || undefined,
          },
          env,
        );
        if (saved) stats.funnel += 1;
      }

      if (eventType === 'session_completed' && sessionId) {
        const extra = parseExtra(row.extra);
        const flags = row.indexflags ?? row.indexFlags ?? extra?.flags;
        const score = scoreFromFlags(flags);
        const saved = await upsertAssessment(
          {
            email,
            sessionId: extra?.id || sessionId,
            score,
            memoryScore: score,
            attentionScore: score,
            speedScore: score,
            stabilityScore: score,
            flexibilityScore: score,
          },
          env,
        );
        if (saved) {
          stats.assessments += 1;
          await upsertFunnelSession(
            {
              email,
              visitId: sessionId,
              lastScreen: 'result',
              screensPath: screen || undefined,
              status: 'completed',
              assessmentSessionId: saved.session_id,
            },
            env,
          );
        }
      }

      if (
        (eventType === 'payment_paid_server' || eventType === 'payment_paid') &&
        sessionId
      ) {
        const extra = parseExtra(row.extra);
        const amountRub = Number(extra?.amountRub ?? extra?.amount ?? 149);
        const saved = await recordPayment(
          {
            email,
            sessionId,
            product: extra?.product ?? 'full_report',
            amountRub: Number.isFinite(amountRub) ? amountRub : 149,
            type: 'one_time',
            status: 'paid',
            externalId: extra?.invId ?? extra?.externalId,
          },
          env,
        );
        if (saved) stats.payments += 1;
      }

      if (timestamp) {
        // timestamp preserved in sheets only; Supabase created_at stays import time unless we add backdating later
      }
    } catch (error) {
      stats.errors += 1;
      console.error('[sheets-import] row failed', eventType, email, error);
    }
  }

  return stats;
}

export async function importSheetsCsvText(csvText, env = process.env) {
  const rows = parseSheetsCsv(csvText);
  if (!rows.length) {
    return { ok: false, error: 'empty_csv', stats: null };
  }
  const stats = await importSheetsCsvRows(rows, env);
  return { ok: true, stats };
}
