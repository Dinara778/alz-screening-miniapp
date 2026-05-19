import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { IconArrowRight } from '../components/landing/LandingIcons';
import { IntroShell } from '../components/landing/IntroShell';
import { CORTA_VALUE_PROPS } from '../constants/cortaValueProps';

type Props = {
  onContinue: () => void;
};

const REVEAL_MS = 2400;

export const ValuePropsIntroPage = ({ onContinue }: Props) => {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (visibleCount >= CORTA_VALUE_PROPS.length) return;
    const id = window.setTimeout(() => setVisibleCount((c) => c + 1), REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [visibleCount]);

  const footer = (
    <Button
      type="button"
      className="flex w-full items-center justify-center gap-2 rounded-2xl border-0 bg-emerald-400 py-4 text-center text-[1.0625rem] font-bold leading-snug text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-300 sm:py-[1.125rem] sm:text-xl"
      onClick={onContinue}
    >
      <span>Проверить своё состояние бесплатно</span>
      <IconArrowRight className="h-5 w-5 shrink-0" />
    </Button>
  );

  return (
    <IntroShell aria-label="Преимущества Corta" footer={footer} centerContent>
      <div className="flex min-h-[min(42dvh,360px)] w-full flex-col items-center justify-center px-2">
        <ul className="flex w-full max-w-md flex-col items-center gap-6">
          {CORTA_VALUE_PROPS.map(({ Icon, title }, i) =>
            i < visibleCount ? (
              <li
                key={title}
                className="value-prop-pop flex w-full max-w-sm flex-col items-center gap-3 text-center"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/25">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="text-base font-semibold leading-snug text-white sm:text-lg">{title}</p>
              </li>
            ) : null,
          )}
        </ul>
      </div>
    </IntroShell>
  );
};
