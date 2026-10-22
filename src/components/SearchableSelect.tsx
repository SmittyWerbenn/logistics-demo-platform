import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  /** Extra classes merged onto the trigger button, for pages that need a
   * different visual theme (e.g. gold focus ring) without affecting every
   * other caller's default look. */
  className?: string;
  /** Server-side search: when set, options are NOT filtered locally; the parent reloads them for each (debounced) query. */
  onSearch?: (query: string) => void;
  /** Larger text (public pages); admin callers keep the compact default. */
  large?: boolean;
}

/** A dropdown with a built-in search box, used for pickers backed by master
 * data (truck units, cities/transit points) where a plain <select> would be
 * too long to scan by eye. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  emptyLabel = "Tidak ada hasil.",
  disabled,
  className = "",
  onSearch,
  large,
}: SearchableSelectProps) {
  const txt = large ? "text-lg" : "text-sm";
  const txtSm = large ? "text-base" : "text-xs";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? (value ? { value, label: value } : undefined);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || onSearch) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
    );
  }, [options, query, onSearch]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left ${txt} text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              placeholder="Cari..."
              className={`w-full ${txt} text-slate-900 placeholder:text-slate-400 focus:outline-none`}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className={`px-3 py-3 text-center ${txtSm} text-slate-400`}>{emptyLabel}</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${txt} hover:bg-slate-50`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{o.label}</span>
                    {o.description && (
                      <span className={`block truncate ${txtSm} text-slate-500`}>{o.description}</span>
                    )}
                  </span>
                  {o.value === value && <Check size={15} className="shrink-0 text-blue-700" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
