import { actionClass } from "../../components/ActionButton";
import { Pagination } from "../../components/Pagination";
import { usePageSize } from "../../utils/usePagedList";
import { AlertTriangle, CheckCircle2, Eye, Loader2, RotateCcw, X, XCircle } from "lucide-react";
import { RefreshButton } from "../../components/RefreshButton";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { MasterDataHeader, MasterFilterSelect, MasterSearchInput, MasterTableCard, MasterTableMessage } from "../../components/master/MasterData";
import { StatusBadge } from "../../components/StatusBadge";
import type { ShipmentStatus } from "../../types";
import { ApiError, api } from "../../utils/apiClient";
import { formatTanggalJam, formatTanggalPendek, isoToWib } from "../../utils/format";
import { adminPath } from "../../utils/urls";

type ReqStatus = "PENDING" | "APPROVED" | "REJECTED";

interface RecoveryRequest {
  id: string;
  awb: string;
  customerId: string | null;
  clientNama: string | null;
  status: ReqStatus;
  reason: string | null;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  restoredStatus: string | null;
  orderStatus: ShipmentStatus | null;
  tanggalOrder: string | null;
  kotaAsal: string | null;
  kotaTujuan: string | null;
}

interface RecoveryDetail {
  request: RecoveryRequest;
  shipment: Record<string, string | number | null> | null;
  timeline: { seq: number; type: string; lokasi: string; tanggal: string; jam: string; keterangan: string; input_by_name: string | null }[];
}

interface ListResponse {
  items: RecoveryRequest[];
  meta: { page: number; limit: number; totalPages: number; total: number };
  pendingCount: number;
}

const STATUS_LABEL: Record<ReqStatus, string> = { PENDING: "Menunggu Konfirmasi", APPROVED: "Disetujui", REJECTED: "Ditolak" };
const STATUS_STYLE: Record<ReqStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

const EMPTY = { awb: "", client: "", requestedBy: "", status: "PENDING", from: "", to: "" };
const dateInputClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

function fmtIso(iso: string): string {
  const w = isoToWib(iso);
  return formatTanggalJam(w.tanggal, w.jam);
}

/** Admin GMS / Superadmin: review "Request Pemulihan Order" from Clients. The
 * decision (and every rule behind it) is enforced by the API; this page only
 * drives it. Waiting requests are listed first. */
export default function RecoveryRequests() {
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

  const [detail, setDetail] = useState<RecoveryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<RecoveryRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RecoveryRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      for (const [k, v] of Object.entries(applied)) if (v) q.set(k, v);
      setData(await api.get<ListResponse>(`/api/recovery-requests?${q.toString()}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat request pemulihan.");
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
  }
  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  }

  async function openDetail(r: RecoveryRequest) {
    setDetail(null);
    setActionError(null);
    setDetailLoading(true);
    try {
      setDetail(await api.get<RecoveryDetail>(`/api/recovery-requests/${r.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat detail request.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function run(fn: () => Promise<unknown>, done: () => void) {
    setActionPending(true);
    setActionError(null);
    try {
      await fn();
      done();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.");
      // The request may have been handled by someone else meanwhile: show the real state.
      load();
    } finally {
      setActionPending(false);
    }
  }

  const approve = () =>
    approveTarget &&
    run(
      () => api.post(`/api/recovery-requests/${approveTarget.id}/approve`),
      () => {
        setApproveTarget(null);
        setDetail(null);
        load();
      },
    );
  const reject = () =>
    rejectTarget &&
    run(
      () => api.post(`/api/recovery-requests/${rejectTarget.id}/reject`, { alasan: rejectReason.trim() }),
      () => {
        setRejectTarget(null);
        setDetail(null);
        load();
      },
    );

  const items = data?.items ?? [];
  const hasFilter = JSON.stringify(applied) !== JSON.stringify(EMPTY);
  const d = detail?.shipment;

  return (
    <AdminLayout>
      <MasterDataHeader
        title="Pemulihan Order"
        description={
          <>
            Request dari Client untuk memulihkan order yang Dibatalkan. Order baru dipulihkan setelah Anda menyetujui.
            {data && data.pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{data.pendingCount} menunggu</span>
            )}
          </>
        }
        actions={<RefreshButton onClick={() => void load()} refreshing={loading} />}
      />

      <form onSubmit={search} className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <MasterSearchInput value={draft.awb} onChange={(v) => patch({ awb: v })} placeholder="AWB" />
        <MasterSearchInput value={draft.client} onChange={(v) => patch({ client: v })} placeholder="Client" />
        <MasterSearchInput value={draft.requestedBy} onChange={(v) => patch({ requestedBy: v })} placeholder="Requested By" />
        <MasterFilterSelect value={draft.status} onChange={(v) => patch({ status: v })} label="Filter status request">
          <option value="">Semua Status</option>
          <option value="PENDING">Menunggu Konfirmasi</option>
          <option value="APPROVED">Disetujui</option>
          <option value="REJECTED">Ditolak</option>
        </MasterFilterSelect>
        <input type="date" aria-label="Dari tanggal request" value={draft.from} onChange={(e) => patch({ from: e.target.value })} className={dateInputClass} />
        <input type="date" aria-label="Sampai tanggal request" value={draft.to} onChange={(e) => patch({ to: e.target.value })} className={dateInputClass} />
        <button type="submit" className="h-10 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white hover:bg-blue-800">
          Cari
        </button>
        {(hasFilter || JSON.stringify(draft) !== JSON.stringify(EMPTY)) && (
          <button type="button" onClick={reset} className="h-10 rounded-lg px-3 text-sm font-medium text-slate-500 hover:text-slate-800">
            Reset
          </button>
        )}
      </form>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600">
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      <MasterTableCard minWidth={900}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">AWB</th>
            <th className="px-4 py-3 font-medium">Tanggal Order</th>
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">Status Order</th>
            <th className="px-4 py-3 font-medium">Requested By</th>
            <th className="px-4 py-3 font-medium">Tanggal Request</th>
            <th className="px-4 py-3 font-medium">Status Request</th>
            <th className="px-4 py-3 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(loading || items.length === 0) && (
            <MasterTableMessage
              colSpan={8}
              loading={loading}
              loadingText="Memuat..."
              icon={RotateCcw}
              title="Tidak ada request pemulihan"
              description={hasFilter ? "Tidak ada request yang cocok dengan filter." : "Belum ada Client yang mengajukan pemulihan order."}
            />
          )}
          {!loading &&
            items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-slate-800">{r.awb}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.tanggalOrder ? formatTanggalPendek(r.tanggalOrder) : "-"}</td>
                <td className="px-4 py-3 text-slate-700">{r.clientNama ?? r.customerId ?? "-"}</td>
                <td className="px-4 py-3">{r.orderStatus ? <StatusBadge status={r.orderStatus} size="sm" /> : "-"}</td>
                <td className="px-4 py-3 text-slate-700">{r.requestedBy}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtIso(r.requestedAt)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openDetail(r)}
                      className={actionClass("view", true)}
                    >
                      <Eye size={14} /> Lihat Detail
                    </button>
                    {r.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setApproveTarget(r);
                          }}
                          className={actionClass("success", true)}
                        >
                          <CheckCircle2 size={14} /> Konfirmasi
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setRejectReason("");
                            setRejectTarget(r);
                          }}
                          className={actionClass("danger", true)}
                        >
                          <XCircle size={14} /> Tolak
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </MasterTableCard>

      {data && (
        <Pagination meta={data.meta} page={page} pageSize={pageSize} loading={loading} onPage={setPage} onPageSize={setPageSize} unit="request" />
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Detail Request Pemulihan</h2>
              <button type="button" onClick={() => setDetail(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            {detailLoading || !detail ? (
              <div className="flex justify-center py-10">
                <Loader2 size={22} className="animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  {[
                    ["AWB", detail.request.awb],
                    ["Client", detail.request.clientNama ?? detail.request.customerId ?? "-"],
                    ["Origin", `${d?.kota_asal ?? "-"}`],
                    ["Destination", `${d?.kota_tujuan ?? "-"}`],
                    ["Tanggal Order", d?.tanggal_dibuat ? formatTanggalPendek(String(d.tanggal_dibuat)) : "-"],
                    ["Status Order Saat Ini", d?.status ?? "-"],
                    ["Pengirim", d?.pengirim_nama ?? "-"],
                    ["Penerima", d?.penerima_nama ?? "-"],
                    ["Barang", `${d?.deskripsi_barang || "-"} (${d?.berat_kg ?? "-"} kg, ${d?.jumlah_koli ?? "-"} koli)`],
                    ["Layanan", d?.layanan ?? "-"],
                    ["Requested By", detail.request.requestedBy],
                    ["Requested At", fmtIso(detail.request.requestedAt)],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <dt className="text-xs text-slate-400">{k}</dt>
                      <dd className="font-medium text-slate-800">{String(v)}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-400">Alasan Request</dt>
                    <dd className="font-medium text-slate-800">{detail.request.reason || "-"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-400">Status Request</dt>
                    <dd>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[detail.request.status]}`}>
                        {STATUS_LABEL[detail.request.status]}
                      </span>
                      {detail.request.reviewedBy && (
                        <span className="ml-2 text-xs text-slate-500">
                          oleh {detail.request.reviewedBy} · {detail.request.reviewedAt ? fmtIso(detail.request.reviewedAt) : ""}
                        </span>
                      )}
                      {detail.request.rejectionReason && <p className="mt-1 text-xs text-rose-600">Alasan penolakan: {detail.request.rejectionReason}</p>}
                    </dd>
                  </div>
                </dl>
                <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Riwayat Status</h3>
                <ol className="mt-2 space-y-2 border-l border-slate-200 pl-4 text-sm">
                  {detail.timeline.map((t) => (
                    <li key={t.seq}>
                      <p className="font-medium text-slate-800">
                        {t.type} <span className="font-normal text-slate-500">· {t.lokasi}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatTanggalJam(t.tanggal, t.jam)}
                        {t.keterangan ? ` — ${t.keterangan}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
                {actionError && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600">
                    <AlertTriangle size={14} /> {actionError}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                  <Link to={adminPath(`/resi/${detail.request.awb}`)} className="text-sm font-semibold text-blue-800 hover:underline">
                    Buka detail resi
                  </Link>
                  {detail.request.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectReason("");
                          setRejectTarget(detail.request);
                        }}
                        className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => setApproveTarget(detail.request)}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        Konfirmasi
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {approveTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Pulihkan Order?</h2>
            <p className="mt-3 text-sm text-slate-600">
              Anda akan memulihkan order AWB <span className="font-mono font-semibold">{approveTarget.awb}</span>. Setelah dikonfirmasi, order akan kembali
              ke status aktif sesuai workflow pengiriman.
            </p>
            {actionError && (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600">
                <AlertTriangle size={14} /> {actionError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setApproveTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button
                type="button"
                disabled={actionPending}
                onClick={approve}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {actionPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Pulihkan Order
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Tolak Request Pemulihan</h2>
            <p className="mt-2 text-sm text-slate-600">
              AWB <span className="font-mono font-semibold">{rejectTarget.awb}</span> tetap berstatus Dibatalkan.
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Alasan Penolakan</span>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
                placeholder="Contoh: Order sudah tidak dapat dipulihkan karena proses operasional telah ditutup."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            {actionError && (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600">
                <AlertTriangle size={14} /> {actionError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setRejectTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button
                type="button"
                disabled={actionPending || !rejectReason.trim()}
                onClick={reject}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {actionPending ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                Tolak Request
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
