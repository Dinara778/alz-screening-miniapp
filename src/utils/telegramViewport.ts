/**
 * Развёртывание мини-аппа и полноэкранный режим (Telegram Bot API 8.0+).
 * В полноэкране шапка клиента прозрачная, интерфейс занимает больше площади.
 * На старых клиентах без API достаточно expand().
 */
export function enterTelegramImmersiveMode(): void {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  tg.expand();
  if (typeof tg.requestFullscreen === 'function') {
    tg.requestFullscreen();
  }
}

/** Возврат из полноэкрана (например, на экране интро). */
export function exitTelegramImmersiveMode(): void {
  const tg = window.Telegram?.WebApp;
  if (!tg || typeof tg.exitFullscreen !== 'function') return;
  if (tg.isFullscreen) tg.exitFullscreen();
}
