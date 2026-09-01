// Small stroke-style icons for the sidebar nav — hand-drawn to match the
// logo mark rather than pulling in an icon library for four glyphs.
const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function ChecklistIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

export function BudgetIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v9M14.5 9.75c0-1-.9-1.75-2.5-1.75s-2.5.75-2.5 1.75.9 1.5 2.5 1.75 2.5.75 2.5 1.75-.9 1.75-2.5 1.75-2.5-.75-2.5-1.75" />
    </svg>
  );
}

export function WifiIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} {...props}>
      <path d="M4.5 9.5a11 11 0 0 1 15 0" />
      <path d="M7.5 12.8a7 7 0 0 1 9 0" />
      <path d="M10.5 16a3 3 0 0 1 3 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MovesIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} {...props}>
      <path d="M4 20V10.5L12 4l8 6.5V20" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

export function MapPinIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function ChevronIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} {...props}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function DotsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

export function BulbIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.44 1 1.15 1 1.93V16h5v-.17c0-.78.4-1.49 1-1.93A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
