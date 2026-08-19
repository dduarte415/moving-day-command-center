import { useEffect, useRef, useState } from 'react';
import { DotsIcon } from './NavIcons';

// Tucks row-level actions (edit/delete) behind a "..." trigger instead of
// showing them inline on every row — per the polish brief, actions that
// aren't the primary interaction shouldn't compete for attention.
export default function RowMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Actions"
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <DotsIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 min-w-32 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                action.onClick();
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                action.danger ? 'text-red-600' : 'text-slate-700'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
