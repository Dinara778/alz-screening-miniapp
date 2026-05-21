import { LegalDocShell } from '../components/legal/LegalDocShell';
import { userAgreementSections } from '../copy/legalDocuments';

type Props = { onBack: () => void };

export const UserAgreementDocPage = ({ onBack }: Props) => (
  <LegalDocShell title="Пользовательское соглашение" onBack={onBack}>
    {userAgreementSections.map((s) => (
      <section key={s.title}>
        <h2 className="mb-2 font-semibold text-white/95">{s.title}</h2>
        <p>{s.body}</p>
      </section>
    ))}
  </LegalDocShell>
);
