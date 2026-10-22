import { actionClass } from "../../components/ActionButton";
import { Pagination } from "../../components/Pagination";
import { usePageSize } from "../../utils/usePagedList";
import { AlertTriangle, Eye, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { MasterDataHeader, MasterFilterSelect, MasterSearchInput, MasterTableCard, MasterTableMessage } from "../../components/master/MasterData";
import { ReasonModal } from "../../components/ReasonModal";
import { useToast } from "../../components/Toast";
import { ApiError, api } from "../../utils/apiClient";
import { formatTanggalJam, isoToWib } from "../../utils/format";
import { ImpactList, useImpact } from "../../components/ImpactList";
import { restoreFromBin, summaryMessage, type RecycleEntity, type RecycleSummary } from "../../utils/recycle";

type BinStatus = "IN_BIN" | "RESTORED" | "PURGED";

interface BinItem {
  id: string;
  entityType: string;
  entityTypeLabel: string;
  entityId: string;
  label: string;
  sublabel: string;
  status: BinStatus;
  deletedBy: string;
  deletedAt: string;
  deleteReason: string;
  expiresAt: string;
  daysLeft: number;
  purgeError: string | null;
  restoredBy: string | null;
  restoredAt: string | null;
  restoreReason: string | null;
  purgedBy: string | null;
  purgedAt: string | null;
  purgeReason: string | null;
}

interface ListResponse {
  items: BinItem[];
  meta: { page: number; limit: number; totalPages: number; total: number };
  retentionDays: number;
  types: { value: string; label: string }[];
  deleters: string[];
}

const STATUS_LABEL: Record<BinStatus, string> = { IN_BIN: "Di Recycle Bin", RESTORED: "Dipulihkan", PURGED: "Dihapus Permanen" };
const STATUS_STYLE: Record<BinStatus, string> = {
  IN_BIN: "bg-amber-100 text-amber-800",
  RESTORED: "bg-emerald-100 text-emerald-700",
  PURGED: "bg-slate-200 text-slate-600",
};

const EMPTY = { q: "", type: "", deletedBy: "", status: "IN_BIN", from: "", to: "" };
const dateInputClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

function fmtIso(iso: string): string {
  const w = isoToWib(iso);
  return formatTanggalJam(w.tanggal, w.jam);
}

const FIELD_LABEL: Record<string, string> = {
  awb: "AWB", status: "Status", customer_id: "Client ID", kota_asal: "Kota Asal", kota_tujuan: "Kota Tujuan", alamat_asal: "Alamat Asal",
  alamat_tujuan: "Alamat Tujuan", pengirim_nama: "Pengirim", penerima_nama: "Penerima", layanan: "Layanan", tanggal_dibuat: "Tanggal Dibuat",
  nama: "Nama", email: "Email", role: "Role", aktif: "Aktif", nomor_unit: "Nomor Unit", jenis: "Jenis", kapasitas: "Kapasitas",
  nama_kota: "Kota / Kabupaten", nama_area: "Nama Area", provinsi: "Provinsi", kode_kota: "Kode", kode_mitra: "Kode Mitra", deskripsi: "Deskripsi",
  mitra_id: "Mitra", id: "ID",
};

function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Action = { kind: "restore"; items: BinItem[] } | null;

/** Superadmin-only: everything moved to the bin, with restore. There is no manual permanent delete and the automatic purge is switched off, so nothing leaves the bin on its own. Authorization is enforced by the API. */
export default function RecycleBin() {
  const toast = useToast();
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = usePageSize();
  function setPageSize(n: number) {
    setPageSizeRaw(n);
    setPage(1);
  }
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<Action>(null);
  const [detail, setDetail] = useState<(BinItem & { snapshot: Record<string, unknown> | null }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // What still references the open record (examples included), so a "Tertahan" reason can be traced.
  const detailImpact = useImpact((detail?.entityType ?? "shipment") as RecycleEntity, detail?.entityId ?? null, !!detail && detail.status === "IN_BIN");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      for (const [k, v] of Object.entries(applied)) if (v) q.set(k, v);
      setData(await api.get<ListResponse>(`/api/recycle?${q.toString()}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat Recycle Bin.");
    } finally {
      setLoading(false);
    }
  }, [applied, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  // The page vanished (last row on it restored / deleted): fall back to the last valid page.
  useEffect(() => {
    if (data && data.meta.total > 0 && page > data.meta.totalPages) setPage(data.meta.totalPages);
  }, [data, page]);

  function patch(p: Partial<typeof EMPTY>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  function search(e?: FormEvent) {
    e?.preventDefault();
    setPage(1);
    setApplied(draft);
    setSelected(new Set());
  }
  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setPage(1);
    setSelected(new Set());
  }

  async function openDetail(item: BinItem) {
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await api.get(`/api/recycle/${item.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  const items = data?.items ?? [];
  const inBinItems = items.filter((i) => i.status === "IN_BIN");
  const selectedItems = inBinItems.filter((i) => selected.has(i.id));
  const hasFilter = JSON.stringify(applied) !== JSON.stringify(EMPTY);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function runAction(ids: string[], reason: string) {
    let summary: RecycleSummary;
    try {
      summary = await restoreFromBin(ids, reason);
    } catch (err) {
      // Someone else may have handled it meanwhile: show the real state, keep the dialog's message.
      load();
      throw err;
    }
    setSelected(new Set());
    setAction(null);
    setDetail(null);
    const okText = "Data berhasil dipulihkan.";
    if (summary.failed > 0) setNotice(summaryMessage(summary, okText) + (summary.results.filter((r) => !r.ok).length > 1 ? " (lihat Audit Log)" : ""));
    else {
      setNotice(null);
      toast(okText);
    }
    load();
  }

  const d = detail?.snapshot;

  return (
    <AdminLayout>
      <MasterDataHeader
        title="Recycle Bin"
        description=""
      />

      <form onSubmit={search} className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <MasterSearchInput value={draft.q} onChange={(v) => patch({ q: v })} placeholder="Cari ID / AWB / nama / alasan" />
        <MasterFilterSelect value={draft.type} onChange={(v) => patch({ type: v })} label="Filter jenis data">
          <option value="">Semua Jenis</option>
          {(data?.types ?? []).map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </MasterFilterSelect>
        <input type="date" aria-label="Dihapus dari tanggal" value={draft.from} onChange={(e) => patch({ from: e.target.value })} className={dateInputClass} />
        <input type="date" aria-label="Dihapus sampai tanggal" value={draft.to} onChange={(e) => patch({ to: e.target.value })} className={dateInputClass} />
        <button type="submit" className="h-10 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white hover:bg-blue-800">
          Cari
        </button>
        {(hasFilter || JSON.stringify(draft) !== JSON.stringify(EMPTY)) && (
          <button type="button" onClick={reset} className="h-10 rounded-lg px-3 text-sm font-medium text-slate-500 hover:text-slate-800">
            Reset
          </button>
        )}
      </form>

      {selectedItems.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm">
          <span className="font-medium text-blue-900">{selectedItems.length} data dipilih</span>
          <button type="button" onClick={() => setAction({ kind: "restore", items: selectedItems })} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
            <RotateCcw size={13} /> Restore Terpilih
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-medium text-slate-500 hover:text-slate-800">
            Batal pilih
          </button>
        </div>
      )}

      {(error || notice) && (
        <p className={`mt-3 flex items-start gap-1.5 text-sm font-medium ${error ? "text-red-600" : "text-amber-700"}`}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error ?? notice}
        </p>
      )}

      <MasterTableCard minWidth={1380}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                aria-label="Pilih semua"
                checked={inBinItems.length > 0 && selectedItems.length === inBinItems.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(inBinItems.map((i) => i.id)) : new Set())}
              />
            </th>
            <th className="px-4 py-3 font-medium">Data</th>
            <th className="px-4 py-3 font-medium">Jenis</th>
            <th className="px-4 py-3 font-medium">Dihapus Oleh</th>
            <th className="px-4 py-3 font-medium">Tanggal Hapus</th>
            <th className="px-4 py-3 font-medium">Alasan</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(loading || items.length === 0) && (
            <MasterTableMessage
              colSpan={9}
              loading={loading}
              loadingText="Memuat..."
              icon={Trash2}
              title="Recycle Bin kosong"
              description={hasFilter ? "Tidak ada data yang cocok dengan filter." : "Data yang dihapus akan muncul di sini dan dapat dipulihkan."}
            />
          )}
          {!loading &&
            items.map((i) => {
              const live = i.status === "IN_BIN";
              return (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {live && <input type="checkbox" aria-label={`Pilih ${i.label}`} checked={selected.has(i.id)} onChange={() => toggle(i.id)} />}
                  </td>
                  <td className="min-w-[10rem] px-4 py-3">
                    <p className="font-medium text-slate-800">{i.label}</p>
                    {i.sublabel && <p className="text-xs text-slate-500">{i.sublabel}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{i.entityTypeLabel}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{i.deletedBy}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtIso(i.deletedAt)}</td>
                  <td className="min-w-[12rem] max-w-[18rem] px-4 py-3 text-slate-600">{i.deleteReason}</td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[i.status]}`}>{STATUS_LABEL[i.status]}</span>
                    {live && i.purgeError && <p className="mt-1 max-w-[14rem] whitespace-normal text-[11px] text-rose-600">Catatan: {i.purgeError} <span className="font-semibold">(lihat Detail untuk data terkait)</span></p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => openDetail(i)} className={actionClass("view", true)}>
                        <Eye size={14} /> Detail
                      </button>
                      {live && (
                        <>
                          <button type="button" onClick={() => setAction({ kind: "restore", items: [i] })} className={actionClass("success", true)}>
                            <RotateCcw size={14} /> Restore
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </MasterTableCard>

      {data && (
        <Pagination meta={data.meta} page={page} pageSize={pageSize} loading={loading} onPage={setPage} onPageSize={setPageSize} unit="data" />
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Detail Data Terhapus</h2>
              <button type="button" aria-label="Tutup" onClick={() => setDetail(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            {detailLoading || !detail ? (
              <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Memuat...
              </p>
            ) : (
              <>
                <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {(
                    [
                      ["Jenis Data", detail.entityTypeLabel],
                      ["Entity ID", detail.entityId],
                      ["Dihapus Oleh", detail.deletedBy],
                      ["Tanggal Hapus", fmtIso(detail.deletedAt)],
                      ["Alasan Hapus", detail.deleteReason],
                      ...(detail.restoredAt ? [["Dipulihkan", `${detail.restoredBy} · ${fmtIso(detail.restoredAt)} · ${detail.restoreReason}`]] : []),
                      ...(detail.purgedAt ? [["Dihapus Permanen", `${detail.purgedBy} · ${fmtIso(detail.purgedAt)} · ${detail.purgeReason}`]] : []),
                    ] as Array<[string, string]>
                  ).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-slate-500">{k}</dt>
                      <dd className="break-words font-medium text-slate-800">{v}</dd>
                    </div>
                  ))}
                </dl>
                {d && (
                  <>
                    <h3 className="mt-5 text-sm font-semibold text-slate-700">Data Asli</h3>
                    <dl className="mt-2 grid gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
                      {Object.entries(d)
                        .filter(([k, v]) => v !== null && v !== "" && typeof v !== "object" && k !== "created_by" && k !== "updated_by")
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-xs text-slate-500">{fieldLabel(k)}</dt>
                            <dd className="break-words text-slate-800">{String(v)}</dd>
                          </div>
                        ))}
                    </dl>
                  </>
                )}
                {detail.purgeError && (
                  <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Catatan: {detail.purgeError}</p>
                )}
                {detail.status === "IN_BIN" && detailImpact && detailImpact.length > 0 && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                    <p className="font-semibold">Data terkait (penelusuran)</p>
                    <ImpactList items={detailImpact} className="mt-2" />
                  </div>
                )}
                {detail.status === "IN_BIN" && (
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setAction({ kind: "restore", items: [detail] })} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                      <RotateCcw size={15} /> Restore
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {action?.kind === "restore" && (
        <ReasonModal
          title="Pulihkan Data?"
          reasonLabel="Alasan Pemulihan"
          placeholder="Contoh: Data terhapus karena kesalahan / masih diperlukan"
          confirmLabel="Pulihkan Data"
          tone="primary"
          onClose={() => setAction(null)}
          onConfirm={(reason) => runAction(action.items.map((i) => i.id), reason)}
        >
          <p>{action.items.length === 1 ? "Data berikut akan dikembalikan ke sistem aktif:" : `${action.items.length} data akan dikembalikan ke sistem aktif:`}</p>
          <ItemList items={action.items} />
        </ReasonModal>
      )}
    </AdminLayout>
  );
}

function ItemList({ items }: { items: Array<{ label: string; entityTypeLabel: string; sublabel: string }> }) {
  return (
    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-3">
      {items.map((i, n) => (
        <li key={n} className="text-sm">
          <span className="font-medium text-slate-800">{i.label}</span>
          <span className="text-slate-500"> · {i.entityTypeLabel}</span>
          {i.sublabel && <span className="block text-xs text-slate-500">{i.sublabel}</span>}
        </li>
      ))}
    </ul>
  );
}
