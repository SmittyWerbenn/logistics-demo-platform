import { ACTION_ROW, actionClass } from "../../components/ActionButton";
import { adminPath } from "../../utils/urls";
import { AlertTriangle, CheckCircle2, Download, Eye, FileEdit, LayoutList, ListTree, Loader2, MapPin, PackageSearch, Pencil, Printer, RefreshCw, RotateCcw, Search, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { ClaimDecisionModal } from "../../components/ClaimDecisionModal";
import { EditShipmentModal } from "../../components/EditShipmentModal";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../store/AuthContext";
import { useSettings } from "../../store/SettingsContext";
import { fetchAllShipments, useShipments, type PendingClaim } from "../../store/ShipmentContext";
import { Pagination } from "../../components/Pagination";
import { usePageSize } from "../../utils/usePagedList";
import { api } from "../../utils/apiClient";
import type { ShipmentStatus } from "../../types";
import { exportShipmentsCsv } from "../../utils/exportCsv";
import { formatTanggalJam, formatTanggalPendek, stripKeteranganMeta, todayISO, isoToWib } from "../../utils/format";
import { SHIPMENT_STATUS_OPTIONS } from "../../utils/status";
import { CancelOrderActions } from "../../components/CancelOrderActions";
import { HoldOrderActions } from "../../components/HoldOrderActions";

const NO_CLIENT = "__none__";

function isShipmentStatus(value: string): value is ShipmentStatus {
  return (SHIPMENT_STATUS_OPTIONS as string[]).includes(value);
}

/** Fully server-side list: search (debounced), status, Client ID, date range
 * and "macet" are all sent to the API, which filters -> sorts -> LIMIT/OFFSETs
 * so only the visible page is ever loaded. */
export default function ShipmentList() {
  const { shipments, isLoading, listMeta, refresh, fetchPendingClaims, confirmClaim, rejectClaim, requestRecovery } =
    useShipments();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const canCreateShipment =
    profile?.role === "Superadmin" || profile?.role === "Admin" || profile?.role === "Client";
  const canManageClaims = profile?.role === "Superadmin" || profile?.role === "Admin";
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [viewMode, setViewMode] = useState<"ringkas" | "detail">("ringkas");
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [claimActionAwb, setClaimActionAwb] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // "Ajukan Pemulihan": Client only, cancelled orders without an active request.
  // The order itself is not touched - GMS Admin / Superadmin decide.
  const [recoveryTargetAwb, setRecoveryTargetAwb] = useState<string | null>(null);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  function canRequestRecovery(s: { status: ShipmentStatus; recovery?: { status: string } }): boolean {
    return profile?.role === "Client" && s.status === "Dibatalkan" && s.recovery?.status !== "PENDING";
  }

  async function handleRequestRecovery() {
    if (!recoveryTargetAwb) return;
    setRecoveryPending(true);
    setRecoveryError(null);
    const result = await requestRecovery(recoveryTargetAwb);
    setRecoveryPending(false);
    if (result.ok) setRecoveryTargetAwb(null);
    else setRecoveryError(result.error);
  }

  // Client: edit all data of an order that is still "Dalam Persiapan".
  const [editTargetAwb, setEditTargetAwb] = useState<string | null>(null);

  function canEditAlamatRow(s: { status: ShipmentStatus }): boolean {
    return profile?.role === "Client" && s.status === "Dalam Persiapan";
  }

  function loadPendingClaims() {
    if (!canManageClaims) return;
    fetchPendingClaims()
      .then(setPendingClaims)
      .catch(() => {});
  }

  useEffect(() => {
    loadPendingClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confirm / Tolak first open a second-confirmation dialog (AWB, driver, unit);
  // nothing is sent until the admin presses the explicit button inside it.
  const [claimDialog, setClaimDialog] = useState<{ mode: "confirm" | "reject"; claim: PendingClaim } | null>(null);

  async function submitClaimDialog() {
    if (!claimDialog) return;
    const { mode, claim } = claimDialog;
    setClaimActionAwb(claim.awb);
    setClaimError(null);
    const seen = { driverId: claim.driver.id, truckId: claim.truck?.id ?? null };
    const result = mode === "confirm" ? await confirmClaim(claim.awb, seen) : await rejectClaim(claim.awb, seen);
    setClaimActionAwb(null);
    if (result.ok) {
      setClaimDialog(null);
      loadPendingClaims();
    } else {
      setClaimError(result.error);
      loadPendingClaims(); // show the real, current state behind the dialog
    }
  }

  const statusParam = searchParams.get("status") ?? "";
  const statusFilter: ShipmentStatus | "Semua" = isShipmentStatus(statusParam) ? statusParam : "Semua";
  const macetOnly = searchParams.get("macet") === "1";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const [pageSize, setPageSize] = usePageSize();
  const macetDays = macetOnly ? settings.stagnantThresholdDays : undefined;
  const filterParams = {
    status: statusFilter === "Semua" ? undefined : statusFilter,
    q: debouncedQuery || undefined,
    customer: clientFilter || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    macet: macetDays,
  };
  // Page resets to 1 whenever a filter / search / page size changes.
  const filterSig = JSON.stringify([filterParams, pageSize]);
  const [pageState, setPageState] = useState({ sig: filterSig, page: 1 });
  const page = pageState.sig === filterSig ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ sig: filterSig, page: Math.max(1, p) });

  const reloadList = () => refresh({ ...filterParams, page, limit: pageSize });

  useEffect(() => {
    reloadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig, page]);

  // Page fell off the end (e.g. the last row on it was just cancelled/deleted): go back to the last valid one.
  useEffect(() => {
    if (!isLoading && listMeta.total > 0 && page > listMeta.totalPages) setPage(listMeta.totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, listMeta.total, listMeta.totalPages, page]);

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        reloadList(),
        canManageClaims ? fetchPendingClaims().then(setPendingClaims).catch(() => {}) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleStatusFilterChange(value: ShipmentStatus | "Semua") {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "Semua") {
        next.delete("status");
      } else {
        next.set("status", value);
      }
      return next;
    });
  }

  function clearMacetFilter() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("macet");
      return next;
    });
  }

  // Client ID options for the filter come from the API (distinct Client IDs the
  // user may see), not from whatever rows happen to be on screen.
  const showClientPicker = profile?.role !== "Client";
  const [clientOptions, setClientOptions] = useState<{ value: string; count: number; label: string }[]>([]);
  useEffect(() => {
    if (!showClientPicker) return;
    api
      .get<{ items: { customerId: string | null; count: number }[] }>("/api/shipments/clients")
      .then((res) =>
        setClientOptions(
          res.items.map((r) => ({
            value: r.customerId ?? NO_CLIENT,
            count: r.count,
            label: r.customerId ?? "Tanpa Client ID",
          })),
        ),
      )
      .catch(() => {});
  }, [showClientPicker]);

  const filtered = shipments;

  // Exports every order matching the active filters (all pages), not just the
  // 20 on screen.
  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    if (listMeta.total === 0) return;
    const slug = clientFilter
      ? `-${clientFilter === NO_CLIENT ? "tanpa-client" : clientFilter.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      : "";
    setExporting(true);
    try {
      exportShipmentsCsv(await fetchAllShipments(filterParams), `data-pengiriman${slug}-${todayISO()}.csv`);
    } finally {
      setExporting(false);
    }
  }

  function lastUpdate(awb: string) {
    const s = shipments.find((x) => x.awb === awb);
    const last = s?.timeline[s.timeline.length - 1];
    if (!last) return "-";
    return `${formatTanggalPendek(last.tanggal)}, ${last.jam}`;
  }

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Data Pengiriman</h1>
          <p className="mt-1 text-sm text-slate-500">
            Daftar seluruh resi (AWB) yang tercatat dalam sistem.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Muat ulang data"
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-blue-900 bg-white px-3.5 py-2 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-50 disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          {canCreateShipment && (
            <Link
              to={adminPath("/pengiriman/baru")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              Buat Pengiriman
            </Link>
          )}
        </div>
      </div>

      {profile?.role === "Client" && shipments.some((x) => x.cancel?.canDecide && x.cancellation?.status === "PENDING") && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            {shipments.filter((x) => x.cancel?.canDecide && x.cancellation?.status === "PENDING").length} request pembatalan menunggu keputusan Anda
          </p>
          <p className="mt-0.5 text-xs">
            GMS mengajukan pembatalan untuk order berikut. Buka aksi “Keputusan Pembatalan” pada baris order untuk menerima atau menolak (keterangan wajib).
          </p>
        </div>
      )}

      {canManageClaims && pendingClaims.length > 0 && (
        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-violet-800">
            <PackageSearch size={15} /> Klaim Pengiriman Menunggu Konfirmasi ({pendingClaims.length})
          </p>
          {claimError && <p className="mb-3 text-xs font-medium text-red-600">{claimError}</p>}
          <div className="flex flex-col gap-2">
            {pendingClaims.map((c) => (
              <div
                key={c.awb}
                className="flex flex-col gap-2 rounded-lg border border-violet-100 bg-white px-3.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {c.awb}{" "}
                    <span className="font-sans text-xs font-normal text-slate-500">
                      {c.kotaAsal} → {c.kotaTujuan}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Diajukan oleh <span className="font-medium text-slate-700">{c.driver.nama}</span> (
                    {c.driver.telepon}) ·{" "}
                    {formatTanggalJam(isoToWib(c.claimRequestedAt).tanggal, isoToWib(c.claimRequestedAt).jam)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Unit: <span className="font-semibold text-slate-700">{c.truck?.nomorUnit ?? "-"}</span> · Jenis:{" "}
                    <span className="font-semibold text-slate-700">{c.truck?.jenis ?? "-"}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={claimActionAwb === c.awb}
                    onClick={() => {
                      setClaimError(null);
                      setClaimDialog({ mode: "reject", claim: c });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <XCircle size={13} /> Tolak
                  </button>
                  <button
                    type="button"
                    disabled={claimActionAwb === c.awb}
                    onClick={() => {
                      setClaimError(null);
                      setClaimDialog({ mode: "confirm", claim: c });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {claimActionAwb === c.awb ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Konfirmasi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {macetOnly && (
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800">
          Menampilkan hanya AWB macet (tidak ada update terbaru)
          <button
            onClick={clearMacetFilter}
            className="ml-auto inline-flex items-center gap-1 rounded-md p-1 text-amber-700 hover:bg-amber-100"
            title="Hapus filter"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className={`${macetOnly ? "mt-3" : "mt-5"} flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center`}>
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari AWB, nama, kota, nomor truck..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value as ShipmentStatus | "Semua")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="Semua">Semua Status</option>
          {SHIPMENT_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {showClientPicker && (
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            aria-label="Filter Client ID"
            className="max-w-[14rem] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Semua Client ID</option>
            {clientOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.count})
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {(query || statusFilter !== "Semua" || dateFrom || dateTo || macetOnly || clientFilter) && (
          <button
            onClick={() => {
              setQuery("");
              setDateFrom("");
              setDateTo("");
              setClientFilter("");
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("status");
                next.delete("macet");
                return next;
              });
            }}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={handleExport}
          disabled={listMeta.total === 0 || exporting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export CSV
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-400 sm:inline">{listMeta.total.toLocaleString("id-ID")} pengiriman</span>
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("ringkas")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                viewMode === "ringkas" ? "bg-blue-900 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutList size={13} /> Ringkas
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detail")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                viewMode === "detail" ? "bg-blue-900 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ListTree size={13} /> Detail
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Bounded height (not just overflow-x-auto) so the horizontal
            scrollbar sits right under the visible rows instead of at the
            very bottom of a wide table the user would have to scroll the
            whole page down to reach. */}
        <div className="max-h-[65vh] overflow-auto">
          <table className={`w-full text-left text-sm ${viewMode === "detail" ? "min-w-[2220px]" : "min-w-[920px]"}`}>
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">AWB</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                {viewMode === "detail" && (
                  <>
                    <th className="px-4 py-3 font-medium">Pengirim</th>
                    <th className="px-4 py-3 font-medium">Penerima</th>
                  </>
                )}
                <th className="px-4 py-3 font-medium">Rute</th>
                {viewMode === "detail" && (
                  <>
                    <th className="px-4 py-3 font-medium">Client ID</th>
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Berat Final (Kg)</th>
                    <th className="px-4 py-3 font-medium">Koli</th>
                    <th className="px-4 py-3 font-medium">Estimasi Tiba</th>
                    <th className="px-4 py-3 font-medium">Diterima Oleh</th>
                    <th className="px-4 py-3 font-medium">Diterima</th>
                    <th className="px-4 py-3 font-medium">Keterangan</th>
                  </>
                )}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Truck</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Last Update</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.awb} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-slate-900">
                    {s.awb}
                    {s.reference && <span className="block font-sans text-[11px] font-normal text-slate-400" title="Referensi">Ref: {s.reference}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatTanggalPendek(s.tanggalDibuat)}
                  </td>
                  {viewMode === "detail" && (
                    <>
                      <td className="px-4 py-3 text-slate-600">{s.pengirim.nama}</td>
                      <td className="px-4 py-3 text-slate-600">{s.penerima.nama}</td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {s.kotaAsal} → {s.kotaTujuan}
                  </td>
                  {viewMode === "detail" && (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{s.customerId ?? "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{s.layanan}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{s.beratKg}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{s.jumlahKoli}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {s.estimasiTiba ? formatTanggalPendek(s.estimasiTiba) : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.pod?.namaPenerima ?? "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {s.pod ? `${formatTanggalPendek(s.pod.tanggal)}, ${s.pod.jam}` : "-"}
                      </td>
                      <td className="max-w-[260px] whitespace-normal break-words px-4 py-3 text-slate-600">
                        {stripKeteranganMeta(s.deskripsiBarang)}
                      </td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={s.status} size="sm" />
                    {s.cancellation && s.status !== "Dibatalkan" && (s.cancellation.status === "PENDING" || s.cancellation.status === "REJECTED") && (
                      <p className={`mt-1 text-[11px] font-medium ${s.cancellation.status === "PENDING" ? "text-amber-700" : "text-rose-600"}`}>
                        Pembatalan: {s.cancellation.status === "PENDING" ? "Menunggu Konfirmasi Client" : "Ditolak Client"}
                      </p>
                    )}
                    {s.status === "Dibatalkan" && s.recovery && (profile?.role === "Client" || profile?.role === "Superadmin" || profile?.role === "Admin") && (
                      <p
                        className={`mt-1 text-[11px] font-medium ${
                          s.recovery.status === "PENDING" ? "text-amber-700" : s.recovery.status === "REJECTED" ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        Request Pemulihan:{" "}
                        {s.recovery.status === "PENDING" ? "Menunggu Konfirmasi" : s.recovery.status === "REJECTED" ? "Ditolak" : "Disetujui"}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {s.claimStatus === "pending" ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        Diklaim: {s.claimDriverNama}
                      </span>
                    ) : (
                      s.truck.nomorUnit
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{s.truck.driver ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {lastUpdate(s.awb)}
                  </td>
                  <td className="px-4 py-3">
                    <div className={ACTION_ROW}>
                      <Link
                        to={adminPath(`/resi/${s.awb}`)}
                        title="Detail"
                        className={actionClass("view")}
                      >
                        <Eye size={16} />
                      </Link>
                      <Link
                        to={adminPath(`/tracking/${s.awb}`)}
                        title="Tracking"
                        className={actionClass("track")}
                      >
                        <MapPin size={16} />
                      </Link>
                      {profile?.role !== "Viewer" && profile?.role !== "Client" && (
                        <Link
                          to={adminPath(`/update-tracking/${s.awb}`)}
                          title="Update"
                          className={actionClass("update")}
                        >
                          <FileEdit size={16} />
                        </Link>
                      )}
                      <Link
                        to={adminPath(`/resi/${s.awb}`)}
                        title="Cetak Resi"
                        className={actionClass("print")}
                      >
                        <Printer size={16} />
                      </Link>
                      {canEditAlamatRow(s) && (
                        <button
                          type="button"
                          onClick={() => setEditTargetAwb(s.awb)}
                          title="Edit Data Pengiriman"
                          className={actionClass("edit")}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canRequestRecovery(s) && (
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryError(null);
                            setRecoveryTargetAwb(s.awb);
                          }}
                          title="Ajukan Pemulihan"
                          className={actionClass("view", true)}
                        >
                          <RotateCcw size={14} /> Ajukan Pemulihan
                        </button>
                      )}
                      <HoldOrderActions shipment={s} onDone={reloadList} />
                      <CancelOrderActions shipment={s} onDone={reloadList} />
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td colSpan={viewMode === "detail" ? 18 : 8} className="px-4 py-10 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={viewMode === "detail" ? 18 : 8} className="px-4 py-10 text-center text-sm text-slate-400">
                    Tidak ada data pengiriman yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination meta={listMeta} page={page} pageSize={pageSize} loading={isLoading} onPage={setPage} onPageSize={setPageSize} unit="pengiriman" />

      {claimDialog && (
        <ClaimDecisionModal
          mode={claimDialog.mode}
          claim={{ awb: claimDialog.claim.awb, driverNama: claimDialog.claim.driver.nama, nomorUnit: claimDialog.claim.truck?.nomorUnit ?? null, jenisUnit: claimDialog.claim.truck?.jenis ?? null }}
          pending={claimActionAwb === claimDialog.claim.awb}
          error={claimError}
          onCancel={() => {
            setClaimDialog(null);
            setClaimError(null);
          }}
          onSubmit={submitClaimDialog}
        />
      )}

      {recoveryTargetAwb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <RotateCcw size={18} className="text-blue-800" /> Ajukan Pemulihan Order?
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Order AWB <span className="font-mono font-semibold">{recoveryTargetAwb}</span> saat ini berstatus Dibatalkan. Apakah Anda
              yakin ingin mengajukan request untuk memulihkan order ini? Order baru dipulihkan setelah disetujui oleh GMS.
            </p>
            {recoveryError && (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600">
                <AlertTriangle size={14} /> {recoveryError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRecoveryTargetAwb(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={recoveryPending}
                onClick={handleRequestRecovery}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {recoveryPending ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                Ajukan Request
              </button>
            </div>
          </div>
        </div>
      )}

      {editTargetAwb && shipments.find((x) => x.awb === editTargetAwb) && (
        <EditShipmentModal shipment={shipments.find((x) => x.awb === editTargetAwb)!} onClose={() => setEditTargetAwb(null)} />
      )}
    </AdminLayout>
  );
}
