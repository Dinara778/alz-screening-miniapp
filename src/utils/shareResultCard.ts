/** PNG-карточка для «Поделиться»: индекс в светящем круге + текст, как на экране результата. */

import { buildBlobParticles, traceOrganicBlobOnCanvas } from './organicBlob';

const CARD_W = 1080;
const CARD_H = 1400;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function drawHalo(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, accent: string): void {
  for (let layer = 6; layer >= 1; layer--) {
    const g = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * (0.55 + layer * 0.12));
    g.addColorStop(0, rgba(accent, 0.12 + layer * 0.02));
    g.addColorStop(0.55, rgba(accent, 0.08));
    g.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (0.72 + layer * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }

  const particles = buildBlobParticles(100, 100, 0);
  const s = (radius * 1.05) / 100;
  for (const p of particles) {
    const px = cx + (p.x - 100) * s;
    const py = cy + (p.y - 100) * s;
    ctx.beginPath();
    ctx.arc(px, py, p.r * s * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(accent, p.o);
    ctx.fill();
  }

  ctx.save();
  traceOrganicBlobOnCanvas(ctx, cx, cy, radius * 1.05);
  ctx.fillStyle = rgba(accent, 0.1);
  ctx.fill();
  traceOrganicBlobOnCanvas(ctx, cx, cy, radius * 1.05);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.92;
  ctx.stroke();
  traceOrganicBlobOnCanvas(ctx, cx, cy, radius * 0.98, { baseRadius: 66, phase: 1.35 });
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  let line = '';
  let cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = words[i] ?? '';
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}

export type ShareCardOptions = {
  indexValue: number;
  accent: string;
};

export async function renderShareResultCard({ indexValue, accent }: ShareCardOptions): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');

  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#0a0e0d');
  bg.addColorStop(1, '#050807');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const haloCx = CARD_W / 2;
  const haloCy = 460;
  const haloR = 300;
  drawHalo(ctx, haloCx, haloCy, haloR, accent);

  const score = Math.round(Math.max(0, Math.min(100, indexValue)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 170px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(score), haloCx, haloCy - 12);
  const scoreW = ctx.measureText(String(score)).width;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '500 46px system-ui, -apple-system, sans-serif';
  ctx.fillText('/100', haloCx + scoreW / 2 + 36, haloCy + 28);

  const pad = 72;
  const textX = CARD_W / 2;
  let y = 820;
  const maxW = CARD_W - pad * 2;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
  y = wrapText(
    ctx,
    'ВАУ! Я только что получил отчёт о том, как реально работает мой мозг 🧠',
    textX,
    y,
    maxW,
    54,
  );

  y += 20;
  ctx.font = '500 36px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  y = wrapText(ctx, 'Это удивительно — понимать себя стало так легко!', textX, y, maxW, 50);

  y += 48;
  const btnW = 520;
  const btnH = 88;
  const btnX = (CARD_W - btnW) / 2;
  const btnY = y;
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
  btnGrad.addColorStop(0, '#34d399');
  btnGrad.addColorStop(1, '#10b981');
  ctx.fillStyle = btnGrad;
  roundRect(ctx, btnX, btnY, btnW, btnH, 44);
  ctx.fill();
  ctx.fillStyle = '#042f1a';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillText('Попробуй бесплатно!', CARD_W / 2, btnY + btnH / 2 + 2);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '500 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('Corta daily', CARD_W / 2, CARD_H - 56);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('png_export_failed'))),
      'image/png',
      0.92,
    );
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
