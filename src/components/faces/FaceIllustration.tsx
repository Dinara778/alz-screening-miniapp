/** Встроенные иллюстрации лиц — надёжнее, чем &lt;img src="*.svg"&gt; в Telegram на iOS. */
type Props = {
  faceId: number;
  className?: string;
  title?: string;
};

const common = 'block h-full w-full';

function Face1({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <rect width="400" height="300" fill="#D1D5DB" />
      <circle cx="200" cy="120" r="70" fill="#F3D5B5" />
      <path
        d="M130 110C130 74 159 45 195 45H205C241 45 270 74 270 110V120H130V110Z"
        fill="#1F2937"
      />
      <circle cx="172" cy="120" r="7" fill="#111827" />
      <circle cx="228" cy="120" r="7" fill="#111827" />
      <path
        d="M176 154C185 164 215 164 224 154"
        stroke="#7C2D12"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="130" y="205" width="140" height="90" rx="24" fill="#374151" />
    </svg>
  );
}

function Face2({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <rect width="400" height="300" fill="#CBD5E1" />
      <circle cx="200" cy="120" r="70" fill="#EAC39A" />
      <path
        d="M125 110C125 66 160 30 204 30C248 30 283 66 283 110V120H125V110Z"
        fill="#111827"
      />
      <rect x="150" y="152" width="100" height="14" rx="7" fill="#92400E" />
      <circle cx="172" cy="118" r="7" fill="#0F172A" />
      <circle cx="228" cy="118" r="7" fill="#0F172A" />
      <rect x="126" y="205" width="148" height="95" rx="22" fill="#1E3A8A" />
    </svg>
  );
}

function Face3({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <rect width="400" height="300" fill="#E2E8F0" />
      <circle cx="200" cy="122" r="70" fill="#E8C29C" />
      <path
        d="M130 114C130 75 161 44 200 44C239 44 270 75 270 114V120H130V114Z"
        fill="#334155"
      />
      <circle cx="172" cy="122" r="7" fill="#0F172A" />
      <circle cx="228" cy="122" r="7" fill="#0F172A" />
      <path
        d="M174 155C183 163 217 163 226 155"
        stroke="#7C2D12"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="126" y="206" width="148" height="94" rx="22" fill="#14532D" />
    </svg>
  );
}

export const FaceIllustration = ({ faceId, className, title }: Props) => {
  const svgClass = className ?? common;
  const inner =
    faceId === 1 ? (
      <Face1 className={svgClass} />
    ) : faceId === 2 ? (
      <Face2 className={svgClass} />
    ) : faceId === 3 ? (
      <Face3 className={svgClass} />
    ) : (
      <Face1 className={svgClass} />
    );

  return (
    <div
      className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl bg-slate-200"
      role="img"
      aria-label={title ?? 'Портрет для запоминания'}
    >
      {inner}
    </div>
  );
};
