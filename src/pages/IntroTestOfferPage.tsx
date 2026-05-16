import { Button } from '../components/Button';
import {
  BrainGlowArt,
  IconArrowRight,
  IconBrain,
  IconBulb,
  IconClock,
  IconShield,
  IconTrend,
} from '../components/landing/LandingIcons';
import { IntroShell } from '../components/landing/IntroShell';

type Props = {
  onContinue: () => void;
};

const FEATURES = [
  {
    Icon: IconClock,
    title: '10 минут',
    text: 'Пройдите в удобное время',
  },
  {
    Icon: IconBrain,
    title: '5 ключевых когнитивных областей',
    text: 'Память, внимание, скорость, гибкость, устойчивость',
  },
  {
    Icon: IconTrend,
    title: 'Объективный результат',
    text: 'На основе научных методик и статистики',
  },
  {
    Icon: IconBulb,
    title: 'Рекомендации сразу',
    text: 'Получите персональные советы по вашему профилю',
  },
] as const;

export const IntroTestOfferPage = ({ onContinue }: Props) => {
  const footer = (
    <div className="space-y-4">
      <Button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-0 bg-emerald-400 py-4 text-[1.0625rem] font-bold leading-snug text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-300 sm:py-[1.125rem] sm:text-xl"
        onClick={onContinue}
      >
        <span>Начать тест бесплатно</span>
        <IconArrowRight className="h-5 w-5 shrink-0" />
      </Button>
      <p className="flex items-center justify-center gap-2 text-center text-sm text-emerald-200/90">
        <IconShield className="h-5 w-5 shrink-0 text-emerald-400" />
        <span>Это бесплатно и займёт всего 10 минут</span>
      </p>
    </div>
  );

  return (
    <IntroShell aria-label="Описание теста" footer={footer}>
      <div className="space-y-5 pb-4">
        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/80 via-[#0a1210] to-slate-950 p-5 shadow-[0_0_40px_-12px_rgba(52,211,153,0.35)]">
          <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-300">
            Бесплатно
          </span>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">Тест на когнитивный статус</h2>
              <ul className="space-y-4">
                {FEATURES.map(({ Icon, title, text }) => (
                  <li key={title} className="flex gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-sm leading-snug text-slate-400">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <BrainGlowArt className="mx-auto h-32 w-32 shrink-0 sm:mx-0 sm:h-36 sm:w-36" />
          </div>
        </div>
      </div>
    </IntroShell>
  );
};
