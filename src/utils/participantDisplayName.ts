const PLACEHOLDER_NAMES = new Set([
  'не указано',
  'не',
  'пользователь',
  'тест',
  'test',
]);

function isPlaceholderName(value: string): boolean {
  const n = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!n) return true;
  if (PLACEHOLDER_NAMES.has(n)) return true;
  if (n.startsWith('не указано')) return true;
  return false;
}

/** Первое имя из анкеты для обращения на экране результата. */
export function formatParticipantFirstName(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || isPlaceholderName(trimmed)) return null;

  const first = trimmed.split(/\s+/)[0]?.trim();
  if (!first || isPlaceholderName(first)) return null;
  if (first.length < 2) return null;

  return first;
}

/** «Игорь, стабильность реакции» — имя + заголовок с маленькой буквы. */
export function formatPersonalizedHeading(name: string | null, heading: string): string {
  if (!name) return heading;
  const h = heading.trim();
  if (!h) return name;
  return `${name}, ${h.charAt(0).toLowerCase()}${h.slice(1)}`;
}
