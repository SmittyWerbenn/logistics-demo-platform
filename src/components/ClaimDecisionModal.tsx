import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

export interface ClaimSummary {
  awb: string;
  driverNama: string;
  nomorUnit: string | null;
  jenisUnit: string | null;
}

/** Second confirmation before an admin confirms or rejects a driver's pickup
 * request. It repeats AWB, driver and unit so a wrong click is caught; the API
 * re-validates everything again when the button is pressed. */
export function ClaimDecisionModal({
  mode,
  claim,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  mode: "confirm" | "reject";
  claim: ClaimSummary;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const confirm = mode === "confirm";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">{confirm ? "Konfirmasi Request Driver" : "Tolak Request Driver"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {confirm ? "Apakah Anda yakin ingin mengonfirmasi request pickup ini?" : "Apakah Anda yakin ingin menolak request pickup ini?"}
        </p>

        <dl className="mt-4 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <dt className="text-slate-500">AWB</dt>
          <dd className="font-mono font-semibold text-slate-900">{claim.awb}</dd>
          <dt className="text-slate-500">Driver</dt>
          <dd className="font-semibold text-slate-900">{claim.driverNama}</dd>
          <dt className="text-slate-500">Nomor Unit</dt>
          <dd className="font-semibold text-slate-900">{claim.nomorUnit ?? "-"}</dd>
          <dt className="text-slate-500">Jenis Unit</dt>
          <dd className="font-semibold text-slate-900">{claim.jenisUnit ?? "-"}</dd>
        </dl>

        <p className="mt-3 text-xs font-medium text-slate-500">
          {confirm ? "Pastikan driver dan unit yang dipilih sudah benar." : "Pastikan request driver yang akan ditolak sudah benar."}
        </p>

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm font-medium text-red-600">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onSubmit}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
              confirm ? "bg-blue-900 hover:bg-blue-800" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : confirm ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {pending ? "Memproses..." : confirm ? "Ya, Confirm" : "Ya, Tolak Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
