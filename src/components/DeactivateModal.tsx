import { AlertTriangle, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "./Toast";

interface Props {
  /** What is being deactivated, e.g. "layanan", "driver" - used in the wording. */
  entityLabel: string;
  /** Identity lines shown so the right record is chosen ("Nama: ...", "Nopol: ..."). */
  details: Array<[string, string]>;
  /** Extra consequence line (e.g. "Akun user akan dibekukan."). */
  note?: string;
  /** Runs the real change. Throw to show the message inline and keep the modal open. Only ever called after "Ya, Nonaktifkan". */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** One shared confirmation for every "Nonaktifkan" action in the admin portal: the first click only opens this,
 * the API is called only from the confirm button, which is locked while the request runs (no double submit). */
export function DeactivateModal({ entityLabel, details, note, onConfirm, onClose }: Props) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      toast("Data berhasil dinonaktifkan.");
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Gagal menonaktifkan data. Silakan coba lagi.");
      setPending(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Konfirmasi Nonaktifkan</h2>
            <p className="mt-1 text-sm text-slate-600">
              Apakah Anda yakin ingin menonaktifkan {entityLabel} ini? Data yang dinonaktifkan tidak dapat digunakan sampai diaktifkan kembali.
            </p>
          </div>
        </div>
        <dl className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          {details.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-24 shrink-0 text-xs text-slate-500">{k}</dt>
              <dd className="min-w-0 break-words font-medium text-slate-800">{v || "-"}</dd>
            </div>
          ))}
        </dl>
        {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-sm font-medium text-red-600">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            Batal
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            {pending ? "Menonaktifkan..." : "Ya, Nonaktifkan"}
          </button>
        </div>
      </div>
    </div>
  );
}
