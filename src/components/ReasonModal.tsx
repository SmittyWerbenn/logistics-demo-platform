import { AlertTriangle, Loader2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

type Tone = "danger" | "primary" | "warning" | "hold";

const TONE_BUTTON: Record<Tone, string> = {
  danger: "bg-rose-600 hover:bg-rose-700",
  warning: "bg-rose-700 hover:bg-rose-800",
  primary: "bg-emerald-600 hover:bg-emerald-700",
  hold: "bg-orange-600 hover:bg-orange-700",
};

interface Props {
  title: string;
  children: ReactNode;
  reasonLabel: string;
  placeholder?: string;
  confirmLabel: string;
  tone?: Tone;
  /** Runs the action; throw to show the message inline and keep the modal open. */
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

/** Confirmation dialog that insists on a written reason. The confirm button is
 * disabled while the request runs, so a double click can't fire it twice. */
export function ReasonModal({ title, children, reasonLabel, placeholder, confirmLabel, tone = "danger", onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Alasan wajib diisi.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="mt-3 text-sm text-slate-600">{children}</div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            {reasonLabel} <span className="text-rose-600">*</span>
          </span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-sm font-medium text-red-600">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            Batal
          </button>
          <button
            type="submit"
            disabled={pending}
            className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${TONE_BUTTON[tone]}`}
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
