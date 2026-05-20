import type { ReactNode } from 'react';
import { Button } from './Button';
import { CalmCardShell } from './CalmCardShell';
import type { PaidReportData } from '../utils/paidReport';

type Props = {
  open: boolean;
  data: PaidReportData | null;
  onClose: () => void;
};

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300/85">{children}</h3>
);

export const PaidReportModal = ({ open, data, onClose }: Props) => {
  if (!open || !data) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paid-report-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <CalmCardShell
        className="relative z-10 flex max-h-[min(94dvh,820px)] w-full max-w-lg flex-col rounded-b-none sm:rounded-3xl"
        innerClassName="flex min-h-0 flex-1 flex-col p-0"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <h2 id="paid-report-modal-title" className="app-heading text-lg leading-snug sm:text-xl">
                {data.title}
              </h2>
              <p className="mt-1 text-sm text-white/50">{data.dateLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full px-2 py-1 text-2xl leading-none text-white/50 hover:text-white"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          <section className="mt-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">
              Индекс когнитивной устойчивости
            </p>
            <p
              className="mt-2 text-[clamp(3rem,14vw,4rem)] font-bold tabular-nums leading-none"
              style={{ color: data.indexAccent }}
            >
              {data.indexValue}
              <span className="text-[0.35em] font-medium text-white/40"> /100</span>
            </p>
            <p className="mt-2 text-base font-semibold text-white/90">{data.indexLabel}</p>
          </section>

          <section className="mt-8 space-y-4 calm-inset">
            <SectionTitle>Расширенная интерпретация</SectionTitle>
            <div className="space-y-3 results-body text-sm leading-relaxed text-white/88">
              <p>
                <span className="font-semibold text-white/95">В жизни: </span>
                {data.extendedInterpretation.inLife}
              </p>
              <p>
                <span className="font-semibold text-white/95">Как это ощущается: </span>
                {data.extendedInterpretation.feeling}
              </p>
              <p>
                <span className="font-semibold text-white/95">О чём говорит результат: </span>
                {data.extendedInterpretation.aboutResult}
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <SectionTitle>Ведущий дефицит</SectionTitle>
            <p className="results-body text-sm text-white/88">
              <span className="font-semibold text-white">{data.leadingDeficitTitle}</span>
              {data.leadingDeficitKey && data.indexValue < 70
                ? ' — домен с наименьшим баллом в вашем профиле; на него опираются рекомендации ниже.'
                : ' — в вашем профиле нет выраженного «провала» по одному домену.'}
            </p>
          </section>

          <section className="mt-6 space-y-3">
            <SectionTitle>Персональная карта перегрузки</SectionTitle>
            {data.overloadEntries.length > 0 ? (
              <ul className="space-y-3">
                {data.overloadEntries.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm leading-relaxed"
                  >
                    <p className="font-semibold text-white">{row.title}</p>
                    <p className="mt-2 calm-body text-white/88">{row.description}</p>
                    <p className="mt-2 calm-body text-white/75">
                      <span className="font-medium text-white/90">Пример: </span>
                      {row.example}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="calm-inset calm-body text-sm text-white/70">
                По этому прохождению выраженных зон перегрузки не выделено — профиль выглядит
                устойчивым.
              </p>
            )}
          </section>

          <section className="mt-6 space-y-3">
            <SectionTitle>Адресные рекомендации</SectionTitle>
            <ul className="calm-inset list-none space-y-2.5 results-body text-sm">
              {data.seriousRecommendations.map((line) => (
                <li key={line} className="flex gap-2 text-white/88">
                  <span className="shrink-0 text-emerald-400" aria-hidden>
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-6 border-t border-white/10 pt-4 text-center text-xs leading-relaxed text-white/45">
            {data.footerDisclaimer}
          </p>
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-4 sm:px-6">
          <Button type="button" variant="sell" className="w-full rounded-2xl py-3.5 font-bold" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </CalmCardShell>
    </div>
  );
};
