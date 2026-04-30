interface TelegramWebApp {
  ready(): void;
  expand(): void;
  colorScheme: 'light' | 'dark';
  themeParams?: Record<string, string>;
  MainButton?: {
    text: string;
    isVisible: boolean;
    setText(text: string): void;
    show(): void;
    hide(): void;
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
