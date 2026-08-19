// Custom mark: a house silhouette with a forward-moving path/arrow cut
// through it — reads as "a home in motion" without leaning on an emoji.
export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-brand-600" />
      <path
        d="M9 17.5 16 11l7 6.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 16.5V22a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-5.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 23v-4h4v4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.5 9.5 24.5 8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        className="opacity-70"
      />
    </svg>
  );
}

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight text-slate-900">Moving Day</p>
        <p className="text-[11px] font-medium uppercase tracking-widest text-brand-600">
          Command Center
        </p>
      </div>
    </div>
  );
}
