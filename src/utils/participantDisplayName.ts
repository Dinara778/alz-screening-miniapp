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

/** «Игорь, стабильность реакции» — имя + заголовок с маленькой буквы. */
export function formatPersonalizedHeading(name: string | null, heading: string): string {
  if (!name) return heading;
  const h = heading.trim();
  if (!h) return name;
  return `${name}, ${h.charAt(0).toLowerCase()}${h.slice(1)}`;
}
