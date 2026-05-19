import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** fill — на весь экран (интро); content — высота по контенту, скролл снаружи */
  layout?: 'fill' | 'content';
};

/** Оболочка экрана: единая flex-цепочка без скачков между стадиями. */
export const StageViewport = ({ children, layout = 'fill' }: Props) => (
  <div
    className={
      layout === 'content'
        ? 'flex w-full shrink-0 flex-col'
        : 'flex min-h-0 w-full flex-1 flex-col'
    }
  >
    {children}
  </div>
);
