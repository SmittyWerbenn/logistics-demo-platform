import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Handshake,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Package,
  Pencil,
  Printer,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { QRCode } from "../../components/QRCode";
import { RefreshButton } from "../../components/RefreshButton";
import { ClaimDecisionModal } from "../../components/ClaimDecisionModal";
import { EditShipmentModal } from "../../components/EditShipmentModal";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../store/AuthContext";
import { useMitras } from "../../store/MitraContext";
import { useShipments } from "../../store/ShipmentContext";
import type { Shipment } from "../../types";
import { api } from "../../utils/apiClient";
import { formatJam, formatTanggalJam, formatTanggalPanjang, isoToWib } from "../../utils/format";
import { adminPath, trackingUrl as publicTrackingUrl } from "../../utils/urls";
import { CancelOrderActions, CancellationInfo } from "../../components/CancelOrderActions";
import { HoldInfo, HoldOrderActions } from "../../components/HoldOrderActions";

/** Last row of driver_position_reports (raw DB shape) - the driver portal's
 * "Perbarui Posisi" button writes this, the detail page only reads it. */
interface DriverPosition {
 latitude: number;
 longitude: number;
 accuracy: number | null;
 created_at: string;
 driver_nama: string | null;
}

export default function ShipmentDetail() {
  const { awb } = useParams<{ awb: string }>();
  const { getByAwb, confirmClaim, rejectClaim, unassignDriver, assignMitra } = useShipments();
  const { activeMitras } = useMitras();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [claimActionPending, setClaimActionPending] = useState(false);
  const [claimActionError, setClaimActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [driverPosition, setDriverPosition] = useState<DriverPosition | null>(null);
  const canManageClaims = profile?.role === "Superadmin" || profile?.role === "Admin";

  const [mitraSelect, setMitraSelect] = useState("");
  const [mitraPending, setMitraPending] = useState(false);
  const [mitraError, setMitraError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);

  function reload() {
  return getByAwb(awb ?? "").then((s) => {
  setShipment(s);
  setMitraSelect(s?.mitraId ?? "");
  return s;
  });
  }

  /** Position is supplementary - a failed fetch must never block or hide the
  * detail page, hence the swallowed error (the card simply stays absent). */
  function loadPosition() {
  return api
  .get<{ lastPosition: DriverPosition | null }>(
  `/api/shipments/${encodeURIComponent(awb ?? "")}/position`,
  )
  .then((res) => setDriverPosition(res.lastPosition))
  .catch(() => {});
  }

  async function handleRefresh() {
  setRefreshing(true);
  try {
  await Promise.all([reload(), loadPosition()]);
  } finally {
  setRefreshing(false);
  }
  }

  // Safety net so the printed AWB is always one page, whatever the device
  // (phones lay the print out differently than desktops): when the print
  // layout is taller than the printable A4 area, scale it down to fit.
  // Information is never hidden - only shrunk.
  useEffect(() => fitAwbToOnePage(), []);

  useEffect(() => {
  let cancelled = false;
  setIsLoading(true);
  getByAwb(awb ?? "").then((s) => {
  if (!cancelled) {
  setShipment(s);
  setMitraSelect(s?.mitraId ?? "");
  setIsLoading(false);
  }
  });
  api
  .get<{ lastPosition: DriverPosition | null }>(
  `/api/shipments/${encodeURIComponent(awb ?? "")}/position`,
  )
  .then((res) => {
  if (!cancelled) setDriverPosition(res.lastPosition);
  })
  .catch(() => {});
  return () => {
  cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awb]);

  // Second confirmation (AWB, driver, unit) before a claim is confirmed/rejected.
  const [claimDialog, setClaimDialog] = useState<"confirm" | "reject" | null>(null);

  async function submitClaimDialog() {
    if (!claimDialog || !shipment) return;
    setClaimActionPending(true);
    setClaimActionError(null);
    const seen = { driverId: shipment.claimDriverId ?? "", truckId: shipment.claimTruck?.id ?? null };
    const result = claimDialog === "confirm" ? await confirmClaim(shipment.awb, seen) : await rejectClaim(shipment.awb, seen);
    setClaimActionPending(false);
    if (result.ok) {
      setClaimDialog(null);
      await reload();
    } else {
      setClaimActionError(result.error);
      await reload(); // show the real, current state behind the dialog
    }
  }

  async function handleUnassignDriver() {
    setClaimActionPending(true);
    setClaimActionError(null);
    const result = await unassignDriver(shipment!.awb);
    setClaimActionPending(false);
    if (result.ok) await reload();
    else setClaimActionError(result.error);
  }

  async function handleAssignMitra() {
    setMitraPending(true);
    setMitraError(null);
    const result = await assignMitra(shipment!.awb, mitraSelect || null);
    setMitraPending(false);
    if (result.ok) await reload();
    else setMitraError(result.error);
  }

  async function handleUnassignMitra() {
    setMitraPending(true);
    setMitraError(null);
    const result = await assignMitra(shipment!.awb, null);
    setMitraPending(false);
    if (result.ok) {
      setMitraSelect("");
      await reload();
    } else setMitraError(result.error);
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
        </div>
      </AdminLayout>
    );
  }

  if (!shipment) {
    return (
      <AdminLayout>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">AWB "{awb}" tidak ditemukan.</p>
          <Link to={adminPath("/pengiriman")} className="mt-3 inline-block text-sm text-blue-700 hover:underline">
            Kembali ke Data Pengiriman
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const trackingUrl = publicTrackingUrl(shipment.awb);
  const canEditAlamat = (profile?.role === "Client" || profile?.role === "Superadmin" || profile?.role === "Admin") && (shipment.status === "Dalam Persiapan" || shipment.status === "Hold");

  function printResi() {
    // The browser's print/"Save as PDF" dialog suggests document.title as the
    // filename - set it just for the print action so downloads are named
    // consistently, then restore the normal tab title afterwards. The
    // listener must be attached before print() since print() blocks until
    // the dialog closes, and "afterprint" can fire as soon as it does.
    const previousTitle = document.title;
    window.addEventListener(
      "afterprint",
      () => {
        document.title = previousTitle;
      },
      { once: true },
    );
    document.title = "Sistem Tracking & Resi Digital - Gmslogistics";
    window.print();
  }

  return (
    <AdminLayout>
      <button
        onClick={() => navigate(-1)}
        className="no-print mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> Kembali
      </button>

      <div id="awb-print-area" className="awb-print-area">
      <div className="flex flex-wrap items-start justify-between gap-4 print:block">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Detail Resi / AWB
          </p>
          <h1 className="mt-0.5 font-mono text-2xl font-bold text-slate-900">{shipment.awb}</h1>
          <div className="mt-2">
            <StatusBadge status={shipment.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
          <button
            onClick={printResi}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer size={15} /> Cetak Resi
          </button>
          <button
            onClick={printResi}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={15} /> Download Resi
          </button>
          <Link
            to={adminPath(`/resi/${shipment.awb}/email`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Mail size={15} /> Kirim Email
          </Link>
          <Link
            to={adminPath(`/tracking/${shipment.awb}`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <MapPin size={15} /> Lihat Tracking
          </Link>
          <HoldOrderActions shipment={shipment} onDone={reload} variant="full" />
          <CancelOrderActions shipment={shipment} onDone={reload} variant="full" />
        </div>
      </div>
      {profile?.role !== "Mitra" && <HoldInfo shipment={shipment} />}
      {profile?.role !== "Mitra" && <CancellationInfo shipment={shipment} />}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 print:mt-4 print:grid-cols-3 print:gap-4">
        <div className="space-y-6 lg:col-span-2 print:col-span-2 print:space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 print:shadow-none">
            {canEditAlamat && (
              <div className="mb-4 flex justify-end no-print">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Pencil size={13} /> Edit Data
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <User size={13} /> Pengirim
                </p>
                <p className="text-sm font-medium text-slate-900">{shipment.pengirim.nama}</p>
                <p className="text-sm text-slate-500">{shipment.pengirim.telepon}</p>
                <p className="text-sm text-slate-500">{shipment.pengirim.email}</p>
                <p className="mt-2 text-sm text-slate-600">{shipment.alamatAsal}</p>
                <p className="text-sm font-medium text-slate-700">{shipment.kotaAsal}</p>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <User size={13} /> Penerima
                </p>
                <p className="text-sm font-medium text-slate-900">{shipment.penerima.nama}</p>
                <p className="text-sm text-slate-500">{shipment.penerima.telepon}</p>
                <p className="text-sm text-slate-500">{shipment.penerima.email}</p>
                <p className="mt-2 text-sm text-slate-600">{shipment.alamatTujuan}</p>
                <p className="text-sm font-medium text-slate-700">{shipment.kotaTujuan}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-6 border-t border-slate-100 pt-5">
              {shipment.reference && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Referensi</p>
                  <p className="font-mono text-sm font-medium text-slate-800">{shipment.reference}</p>
                </div>
              )}
              {shipment.customerId && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client ID</p>
                  <p className="text-sm font-medium text-slate-800">{shipment.customerId}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Layanan</p>
                <p className="text-sm font-medium text-slate-800">{shipment.layanan}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Berat Final</p>
                <p className="text-sm font-medium text-slate-800">{shipment.beratKg} Kg</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Jumlah Koli</p>
                <p className="text-sm font-medium text-slate-800">{shipment.jumlahKoli} Koli</p>
              </div>
              {shipment.slaValue != null && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ETA</p>
                  <p className="text-sm font-medium text-slate-800">{shipment.slaValue} Hari</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estimasi Tiba</p>
                <p className="text-sm font-medium text-slate-800">
                  {shipment.estimasiTiba ? formatTanggalPanjang(shipment.estimasiTiba) : "Belum tersedia"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Asuransi</p>
                <p className="text-sm font-medium text-slate-800">
                  {shipment.asuransi ? "Ya" : "Tidak"}
                </p>
              </div>
              {shipment.asuransi && (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Koli Diasuransi</p>
                    <p className="text-sm font-medium text-slate-800">{shipment.koliAsuransi ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nilai Asuransi</p>
                    <p className="text-sm font-medium text-slate-800">
                      Rp{shipment.nilaiAsuransi?.toLocaleString("id-ID") ?? "-"}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Package size={13} /> Deskripsi Barang
              </p>
              <p className="text-sm text-slate-700">{shipment.deskripsiBarang}</p>
              <div className="mt-3 flex flex-wrap gap-4">
                {shipment.fotoBarang && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-slate-400">Foto Barang</p>
                    <img
                      src={shipment.fotoBarang}
                      alt="Foto barang"
                      className="h-40 w-40 rounded-lg border border-slate-200 object-cover print:h-24 print:w-24"
                    />
                  </div>
                )}
                {shipment.fotoSuratJalan && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-slate-400">Foto Surat Jalan</p>
                    <img
                      src={shipment.fotoSuratJalan}
                      alt="Foto surat jalan"
                      className="h-40 w-40 rounded-lg border border-slate-200 object-cover print:h-24 print:w-24"
                    />
                  </div>
                )}
              </div>
            </div>

            {profile?.role !== "Viewer" && profile?.role !== "Mitra" && (
            <>
            <div className="mt-6 border-t border-slate-100 pt-5 print:hidden">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Truck size={13} /> Truck &amp; Driver
              </p>

              {claimActionError && (
                <p className="mb-2 text-xs font-medium text-red-600">{claimActionError}</p>
              )}

              {shipment.claimStatus === "pending" ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <p className="text-sm text-violet-800">
                    Diklaim oleh <span className="font-semibold">{shipment.claimDriverNama}</span>
                    {shipment.claimDriverTelepon && ` (${shipment.claimDriverTelepon})`} - menunggu
                    konfirmasi.
                    {shipment.claimRequestedAt && (
                      <span className="mt-0.5 block text-xs text-violet-600">
                        Diajukan {formatTanggalJam(isoToWib(shipment.claimRequestedAt).tanggal, isoToWib(shipment.claimRequestedAt).jam)}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-violet-700">
                    Unit: <span className="font-semibold">{shipment.claimTruck?.nomorUnit ?? "-"}</span> · Jenis:{" "}
                    <span className="font-semibold">{shipment.claimTruck?.jenis ?? "-"}</span>
                  </p>
                  {canManageClaims && (
                    <div className="mt-3 flex items-center gap-2 no-print">
                      <button
                        type="button"
                        disabled={claimActionPending}
                        onClick={() => {
                          setClaimActionError(null);
                          setClaimDialog("reject");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <XCircle size={13} /> Tolak
                      </button>
                      <button
                        type="button"
                        disabled={claimActionPending}
                        onClick={() => {
                          setClaimActionError(null);
                          setClaimDialog("confirm");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                      >
                        {claimActionPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Konfirmasi
                      </button>
                    </div>
                  )}
                </div>
              ) : !shipment.truckId ? (
                <p className="text-sm text-slate-500">
                  Belum ditugaskan ke driver manapun - pengiriman ini masuk daftar "Pesanan Terbuka"
                  di portal driver.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
                    <p>
                      <span className="text-slate-400">Nomor Unit:</span> {shipment.truck.nomorUnit}
                    </p>
                    <p>
                      <span className="text-slate-400">Jenis:</span> {shipment.truck.jenis}
                    </p>
                    {shipment.truck.driver && (
                      <p>
                        <span className="text-slate-400">Driver:</span> {shipment.truck.driver}
                      </p>
                    )}
                  </div>
                  {canManageClaims && shipment.status === "Dalam Persiapan" && (
                    <button
                      type="button"
                      disabled={claimActionPending}
                      onClick={handleUnassignDriver}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 no-print"
                    >
                      {claimActionPending ? <Loader2 size={13} className="animate-spin" /> : null}
                      Batalkan Penugasan
                    </button>
                  )}
                </>
              )}
            </div>
            </>
            )}

            {profile?.role !== "Viewer" && profile?.role !== "Client" && (
            <>

            <div className="mt-6 border-t border-slate-100 pt-5 print:hidden">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Handshake size={13} /> Mitra
              </p>

              {mitraError && <p className="mb-2 text-xs font-medium text-red-600">{mitraError}</p>}

              {canManageClaims ? (
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <select
                    value={mitraSelect}
                    onChange={(e) => setMitraSelect(e.target.value)}
                    disabled={mitraPending}
                    className="min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">- Belum diteruskan ke Mitra -</option>
                    {activeMitras.map((m) => (
                      <option key={m.kodeMitra} value={m.kodeMitra}>
                        {m.nama} ({m.kodeMitra})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={mitraPending || mitraSelect === (shipment.mitraId ?? "")}
                    onClick={handleAssignMitra}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {mitraPending ? <Loader2 size={13} className="animate-spin" /> : null}
                    Teruskan ke Mitra
                  </button>
                  {shipment.mitraId && (
                    <button
                      type="button"
                      disabled={mitraPending}
                      onClick={handleUnassignMitra}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Batalkan Penugasan
                    </button>
                  )}
                </div>
              ) : shipment.mitraId ? (
                <p className="text-sm text-slate-700">
                  Diteruskan ke <span className="font-semibold">{shipment.mitraNama ?? shipment.mitraId}</span>
                </p>
              ) : (
                <p className="text-sm text-slate-500">Belum diteruskan ke Mitra manapun.</p>
              )}
            </div>
            </>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Tanggal Dibuat</p>
                <p className="font-medium text-slate-700">
                  {formatTanggalPanjang(shipment.tanggalDibuat)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Jam Dibuat</p>
                <p className="font-medium text-slate-700">{shipment.jamDibuat} WIB</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status Email</p>
                <p className="font-medium text-slate-700">
                  {shipment.emailTerkirim ? "Terkirim" : "Belum dikirim"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {shipment.pod && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:shadow-none">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <CheckCircle2 size={13} /> Bukti Serah Terima
              </p>
              <p className="text-xs text-slate-500">Diterima oleh :</p>
              <p className="text-sm font-semibold text-slate-900">{shipment.pod.namaPenerima}</p>
              <p className="mt-2 text-xs text-slate-500">Tanggal &amp; Waktu Diterima :</p>
              <p className="text-sm font-medium text-slate-800">
                {formatTanggalPanjang(shipment.pod.tanggal)} · {formatJam(shipment.pod.jam)}
              </p>
            </div>
          )}
          {driverPosition && (
            <div className="no-print rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Navigation size={13} /> Posisi Terakhir Driver
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {driverPosition.latitude.toFixed(5)}, {driverPosition.longitude.toFixed(5)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatTanggalJam(
                  isoToWib(driverPosition.created_at).tanggal,
                  isoToWib(driverPosition.created_at).jam,
                )}
              </p>
              <p className="text-xs text-slate-500">
                {driverPosition.driver_nama
                  ? `Dilaporkan oleh ${driverPosition.driver_nama}`
                  : "Dilaporkan dari portal driver"}
              </p>
              {driverPosition.accuracy != null && (
                <p className="text-xs text-slate-500">
                  Akurasi ±{Math.round(driverPosition.accuracy)} m
                </p>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${driverPosition.latitude},${driverPosition.longitude}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Navigation size={13} /> Buka di Google Maps
              </a>
            </div>
          )}
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm print:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              QR Tracking
            </p>
            <QRCode data={trackingUrl} size={160} />
            <p className="break-all text-[11px] text-slate-400">{trackingUrl}</p>
            <p className="text-xs text-slate-500">
              Scan QR untuk membuka halaman tracking publik AWB ini.
            </p>
          </div>
          {profile?.role !== "Viewer" && profile?.role !== "Client" && (
            <Link
              to={adminPath(`/update-tracking/${shipment.awb}`)}
              className="block rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-center text-sm font-semibold text-blue-800 hover:bg-blue-100 no-print"
            >
              + Tambah Update Tracking
            </Link>
          )}
        </div>
      </div>
      </div>

      {claimDialog && shipment.claimStatus === "pending" && (
        <ClaimDecisionModal
          mode={claimDialog}
          claim={{ awb: shipment.awb, driverNama: shipment.claimDriverNama ?? "-", nomorUnit: shipment.claimTruck?.nomorUnit ?? null, jenisUnit: shipment.claimTruck?.jenis ?? null }}
          pending={claimActionPending}
          error={claimActionError}
          onCancel={() => {
            setClaimDialog(null);
            setClaimActionError(null);
          }}
          onSubmit={submitClaimDialog}
        />
      )}
      {editOpen && <EditShipmentModal shipment={shipment} onClose={() => setEditOpen(false)} onSaved={() => reload()} />}
    </AdminLayout>
  );
}

/** Printable height of an A4 page (297mm - 2 x 10mm margin) in CSS px. */
const A4_PRINTABLE_HEIGHT_PX = ((297 - 20) / 25.4) * 96;

/** While the browser is in print mode, zooms #awb-print-area down so its
 * height fits one page; resets afterwards. Returns the cleanup function. */
function fitAwbToOnePage(): () => void {
  const mql = window.matchMedia("print");
  const fit = () => {
    const el = document.getElementById("awb-print-area");
    if (!el) return;
    el.style.zoom = "";
    if (!mql.matches) return;
    // Space already used above the area (back button is no-print; nothing else).
    const height = el.getBoundingClientRect().height;
    if (height > A4_PRINTABLE_HEIGHT_PX) el.style.zoom = String(Math.max(0.4, (A4_PRINTABLE_HEIGHT_PX / height) * 0.97));
  };
  const reset = () => {
    const el = document.getElementById("awb-print-area");
    if (el) el.style.zoom = "";
  };
  mql.addEventListener("change", fit);
  window.addEventListener("afterprint", reset);
  return () => {
    mql.removeEventListener("change", fit);
    window.removeEventListener("afterprint", reset);
  };
}
