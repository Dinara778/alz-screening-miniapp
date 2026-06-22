/** Corta в браузере (сайт / PWA), не внутри Telegram Mini App. */
export const isTelegramMiniApp = (): boolean => {
  const tg = window.Telegram?.WebApp;
  return Boolean(tg?.initData && tg?.version);
};

export const isStandaloneWeb = (): boolean => !isTelegramMiniApp();
