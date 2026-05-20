import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Цвет облака / шкалы (как на экране индекса) */
  accent: string;
  className?: string;
  /** Меньше выступ обводки снизу — чтобы не заходить на текст под заголовком */
  tuckBottomOutline?: boolean;
  /** Больше отступ обводки — длинные заголовки на 2+ строк */
  generousOutline?: boolean;
};

/**
 * Ручная обводка вокруг заголовка: рамка через CSS, размер = весь блок текста
 * (все строки), обводка строго под текстом (z-index), без растягивания SVG.
 */
export const SketchHighlightTitle = ({
  children,
  accent,
  className = '',
  tuckBottomOutline = false,
  generousOutline = false,
}: Props) => {
  const modifiers = [
    tuckBottomOutline ? 'sketch-highlight-title--tuck-bottom' : '',
    generousOutline ? 'sketch-highlight-title--generous' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const boxStyle = { '--sketch-accent': accent } as CSSProperties;

  return (
    <h2
      className={`sketch-highlight-title mb-1 max-w-full text-left ${modifiers} ${className}`.trim()}
    >
      <span className="sketch-highlight-title__box" style={boxStyle}>
        <span className="sketch-highlight-title__text app-heading block leading-snug">
          {children}
        </span>
      </span>
    </h2>
  );
};
