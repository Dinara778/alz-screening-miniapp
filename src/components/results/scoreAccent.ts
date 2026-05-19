/** Акцентный цвет шкалы по баллу 0–100 (calm tech palette). */
export function scoreAccentFromValue(score: number): string {
  const v = Math.max(0, Math.min(100, Math.round(score)));
  if (v >= 80) return '#34d399';
  if (v >= 70) return '#4ade80';
  if (v >= 60) return '#a3e635';
  if (v >= 50) return '#fbbf24';
  if (v >= 40) return '#fb923c';
  if (v >= 25) return '#f97316';
  return '#f87171';
}
