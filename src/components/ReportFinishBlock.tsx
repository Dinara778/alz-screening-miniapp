import { Button } from './Button';
import { SupportFooter } from './SupportFooter';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';

export type ReportFinishMode = {
  cabinetHref: string;
  homeHref?: string;
  onHome?: () => void;
};

export const ReportTomorrowBanner = () => (
  <div
    className="report-tomorrow-banner rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/35 via-amber-400/20 to-emerald-500/25 px-4 py-4 text-center shadow-lg shadow-amber-900/30"
    role="status"
  >
    <p className="text-lg font-bold leading-snug text-amber-50 sm:text-xl">
      ⚡ Вернитесь завтра утром
    </p>
    <p className="mt-2 text-sm leading-relaxed text-white/90 sm:text-base">
      🧠 Пройдите короткую проверку после сна — так вы увидите, как восстановились, и получите
      максимум от подписки.
    </p>
  </div>
);

export const ReportFinishFooter = ({ mode }: { mode: ReportFinishMode }) => (
  <div className="space-y-3">
    <a href={mode.cabinetHref} className={`cabinet-access-btn block text-center ${CTA_BUTTON_CLASS}`}>
      В кабинет
    </a>
    {mode.onHome ? (
      <Button type="button" variant="secondary" className={CTA_BUTTON_CLASS} onClick={mode.onHome}>
        На главную
      </Button>
    ) : mode.homeHref ? (
      <a
        href={mode.homeHref}
        className={`block text-center ${CTA_BUTTON_CLASS} rounded-2xl border border-white/20 bg-white/5 font-bold text-white/90 transition hover:border-white/35 hover:bg-white/10`}
      >
        На главную
      </a>
    ) : null}
    <SupportFooter showDeveloperCredit={false} showCabinetAccess={false} />
  </div>
);
