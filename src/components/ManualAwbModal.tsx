import { Keyboard, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { extractAwb } from "../utils/extractAwb";

/** Manual alternative to the camera scanner: the driver types (or pastes) an
 * AWB - a bare code or a tracking link - and gets the same result flow as a
 * scan. */
export function ManualAwbModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (awb: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const awb = extractAwb(value);
    if (awb) onSubmit(awb);
  }

  const empty = extractAwb(value) === "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Keyboard size={17} className="text-blue-900" /> Isi AWB Manual
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Nomor AWB</span>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ketik atau tempel nomor AWB"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-3 font-mono text-base uppercase text-slate-900 placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <span className="mt-1.5 block text-[11px] text-slate-400">
              Boleh juga menempel link tracking dari resi.
            </span>
          </label>
          <button
            type="submit"
            disabled={empty}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={16} /> Cari AWB
          </button>
        </form>
      </div>
    </div>
  );
}
