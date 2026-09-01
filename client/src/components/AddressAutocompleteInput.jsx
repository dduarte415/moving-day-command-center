import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/apiClient';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

// A plain, fully-functional text input first — suggestions are a pure
// convenience layered on top. If the lookup is slow, empty, or fails, the
// field never blocks typing or requires a selection; it just behaves like a
// normal input (see the fail-quiet contract in the backend's
// addressAutocomplete service).
export default function AddressAutocompleteInput({
  value,
  onChange,
  placeholder,
  required,
  className = '',
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const skipNextFetch = useRef(false);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get(`/api/address-autocomplete?q=${encodeURIComponent(value)}`);
        setSuggestions(data.suggestions ?? []);
        setOpen((data.suggestions ?? []).length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]); // Fail quiet — never surface an error for a convenience feature.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function select(suggestion) {
    skipNextFetch.current = true; // the value change below shouldn't re-trigger a search
    onChange(suggestion.label);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        required={required}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep focus so the click isn't lost to blur
                onClick={() => select(s)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === activeIndex ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
