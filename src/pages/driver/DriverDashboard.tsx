import { driverPath } from "../../utils/urls";
import { AlertTriangle, ArrowRight, Building2, CalendarClock, FileSpreadsheet, Keyboard, Loader2, MessageCircle, Package, PackageSearch, RefreshCw, ScanLine, Truck, Weight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BarcodeScannerModal } from "../../components/BarcodeScannerModal";
import { DriverHelpLink } from "../../components/DriverHelpLink";
import { ManualAwbModal } from "../../components/ManualAwbModal";
import { DriverLayout } from "../../components/layout/DriverLayout";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useAuth } from "../../store/AuthContext";
import {
  cancelShipmentClaim,
  claimShipment,
  fetchDriverShipments,
  fetchDriverTrucks,
  fetchOpenShipments,
  type DriverShipmentSummary,
  type DriverTruckInfo,
  type OpenShipmentSummary,
} from "../../utils/driverApi";
import { ApiError } from "../../utils/apiClient";
import { formatTanggalPanjang } from "../../utils/format";

const KENDALA_STATUS = "Kendala";
const SELESAI_STATUS = "Selesai / Terkirim";

type StatusFilter = "aktif" | "kendala" | "selesai" | "terbuka";

export default function DriverDashboard() {
  const { profile } = useAuth();
  const [shipments, setShipments] = useState<DriverShipmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trucks, setTrucks] = useState<DriverTruckInfo[]>([]);
  const [openShipments, setOpenShipments] = useState<OpenShipmentSummary[] | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  // The API answers 403 when this Driver account is not linked to a driver
  // record / truck yet. That is "no data", not a failure, so it is shown as
  // an empty state instead of an error banner.
  const [unlinked, setUnlinked] = useState(false);
  const [claimingAwb, setClaimingAwb] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("aktif");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  // The scan / manual-AWB outcome renders inside the "Pesanan Terbuka" list,
  // well below the fold on a phone - bring it into view once it appears.
  const scanOutcomeRef = useRef<HTMLDivElement>(null);
  const [scanResultAwb, setScanResultAwb] = useState<string | null>(null);
  const [scanNotFound, setScanNotFound] = useState<string | null>(null);
  const [custFilter, setCustFilter] = useState<string | null>(null);
  const [tujuanFilter, setTujuanFilter] = useState<string | null>(null);
  const [layananFilter, setLayananFilter] = useState<string | null>(null);
  // const ["", ] = useState(""); // removed - dropdown uses native <select>
  const [refreshing, setRefreshing] = useState(false);

  function onShipmentsError(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      setShipments([]);
      setUnlinked(true);
    } else {
      setError("Gagal memuat pengiriman. Coba muat ulang halaman.");
    }
  }

  function onOpenShipmentsError(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      setOpenShipments([]);
      setUnlinked(true);
    } else {
      setOpenError("Gagal memuat pesanan terbuka. Coba muat ulang halaman.");
    }
  }

  function loadShipments() {
    fetchDriverShipments()
      .then((items) => {
        setShipments(items);
        setUnlinked(false);
      })
      .catch(onShipmentsError);
  }

  function loadOpenShipments() {
    fetchOpenShipments().then(setOpenShipments).catch(onOpenShipmentsError);
  }

  useEffect(() => {
    loadShipments();
    loadOpenShipments();
    fetchDriverTrucks()
      .then(setTrucks)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    setOpenError(null);
    try {
      await Promise.all([
        fetchDriverShipments()
          .then((items) => {
            setShipments(items);
            setUnlinked(false);
          })
          .catch(onShipmentsError),
        fetchOpenShipments().then(setOpenShipments).catch(onOpenShipmentsError),
        fetchDriverTrucks().then(setTrucks).catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleClaim(awb: string) {
    setClaimingAwb(awb);
    setOpenError(null);
    try {
      await claimShipment(awb);
      loadOpenShipments();
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Gagal mengambil pesanan.");
    } finally {
      setClaimingAwb(null);
    }
  }

  async function handleCancelClaim(awb: string) {
    setClaimingAwb(awb);
    setOpenError(null);
    try {
      await cancelShipmentClaim(awb);
      loadOpenShipments();
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Gagal membatalkan klaim.");
    } finally {
      setClaimingAwb(null);
    }
  }

  function handleScanned(rawAwb: string) {
    setScannerOpen(false);
    setManualOpen(false);
    const scanned = rawAwb.trim();
    const match = (openShipments ?? []).find((s) => s.awb.toUpperCase() === scanned.toUpperCase());
    setFilter("terbuka");
    if (match) {
      setScanResultAwb(match.awb);
      setScanNotFound(null);
    } else {
      setScanResultAwb(null);
      setScanNotFound(scanned);
    }
  }

  const active = (shipments ?? []).filter(
    (s) => s.status !== SELESAI_STATUS && s.status !== KENDALA_STATUS,
  );
  const kendala = (shipments ?? []).filter((s) => s.status === KENDALA_STATUS);
  // Best-effort "selesai hari ini" - detail's timeline has the real date,
  // this list endpoint doesn't, so this counts all "Selesai" items for now.
  const selesai = (shipments ?? []).filter((s) => s.status === SELESAI_STATUS);
  const terbuka = openShipments ?? [];
  const scanResult = scanResultAwb ? terbuka.find((s) => s.awb === scanResultAwb) ?? null : null;

  // --- Cascading filter for "Pesanan Terbuka" -------------------------
  // `customer` holds the shipment's customer_id, which is the free-text
  // "Nomor Pelanggan" (e.g. "IDTMDI001") filled in when the order was
  // created - not an internal database id. It is what the driver uses to
  // decide which origin/customer to pick orders up from.
  type OpenFilterKey = "customer" | "tujuan" | "layanan";

  // Matches one order against the active filters. `skip` lets a dropdown
  // build its own option list from every OTHER active filter, so the value
  // currently chosen in that dropdown can never disappear from its own list.
  function matchesOpenFilters(s: OpenShipmentSummary, skip?: OpenFilterKey) {
    if (skip !== "customer" && custFilter && (s.customerId ?? "") !== custFilter) return false;
    if (skip !== "tujuan" && tujuanFilter && s.kotaTujuan !== tujuanFilter) return false;
    if (skip !== "layanan" && layananFilter && s.layanan !== layananFilter) return false;
    return true;
  }

  const filteredOpen = useMemo(
    () => terbuka.filter((s) => matchesOpenFilters(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terbuka, custFilter, tujuanFilter, layananFilter],
  );

  // Every option below is derived from the open orders that survive the
  // OTHER filters, so each option is guaranteed to match >= 1 order.
  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of terbuka) {
      if (!matchesOpenFilters(s, "customer")) continue;
      const id = s.customerId;
      if (!id) continue;
      if (!map.has(id)) map.set(id, s.customerName ? `${id} - ${s.customerName}` : id);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, label]) => ({ value, label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terbuka, custFilter, tujuanFilter, layananFilter]);

  const tujuanOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of terbuka) if (matchesOpenFilters(s, "tujuan")) set.add(s.kotaTujuan);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terbuka, custFilter, tujuanFilter, layananFilter]);

  const layananOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of terbuka) if (matchesOpenFilters(s, "layanan")) set.add(s.layanan);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terbuka, custFilter, tujuanFilter, layananFilter]);

  // A selection can only go stale when the underlying data changes (e.g. a
  // refresh, or another driver claiming the last order of that group) -
  // options can never be picked into an empty result otherwise. Drop just
  // the filter that no longer exists instead of showing an empty list.
  useEffect(() => {
    if (custFilter && !customerOptions.some((o) => o.value === custFilter)) setCustFilter(null);
  }, [custFilter, customerOptions]);
  useEffect(() => {
    if (tujuanFilter && !tujuanOptions.includes(tujuanFilter)) setTujuanFilter(null);
  }, [tujuanFilter, tujuanOptions]);
  useEffect(() => {
    if (layananFilter && !layananOptions.includes(layananFilter)) setLayananFilter(null);
  }, [layananFilter, layananOptions]);

  const hasOpenFilter = Boolean(custFilter || tujuanFilter || layananFilter);

  useEffect(() => {
    if (scanResultAwb || scanNotFound) scanOutcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scanResultAwb, scanNotFound]);



  return (
    <DriverLayout wide>
      {/* Refresh: a subtle utility card under the header, above the greeting.
          Secondary to the primary "Scan AWB" action (soft blue, no heavy border). */}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        aria-busy={refreshing}
        title="Muat ulang data"
        className="mb-5 flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-left transition-colors hover:bg-blue-50 active:bg-blue-100/70 disabled:cursor-wait disabled:opacity-80 sm:w-auto sm:min-w-[300px]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-900">
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-semibold text-blue-950">Refresh Data</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {refreshing ? "Memperbarui data..." : "Perbarui data pengiriman terbaru"}
          </span>
        </span>
      </button>

      <div className="mb-4">
        <p className="text-sm text-slate-500">Halo,</p>
        <h1 className="text-lg font-semibold text-slate-900">{profile?.nama}</h1>
        <p className="text-xs text-slate-400">Driver</p>
      </div>

      {/* Primary Scan AWB on its own full-width row (with extra vertical air
          below it), then the two secondary actions side by side at 50% each.
          All three share one min height. */}
      <div className="mb-6 grid max-w-md grid-cols-2 gap-x-2.5 gap-y-5">
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-blue-900 bg-blue-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
        >
          <ScanLine size={18} /> Scan AWB
        </button>
        <Link
          to={driverPath("/riwayat")}
          className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-blue-900 bg-white px-2.5 py-3 text-xs font-semibold text-blue-900 shadow-sm hover:bg-blue-50 min-[340px]:text-[13px] min-[360px]:text-sm min-[380px]:px-3.5"
        >
          <FileSpreadsheet size={16} /> Data Pengiriman
        </Link>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-blue-900 bg-white px-2.5 py-3 text-xs font-semibold text-blue-900 shadow-sm hover:bg-blue-50 min-[340px]:text-[13px] min-[360px]:text-sm min-[380px]:gap-2 min-[380px]:px-3.5"
        >
          <Keyboard size={18} /> Isi AWB Manual
        </button>
      </div>

      {trucks.length > 0 && (
        <div className="mb-5">
          {/* Primary unit - the truck this driver mainly runs */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 to-blue-950 p-4 shadow-md">
            <Truck size={96} className="pointer-events-none absolute -right-4 -top-4 rotate-12 text-white/10" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-200">
                  <Truck size={13} /> Unit Truck Anda
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="inline-block rounded-lg bg-white px-3.5 py-1.5 font-mono text-2xl font-extrabold tracking-wide text-blue-950 shadow-sm">
                    {trucks[0].nomorUnit}
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                    {trucks[0].jenis}
                  </span>
                </div>
              </div>
              <DriverHelpLink
                message={`Halo Admin, saya driver ${profile?.nama ?? ""} butuh bantuan.`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25"
              >
                <MessageCircle size={14} /> Butuh Bantuan?
              </DriverHelpLink>
            </div>
          </div>

          {/* Any additional units, listed underneath */}
          {trucks.length > 1 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {trucks.slice(1).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <Truck size={15} className="shrink-0 text-slate-400" />
                  <span className="font-mono text-sm font-semibold text-slate-700">{t.nomorUnit}</span>
                  <span className="text-xs text-slate-400">{t.jenis}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-8 grid grid-cols-4 gap-3 sm:gap-7">
        <button
          type="button"
          onClick={() => setFilter("aktif")}
          className={`rounded-xl border p-3 text-center transition-colors sm:p-4 ${
            filter === "aktif" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-lg font-bold text-blue-900 sm:text-2xl">{active.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Aktif</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter("selesai")}
          className={`rounded-xl border p-3 text-center transition-colors sm:p-4 ${
            filter === "selesai" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-lg font-bold text-emerald-600 sm:text-2xl">{selesai.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Selesai</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter("kendala")}
          className={`rounded-xl border p-3 text-center transition-colors sm:p-4 ${
            filter === "kendala" ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-lg font-bold text-red-600 sm:text-2xl">{kendala.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Kendala</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter("terbuka")}
          className={`rounded-xl border p-3 text-center transition-colors sm:p-4 ${
            filter === "terbuka" ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-lg font-bold text-violet-600 sm:text-2xl">{terbuka.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Terbuka</p>
        </button>
      </div>

      {filter === "terbuka" ? (
        <>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pesanan Terbuka · {filteredOpen.length} hasil
          </h2>
          <p className="mb-3 text-xs text-slate-400">
            Pengiriman yang belum ditugaskan ke driver manapun - klik "Ambil Pesanan" untuk mengajukan
            klaim, lalu tunggu admin konfirmasi. Atau scan barcode/QR pada resi.
          </p>
          {/* Filter langsung di halaman. Nomor Pelanggan adalah filter
              utama - driver memakainya untuk memilih origin pickup, lalu
              Tujuan & Service menyesuaikan diri. */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Client
              </label>
              <SearchableSelect
                options={[{ value: "", label: "Semua Client" }, ...customerOptions]}
                value={custFilter ?? ""}
                onChange={(v) => setCustFilter(v || null)}
                placeholder="Semua Client"
                emptyLabel="Tidak ada client."
              />
            </div>
            <div className="min-w-0">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Tujuan
              </label>
              <select
                value={tujuanFilter ?? ""}
                onChange={(e) => setTujuanFilter(e.target.value || null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Semua Tujuan</option>
                {tujuanOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Service
              </label>
              <select
                value={layananFilter ?? ""}
                onChange={(e) => setLayananFilter(e.target.value || null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Semua Service</option>
                {layananOptions.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {hasOpenFilter && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {custFilter && (
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  <span className="truncate">
                    {customerOptions.find((o) => o.value === custFilter)?.label ?? custFilter}
                  </span>
                  <button onClick={() => setCustFilter(null)} className="shrink-0 text-blue-500 hover:text-blue-800" title="Hapus filter nomor pelanggan"><X size={12} /></button>
                </span>
              )}
              {tujuanFilter && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Tujuan: {tujuanFilter}
                  <button onClick={() => setTujuanFilter(null)} className="text-emerald-500 hover:text-emerald-800" title="Hapus filter tujuan"><X size={12} /></button>
                </span>
              )}
              {layananFilter && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                  Service: {layananFilter}
                  <button onClick={() => setLayananFilter(null)} className="text-violet-500 hover:text-violet-800" title="Hapus filter service"><X size={12} /></button>
                </span>
              )}
              <button
                onClick={() => { setCustFilter(null); setTujuanFilter(null); setLayananFilter(null); }}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200"
              >
                <X size={11} /> Reset Semua
              </button>
            </div>
          )}

          <div ref={scanOutcomeRef} className="scroll-mt-20">
          {scanNotFound && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-700">
              <span className="flex items-center gap-2">
                <AlertTriangle size={15} /> AWB "{scanNotFound}" tidak ditemukan di pesanan terbuka.
              </span>
              <button onClick={() => setScanNotFound(null)} className="shrink-0 text-amber-700 hover:text-amber-900">
                <X size={14} />
              </button>
            </div>
          )}

          {scanResult && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Hasil Scan</p>
                <button onClick={() => setScanResultAwb(null)} className="text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              </div>
              <OpenShipmentCard
                item={scanResult}
                claiming={claimingAwb === scanResult.awb}
                onClaim={() => handleClaim(scanResult.awb)}
                onCancel={() => handleCancelClaim(scanResult.awb)}
                highlighted
              />
            </div>
          )}
          </div>

          {openError && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              <AlertTriangle size={15} /> {openError}
            </div>
          )}

          {openShipments === null && !openError && (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
            </div>
          )}

          {openShipments !== null && filteredOpen.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              {hasOpenFilter
                ? "Tidak ada pesanan yang sesuai dengan filter yang dipilih."
                : "Tidak ada pesanan terbuka saat ini."}
            </div>
          )}

          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOpen
              .filter((s) => s.awb !== scanResultAwb)
              .map((s) => (
                <OpenShipmentCard
                  key={s.awb}
                  item={s}
                  claiming={claimingAwb === s.awb}
                  onClaim={() => handleClaim(s.awb)}
                  onCancel={() => handleCancelClaim(s.awb)}
                />
              ))}
          </div>
        </>
      ) : (
        <>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pengiriman Saya · {filter === "aktif" ? "Aktif" : filter === "kendala" ? "Kendala" : "Selesai"}
          </h2>

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {shipments === null && !error && (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
            </div>
          )}

          {shipments !== null && shipments.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <PackageSearch size={30} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Belum ada data pengiriman</p>
              <p className="max-w-xs text-xs text-slate-500">
                {unlinked
                  ? "Akun Anda belum ditautkan ke data driver dan unit truk. Hubungi admin untuk dihubungkan."
                  : "Pengiriman yang ditugaskan kepada Anda akan muncul di sini. Anda juga bisa mengambil pesanan di tab Terbuka."}
              </p>
            </div>
          )}

          {shipments !== null &&
            shipments.length > 0 &&
            { aktif: active, kendala, selesai }[filter].length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
                Tidak ada pengiriman di kategori ini.
              </div>
            )}

          <ShipmentGrid shipments={{ aktif: active, kendala, selesai }[filter]} />
        </>
      )}

      {scannerOpen && <BarcodeScannerModal onClose={() => setScannerOpen(false)} onDetected={handleScanned} />}
      {manualOpen && <ManualAwbModal onClose={() => setManualOpen(false)} onSubmit={handleScanned} />}
    </DriverLayout>
  );
}

function OpenShipmentCard({
  item,
  claiming,
  onClaim,
  onCancel,
  highlighted = false,
}: {
  item: OpenShipmentSummary;
  claiming: boolean;
  onClaim: () => void;
  onCancel: () => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        highlighted ? "border-violet-300 ring-2 ring-violet-100" : "border-slate-200"
      }`}
    >
        {/* Baris 1: AWB saja (Client ID tidak ditampilkan di kartu). */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="shrink-0 font-mono text-sm font-bold text-slate-900">{item.awb}</span>
        </div>
        {/* Baris 2: nama Client (dilewati kalau tidak ada). */}
        {item.customerName && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 size={12} className="shrink-0 text-slate-400" />
            <span className="min-w-0 truncate" title={item.customerName}>
              Client: {item.customerName}
            </span>
          </p>
        )}
        {item.claimStatus === "pending" && item.isMine && (
          <p className="mt-1.5">
            <span className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              Menunggu Konfirmasi
            </span>
          </p>
        )}
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
          {item.kotaAsal} <ArrowRight size={13} className="text-slate-300" /> {item.kotaTujuan}
        </p>
        <p className="mt-1 text-xs text-slate-500">{item.alamatTujuan}</p>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Package size={12} /> {item.jumlahKoli} Koli
        </span>
        <span>{item.layanan}</span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
        <Weight size={12} /> {item.beratKg} Kg
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
        <CalendarClock size={12} className="shrink-0 text-slate-400" />
        Estimasi Tiba: <span className="font-medium text-slate-700">{item.estimasiTiba ? formatTanggalPanjang(item.estimasiTiba) : "Belum tersedia"}</span>
      </p>

      {item.claimStatus === "pending" && item.isMine ? (
        <button
          type="button"
          disabled={claiming}
          onClick={onCancel}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {claiming ? <Loader2 size={13} className="animate-spin" /> : null}
          Batalkan Klaim
        </button>
      ) : (
        <button
          type="button"
          disabled={claiming}
          onClick={onClaim}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {claiming ? <Loader2 size={13} className="animate-spin" /> : <PackageSearch size={13} />}
          Ambil Pesanan
        </button>
      )}
    </div>
  );
}

function ShipmentGrid({ shipments }: { shipments: DriverShipmentSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
      {shipments.map((s) => (
        <Link
          key={s.awb}
          to={driverPath(`/shipments/${s.awb}`)}
          className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:bg-slate-50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-bold text-slate-900">{s.awb}</span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                s.status === KENDALA_STATUS
                  ? "bg-red-50 text-red-700"
                  : s.status === SELESAI_STATUS
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              {s.status}
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
            {s.kotaAsal} <ArrowRight size={13} className="text-slate-300" /> {s.kotaTujuan}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Package size={12} /> {s.jumlahKoli} Koli
            </span>
            {s.truckNomorUnit && (
              <span className="flex items-center gap-1">
                <Truck size={12} /> {s.truckNomorUnit}
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Weight size={12} /> {s.beratKg} Kg
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock size={12} className="shrink-0 text-slate-400" />
            Estimasi Tiba:{" "}
            <span className="font-medium text-slate-700">
              {s.estimasiTiba ? formatTanggalPanjang(s.estimasiTiba) : "Belum tersedia"}
            </span>
          </p>
        </Link>
      ))}
    </div>
  );
}