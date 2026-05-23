import type { AnimalOfTheDayCard } from '../copy/animalOfTheDay';

const CARD_W = 1080;
const CARD_H = 1400;

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

export type ShareAnimalCardOptions = {
  card: AnimalOfTheDayCard;
};

export async function renderShareAnimalCard({ card }: ShareAnimalCardOptions): Promise<Blob> {
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

  const pad = 72;
  const centerX = CARD_W / 2;
  const maxW = CARD_W - pad * 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 40px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Сегодня ты:', centerX, 80);

  ctx.font = '400 220px system-ui, -apple-system, sans-serif';
  ctx.fillText(card.emoji, centerX, 160);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
  ctx.fillText(card.animalLabel, centerX, 420);

  let y = 540;
  ctx.font = '600 38px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  y = wrapText(ctx, card.fixedLine, centerX, y, maxW, 52);

  y += 28;
  ctx.font = '500 36px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  wrapText(ctx, card.indexLine, centerX, y, maxW, 50);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '500 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('Corta', centerX, CARD_H - 56);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('png_export_failed'))),
      'image/png',
      0.92,
    );
  });
}
