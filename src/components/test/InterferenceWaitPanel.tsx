type Props = {
  remainingSec: number;
};

/** Экран ожидания до отсроченного воспроизведения — динамическая подложка */
export const InterferenceWaitPanel = ({ remainingSec }: Props) => (
  <div className="interference-wait-shell relative flex min-h-[min(52dvh,420px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 px-6 py-10 text-center">
    <div className="interference-wait-orb interference-wait-orb-a" aria-hidden />
    <div className="interference-wait-orb interference-wait-orb-b" aria-hidden />
    <div className="interference-wait-orb interference-wait-orb-c" aria-hidden />
    <div className="relative z-10 space-y-4">
      <h2 className="text-lg font-bold leading-snug text-white/95 sm:text-xl">
        Ожидание до отсроченного воспроизведения
      </h2>
      <p className="text-sm leading-relaxed text-white/65 sm:text-base">
        Сейчас пройдут другие задания. Затем снова попросим вспомнить слова.
      </p>
      <p className="text-[clamp(3.5rem,18vw,5rem)] font-semibold tabular-nums leading-none text-teal-300">
        {remainingSec}
        <span className="ml-2 text-2xl font-medium text-white/50 sm:text-3xl">с</span>
      </p>
    </div>
  </div>
);
