import { REPORT_TARIFFS, SUBSCRIPTION_CANCEL_HINT } from '../constants/reportTariffs';
import type { ReportUnlockProduct } from '../utils/paymentProductTypes';
import { Button } from './Button';
import { SameEmailHint } from './SameEmailHint';

type Props = {
  onSelect: (product: ReportUnlockProduct) => void;
  busyProduct?: ReportUnlockProduct | null;
  reportUnlocked?: boolean;
  payerEmail?: string | null;
};

export const ReportTariffOffer = ({
  onSelect,
  busyProduct,
  reportUnlocked,
  payerEmail,
}: Props) => (
  <div className="mx-auto w-full max-w-md space-y-4">
    <p className="app-heading leading-snug text-white/95">
      Выберите формат доступа к расширенному отчёту
    </p>
    <SameEmailHint email={payerEmail} />

    {REPORT_TARIFFS.map((tariff) => (
      <article
        key={tariff.product}
        className={`report-tariff-card${tariff.highlighted ? ' report-tariff-card--highlight' : ''}`}
      >
        <div className="report-tariff-head">
          <span className="report-tariff-emoji" aria-hidden>
            {tariff.emoji}
          </span>
          <div>
            <h3 className="report-tariff-name">{tariff.name}</h3>
            <p className="report-tariff-price">{tariff.priceLabel}</p>
          </div>
        </div>

        <p className="report-tariff-tagline">{tariff.tagline}</p>

        <ul className="report-tariff-features">
          {tariff.features.map((feature) => (
            <li key={feature.text} className="report-tariff-feature">
              <span
                className={feature.included ? 'report-tariff-check' : 'report-tariff-cross'}
                aria-hidden
              >
                {feature.included ? '✔' : '❌'}
              </span>
              <span>{feature.text}</span>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant={tariff.highlighted ? 'sell' : 'secondary'}
          className="report-tariff-cta"
          disabled={Boolean(busyProduct)}
          onClick={() => onSelect(tariff.product)}
        >
          {busyProduct === tariff.product
            ? 'Открываем оплату…'
            : reportUnlocked
              ? 'Открыть расшифровку'
              : tariff.cta}
        </Button>
      </article>
    ))}

    <p className="report-tariff-cancel-hint">{SUBSCRIPTION_CANCEL_HINT}</p>
  </div>
);
