import { LegalDocShell } from '../components/legal/LegalDocShell';
import { personalDataConsentSections } from '../copy/legalDocuments';

type Props = { onBack: () => void };

export const PersonalDataConsentDocPage = ({ onBack }: Props) => (
  <LegalDocShell title="Согласие на обработку персональных данных" onBack={onBack}>
    {personalDataConsentSections.map((s) => (
      <section key={s.title}>
        <h2 className="mb-2 font-semibold text-white/95">{s.title}</h2>
        <p>{s.body}</p>
      </section>
    ))}
  </LegalDocShell>
);
