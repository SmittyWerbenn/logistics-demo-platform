import { actionClass } from "./ActionButton";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../store/AuthContext";
import { moveToRecycleBin, forceDeleteRatePublish, type RecycleEntity } from "../utils/recycle";
import { ImpactList, useImpact } from "./ImpactList";
import { ReasonModal } from "./ReasonModal";
import { useToast } from "./Toast";

/** True only for Superadmin. The API re-checks; this just keeps the UI honest. */
export function useIsSuperadmin(): boolean {
  const { profile } = useAuth();
  return profile?.role === "Superadmin";
}

interface Props {
  entityType: RecycleEntity;
  id: string;
  /** Lines shown in the confirmation ("Nama: Budi", ...). */
  details: Array<[string, string]>;
  onDone: () => void | Promise<void>;
  /** "icon" for dense table rows, "full" for a labelled button. */
  variant?: "icon" | "full";
}

type Stage = null | "choose" | "confirm-soft" | "confirm-permanent";
type Choice = "soft" | "permanent";

/** "Hapus" action.
 *
 * - For most entity types: single step → ReasonModal → move to Recycle Bin (soft delete).
 * - For "tariff" (Rate Publish): multi-step → choose "Hapus (Recycle Bin)" vs "Hapus Permanen".
 *
 * Renders nothing for non-Superadmin. */
export function DeleteButton({ entityType, id, details, onDone }: Props) {
  const isSuperadmin = useIsSuperadmin();
  const toast = useToast();
  const isTariff = entityType === "tariff";

  const [stage, setStage] = useState<Stage>(null);
  const [choice, setChoice] = useState<Choice>("soft");

  // What still points at this row (with examples); loaded when the dialog opens. Nothing listed is deleted with it.
  const impact = useImpact(entityType, id, stage !== null && isSuperadmin);

  if (!isSuperadmin) return null;

  function goBack() {
    if (stage === "confirm-soft" || stage === "confirm-permanent") {
      setStage(isTariff ? "choose" : null);
    } else {
      setStage(null);
    }
  }

  async function runSoftDelete(reason: string) {
    await moveToRecycleBin(entityType, [id], reason);
    setStage(null);
    toast("Data berhasil dipindahkan ke Recycle Bin.");
    await onDone();
  }

  async function runPermanentDelete(reason: string) {
    await forceDeleteRatePublish(id, reason);
    setStage(null);
    toast("Data Rate Publish berhasil dihapus permanen.");
    await onDone();
  }

  return (
    <>
      <button
        type="button"
        title={isTariff ? "Hapus (pilih opsi)" : "Hapus (pindahkan ke Recycle Bin)"}
        aria-label="Hapus"
        onClick={() => setStage(isTariff ? "choose" : "confirm-soft")}
        className={actionClass("danger")}
      >
        <Trash2 size={16} />
      </button>

      {/* ===== MODAL PILIHAN: Hapus (Soft) vs Hapus Permanen ===== */}
      {/* Hanya muncul untuk entityType === "tariff" */}
      {stage === "choose" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Hapus Data Rate Publish?</h2>

            <p className="mt-3 text-sm text-slate-600">Pilih jenis penghapusan yang diinginkan:</p>

            <dl className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3">
              {details.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-20 shrink-0 text-xs text-slate-500">{k}</dt>
                  <dd className="break-words text-sm font-medium text-slate-800">{v || "-"}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="deleteChoice"
                  value="soft"
                  checked={choice === "soft"}
                  onChange={() => setChoice("soft")}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-200"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Hapus (ke Recycle Bin)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Data dipindahkan ke Recycle Bin dan masih bisa dipulihkan kapan saja.
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 hover:bg-rose-100">
                <input
                  type="radio"
                  name="deleteChoice"
                  value="permanent"
                  checked={choice === "permanent"}
                  onChange={() => setChoice("permanent")}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-200"
                />
                <div>
                  <div className="text-sm font-semibold text-rose-900">Hapus Permanen</div>
                  <div className="text-xs text-rose-700 mt-0.5">
                    ⚠️ Data dihapus SECARA PERMANEN dan TIDAK DAPAT DIPULIHKAN.
                  </div>
                </div>
              </label>
            </div>

            {impact === null && <p className="mt-3 text-xs text-slate-400">Memeriksa keterkaitan data...</p>}
            {impact && impact.length > 0 && (
              <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                <p className="font-semibold">⚠️ Peringatan: data ini masih terhubung dengan:</p>
                <ImpactList items={impact} className="mt-2" />
                <p className="mt-2 text-xs">Data terkait tidak akan ikut dihapus secara langsung.</p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStage(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setStage(choice === "soft" ? "confirm-soft" : "confirm-permanent")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== REASON MODAL: SOFT DELETE ===== */}
      {stage === "confirm-soft" && (
        <ReasonModal
          title="Hapus Data?"
          reasonLabel="Alasan Penghapusan"
          placeholder="Contoh: Data duplicate / input salah / data testing"
          confirmLabel={impact && impact.length > 0 ? "Lanjutkan Hapus" : "Pindahkan ke Recycle Bin"}
          onClose={goBack}
          onConfirm={async (reason) => {
            await runSoftDelete(reason);
          }}
        >
          <p>Anda akan memindahkan data berikut ke Recycle Bin:</p>
          <dl className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
            {details.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-20 shrink-0 text-xs text-slate-500">{k}</dt>
                <dd className="break-words text-sm font-medium text-slate-800">{v || "-"}</dd>
              </div>
            ))}
          </dl>
          {impact === null && <p className="mt-3 text-xs text-slate-400">Memeriksa keterkaitan data...</p>}
          {impact && impact.length > 0 && (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <p className="font-semibold">⚠️ Peringatan: data ini masih terhubung dengan:</p>
              <ImpactList items={impact} className="mt-2" />
              <p className="mt-2 text-xs">Data terkait tidak akan ikut dihapus secara langsung.</p>
            </div>
          )}
          <p className="mt-3">
            Data akan disimpan di Recycle Bin dan masih bisa dipulihkan. Penghapusan permanen otomatis sementara
            dinonaktifkan.
          </p>
        </ReasonModal>
      )}

      {/* ===== REASON MODAL: PERMANENT DELETE ===== */}
      {stage === "confirm-permanent" && (
        <ReasonModal
          title="Hapus Permanen Data?"
          reasonLabel="Alasan Penghapusan Permanen"
          placeholder="Contoh: Data duplicate / testing / tidak pernah digunakan"
          confirmLabel="Ya, Hapus Permanen"
          tone="warning"
          onClose={goBack}
          onConfirm={async (reason) => {
            await runPermanentDelete(reason);
          }}
        >
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <p className="font-semibold">
              <AlertTriangle size={14} className="inline mr-1.5 -mt-0.5" />
              PERINGATAN PENGHAPUSAN PERMANEN
            </p>
            <p className="mt-1.5">
              Data berikut akan dihapus <span className="font-semibold">SECARA PERMANEN</span> dan{" "}
              <span className="font-semibold">TIDAK DAPAT DIPULIHKAN</span>.
            </p>
          </div>

          <p className="mt-3 text-sm text-slate-600">Data yang akan dihapus:</p>
          <dl className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
            {details.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-20 shrink-0 text-xs text-slate-500">{k}</dt>
                <dd className="break-words text-sm font-medium text-slate-800">{v || "-"}</dd>
              </div>
            ))}
          </dl>

          {impact === null && <p className="mt-3 text-xs text-slate-400">Memeriksa keterkaitan data...</p>}
          {impact && impact.length > 0 && (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <p className="font-semibold">⚠️ Data ini masih terhubung dengan:</p>
              <ImpactList items={impact} className="mt-2" />
              <p className="mt-2 text-xs">
                Data terkait tidak akan ikut dihapus. Riwayat perubahan tarif (jika ada) akan tetap tersimpan sebagai
                audit trail.
              </p>
            </div>
          )}

          <p className="mt-3 text-sm text-slate-500">
            Setelah dihapus permanen, Rate Publish ini tidak akan muncul lagi di pencarian, list data, maupun Cek Ongkir.
            Riwayat transaksi yang sudah terjadi tidak terpengaruh.
          </p>
        </ReasonModal>
      )}
    </>
  );
}
