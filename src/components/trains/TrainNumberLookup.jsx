import { useState, useEffect, useRef, useId } from 'react';
import { TrainFront, AlertCircle } from 'lucide-react';
import { baseUrl } from '../../apiBase';
import { useDebounced } from '../../hooks/useDebounced';
import { formatTrain } from '../../utils/format';

// Train number input that looks trains up as you type: a dropdown of
// matching numbers with their route, and the full details line for an
// exact match shown underneath.
export function TrainNumberLookup({ value, onChange, inputClassName }) {
  const debounced = useDebounced(value.trim(), 200);
  const [suggestions, setSuggestions] = useState([]);
  const [loadedFor, setLoadedFor] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const requestId = useRef(0);
  const listId = useId();

  useEffect(() => {
    if (!debounced) { setSuggestions([]); setLoadedFor(''); return; }
    const id = ++requestId.current;
    fetch(`${baseUrl}/api/trains/suggest?prefix=${encodeURIComponent(debounced)}`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((items) => {
        if (id !== requestId.current) return; // a newer keystroke already won
        setSuggestions(items);
        setLoadedFor(debounced);
        setActive(-1);
      });
  }, [debounced]);

  const exact = suggestions.find((t) => String(t['Train No']) === value.trim());
  const settled = loadedFor === value.trim();
  const notFound = settled && value.trim().length >= 3 && !exact;
  const showList = open && value.trim() !== '' && suggestions.length > 0 && !(exact && suggestions.length === 1);

  const pick = (t) => {
    onChange(String(t['Train No']));
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (!showList) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(suggestions.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(suggestions[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        id="trainNumber"
        value={value}
        onChange={(e) => { onChange(e.target.value.replace(/\D/g, '')); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        required
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className={inputClassName}
        placeholder="e.g., 12711"
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-left"
        >
          {suggestions.map((t, i) => (
            <li
              key={t._id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(t); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${i === active ? 'bg-blue-50 text-blue-800' : 'text-gray-700'}`}
            >
              {formatTrain(t)}
            </li>
          ))}
        </ul>
      )}

      {exact && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-left">
          <TrainFront size={16} className="shrink-0 mt-0.5 text-blue-600" />
          <span>{formatTrain(exact)}</span>
        </p>
      )}
      {notFound && !showList && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700">
          <AlertCircle size={14} /> No train with number {value.trim()}
        </p>
      )}
    </div>
  );
}
