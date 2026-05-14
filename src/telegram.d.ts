/** https://core.telegram.org/bots/webapps */
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string | undefined>;
  /** Подписанная строка для проверки на бэкенде */
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  isExpanded?: boolean;
  /** Нативная оплата Telegram (счёт из createInvoiceLink). */
  openInvoice(url: string, callback?: (status: string) => void): void;
  /** Внешняя оплата (например Prodamus в браузере). */
  openLink?(url: string, options?: { try_instant_view?: boolean }): void;
  /** Открывает t.me-ссылку (в т.ч. шаринг через t.me/share/url). */
  openTelegramLink(url: string): void;
  onEvent?(eventType: string, eventHandler: () => void): void;
  offEvent?(eventType: string, eventHandler: () => void): void;
  MainButton?: {
    text: string;
    isVisible: boolean;
    setText(text: string): void;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export {};
