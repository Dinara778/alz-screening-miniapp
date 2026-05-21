import { useState } from 'react';
import { Button } from '../components/Button';
import { CalmCardShell } from '../components/CalmCardShell';
import { ScreenBottomCta } from '../components/ScreenBottomCta';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { saveLegalConsent } from '../utils/legalConsent';

type Props = {
  onContinue: () => void;
  onOpenPersonalDataConsent: () => void;
  onOpenUserAgreement: () => void;
};

const checkboxClass =
  'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2 border-white/35 bg-transparent accent-emerald-500';

const ConsentCheckbox = ({
  checked,
  onChange,
  label,
  docLink,
  onOpenDoc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  docLink: string;
  onOpenDoc: () => void;
}) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20">
    <input
      type="checkbox"
      className={checkboxClass}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="text-left text-sm leading-relaxed text-white/90 sm:text-base">
      {label}{' '}
      <button
        type="button"
        className="inline text-left font-medium text-emerald-300 underline decoration-emerald-400/50 underline-offset-2 hover:text-emerald-200"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenDoc();
        }}
      >
        {docLink}
      </button>
    </span>
  </label>
);

export const LegalConsentPage = ({ onContinue, onOpenPersonalDataConsent, onOpenUserAgreement }: Props) => {
  const [pdConsent, setPdConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const canContinue = pdConsent && termsAccepted;

  const handleContinue = () => {
    if (!canContinue) return;
    saveLegalConsent();
    onContinue();
  };

  return (
    <CalmCardShell fill>
      <ScreenBottomCta
        footer={
          <Button
            type="button"
            className={CTA_BUTTON_CLASS}
            disabled={!canContinue}
            onClick={handleContinue}
          >
            Далее
          </Button>
        }
      >
        <div className="mx-auto w-full max-w-md space-y-6 px-1 sm:px-2">
          <h1 className="app-heading text-center leading-snug sm:text-left">
            Чтобы продолжить, нам нужно ваше разрешение
          </h1>
          <p className="calm-body text-center text-sm leading-relaxed text-white/75 sm:text-left sm:text-base">
            Пожалуйста, отметьте галочками обязательные пункты ниже:
          </p>
          <div className="space-y-3">
            <ConsentCheckbox
              checked={pdConsent}
              onChange={setPdConsent}
              label="Я даю"
              docLink="Согласие на обработку персональных данных"
              onOpenDoc={onOpenPersonalDataConsent}
            />
            <ConsentCheckbox
              checked={termsAccepted}
              onChange={setTermsAccepted}
              label="Я принимаю условия"
              docLink="Пользовательского соглашения"
              onOpenDoc={onOpenUserAgreement}
            />
          </div>
        </div>
      </ScreenBottomCta>
    </CalmCardShell>
  );
};
