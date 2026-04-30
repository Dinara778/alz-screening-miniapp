export const avg = (arr: number[]): number => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export const median = (arr: number[]): number => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const stdDev = (arr: number[]): number => {
  if (!arr.length) return 0;
  const mean = avg(arr);
  const variance = avg(arr.map((x) => (x - mean) ** 2));
  return Math.sqrt(variance);
};

export const cv = (arr: number[]): number => {
  const mean = avg(arr);
  if (!arr.length || mean === 0) return 0;
  return (stdDev(arr) / mean) * 100;
};
