import { REPORT_TARIFFS, SUBSCRIPTION_CANCEL_HINT } from '../constants/reportTariffs';
import type { ReportUnlockProduct } from '../utils/paymentProductTypes';
import { Button } from './Button';

type Props = {
  onSelect: (product: ReportUnlockProduct) => void;
  busyProduct?: ReportUnlockProduct | null;
  reportUnlocked?: boolean;
};

export const ReportTariffOffer = ({
  onSelect,
  busyProduct,
  reportUnlocked,
}: Props) => (
  <div className="report-tariff-screen mx-auto w-full max-w-md">
    <div className="report-tariff-list">
      {REPORT_TARIFFS.map((tariff) => (
        <article
          key={tariff.product}
          className={`report-tariff-card${tariff.highlighted ? ' report-tariff-card--highlight' : ''}`}
        >
          <div className="report-tariff-card-top">
            <div className="report-tariff-plan">
              <span className="report-tariff-emoji" aria-hidden>
                {tariff.emoji}
              </span>
              <h3 className="report-tariff-name">{tariff.name}</h3>
            </div>
            <div className="report-tariff-price-block">
              {tariff.badge ? <span className="report-tariff-badge">{tariff.badge}</span> : null}
              <p className="report-tariff-price-amount">{tariff.priceAmount}</p>
              <p className="report-tariff-price-period">{tariff.pricePeriod}</p>
            </div>
          </div>

          <p className="report-tariff-section-title">{tariff.sectionTitle}</p>

          <ul className="report-tariff-features">
            {tariff.features.map((feature) => (
              <li key={feature} className="report-tariff-feature">
                {feature}
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
    </div>

    <p className="report-tariff-cancel-hint">{SUBSCRIPTION_CANCEL_HINT}</p>
  </div>
);
