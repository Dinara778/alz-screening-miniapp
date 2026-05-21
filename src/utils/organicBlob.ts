/** Органический «облачный» контур 200×200 для индекса (волнистый, не идеальный круг). */

type Pt = { x: number; y: number };

export type OrganicBlobOptions = {
  cx?: number;
  cy?: number;
  baseRadius?: number;
  /** Смещение фазы волн (для второго контура) */
  phase?: number;
  /** Число опорных точек по периметру */
  anchors?: number;
};

const WAVE_LAYERS: ReadonlyArray<[harmonics: number, amplitude: number]> = [
  [3, 0.24],
  [5, 0.16],
  [7, 0.1],
  [4, 0.08],
];

function blobRadius(angle: number, baseR: number, phase: number): number {
  let w = 0;
  for (const [h, amp] of WAVE_LAYERS) {
    w += Math.sin(angle * h + phase) * amp;
  }
  const squeeze = 1 + Math.cos(angle * 2 + phase * 0.7) * 0.07;
  return baseR * (1 + w) * squeeze;
}

export function buildOrganicBlobPoints(opts: OrganicBlobOptions = {}): Pt[] {
  const cx = opts.cx ?? 100;
  const cy = opts.cy ?? 100;
  const baseR = opts.baseRadius ?? 72;
  const phase = opts.phase ?? 0;
  const n = opts.anchors ?? 16;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    const r = blobRadius(t, baseR, phase);
    pts.push({
      x: cx + Math.cos(t - Math.PI / 2) * r,
      y: cy + Math.sin(t - Math.PI / 2) * r,
    });
  }
  return pts;
}

/** Закрытый путь с гладкими кубическими сегментами между опорными точками. */
export function smoothClosedPath(points: Pt[]): string {
  const n = points.length;
  if (n < 3) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return `${d} Z`;
}

export function buildOrganicBlobPath(opts: OrganicBlobOptions = {}): string {
  return smoothClosedPath(buildOrganicBlobPoints(opts));
}

/** Основной контур (экран индекса, share-карточка). */
export const ORGANIC_BLOB_PATH_MAIN = buildOrganicBlobPath();

/** Внутренний волнистый контур — второй штрих, как на референсе WHOOP. */
export const ORGANIC_BLOB_PATH_INNER = buildOrganicBlobPath({ baseRadius: 66, phase: 1.35, anchors: 14 });

export type BlobParticle = { x: number; y: number; r: number; o: number };

/** Частицы плотнее у волнистого края, реже к центру. */
export function buildBlobParticles(cx = 100, cy = 100, phase = 0): BlobParticle[] {
  const pts: BlobParticle[] = [];
  const n = 150;
  for (let i = 0; i < n; i += 1) {
    const angle = i * 2.399963229728653;
    const t = Math.pow((i + 0.5) / n, 0.46);
    const r = blobRadius(angle, 58, phase) * (0.48 + t * 0.52);
    pts.push({
      x: cx + Math.cos(angle - Math.PI / 2) * r * (0.96 + (i % 5) * 0.01),
      y: cy + Math.sin(angle - Math.PI / 2) * r * (0.97 + (i % 4) * 0.012),
      r: 0.45 + (i % 3) * 0.2 + (t > 0.62 ? 0.18 : 0),
      o: 0.2 + t * 0.48 + (i % 4) * 0.06,
    });
  }
  for (let i = 0; i < 44; i += 1) {
    const angle = i * 0.88 + 0.25 + phase * 0.15;
    const dist = blobRadius(angle, 70, phase) * (0.88 + (i % 5) * 0.025);
    pts.push({
      x: cx + Math.cos(angle - Math.PI / 2) * dist,
      y: cy + Math.sin(angle - Math.PI / 2) * dist,
      r: 0.5 + (i % 2) * 0.28,
      o: 0.48 + (i % 3) * 0.14,
    });
  }
  return pts;
}

export const ORGANIC_BLOB_PARTICLES = buildBlobParticles();

function tracePointsOnCanvas(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  cx: number,
  cy: number,
  scale: number,
): void {
  const s = scale / 100;
  const mapped = points.map((p) => ({ x: cx + (p.x - 100) * s, y: cy + (p.y - 100) * s }));
  const len = mapped.length;
  if (!len) return;
  ctx.beginPath();
  ctx.moveTo(mapped[0].x, mapped[0].y);
  for (let i = 0; i < len; i += 1) {
    const p0 = mapped[(i - 1 + len) % len];
    const p1 = mapped[i];
    const p2 = mapped[(i + 1) % len];
    const p3 = mapped[(i + 2) % len];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  ctx.closePath();
}

/** Рисует волнистый контур на canvas (scale ≈ радиус в пикселях). */
export function traceOrganicBlobOnCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  opts: OrganicBlobOptions = {},
): void {
  tracePointsOnCanvas(ctx, buildOrganicBlobPoints(opts), cx, cy, scale);
}
