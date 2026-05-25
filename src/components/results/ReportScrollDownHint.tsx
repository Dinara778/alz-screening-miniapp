import { useEffect, useState, type RefObject } from 'react';

type Props = {
  scrollRef: RefObject<HTMLDivElement | null>;
};

/** Подсказка прокрутки на длинном экране отчёта (исчезает после скролла). */
export const ReportScrollDownHint = ({ scrollRef }: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 24;
      const startedScroll = el.scrollTop > 40;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      setVisible(canScroll && !startedScroll && !nearBottom);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scrollRef]);

  if (!visible) return null;

  return (
    <div
      className="report-scroll-hint pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2"
      role="presentation"
      aria-hidden
    >
      <p className="report-scroll-hint-label text-center text-xs font-semibold tracking-wide sm:text-sm">
        Прокрутите вниз
      </p>
      <svg
        className="report-scroll-hint-arrow h-10 w-10 sm:h-11 sm:w-11"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
      >
        <path
          d="M8 12l8 8 8-8"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 18l8 8 8-8"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </svg>
    </div>
  );
};
