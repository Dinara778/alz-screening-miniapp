import { SupportFooter } from './SupportFooter';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';

export type ReportFinishMode = {
  cabinetHref: string;
  /** @deprecated кнопка «На главную» убрана */
  homeHref?: string;
  /** @deprecated кнопка «На главную» убрана */
  onHome?: () => void;
};

/** @deprecated плашка больше не показывается */
export const ReportTomorrowBanner = () => null;

export const ReportFinishFooter = ({ mode }: { mode: ReportFinishMode }) => (
  <div className="space-y-3">
    <a href={mode.cabinetHref} className={`cabinet-access-btn block text-center ${CTA_BUTTON_CLASS}`}>
      Вернуться в кабинет, чтобы посмотреть динамику изменений
    </a>
    <SupportFooter showDeveloperCredit={false} showCabinetAccess={false} />
  </div>
);
