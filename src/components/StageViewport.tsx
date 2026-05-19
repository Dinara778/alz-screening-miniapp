import type { ReactNode } from 'react';

/** Единая обёртка экрана: одинаковая высота и flex-цепочка для всех стадий. */
export const StageViewport = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-0 w-full flex-1 flex-col">{children}</motion.div>
);
