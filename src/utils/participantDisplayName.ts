const PLACEHOLDER_NAMES = new Set(['не указано', 'пользователь', 'тест', 'test']);

/** Первое имя из анкеты для обращения на экране результата. */
export function formatParticipantFirstName(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0]?.trim();
  if (!first || first.length < 2) return null;
  if (PLACEHOLDER_NAMES.has(first.toLowerCase())) return null;
  return first;
}
