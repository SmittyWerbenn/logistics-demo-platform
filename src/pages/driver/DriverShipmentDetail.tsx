import { driverPath } from "../../utils/urls";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Headset,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Truck,
  User,
  X,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DriverLayout } from "../../components/layout/DriverLayout";
import { LocationTextInput } from "../../components/LocationTextInput";
import { PhotoPickerBox } from "../../components/PhotoPickerBox";
import { RefreshButton } from "../../components/RefreshButton";
import { DriverHelpLink } from "../../components/DriverHelpLink";
import { toWhatsAppNumber } from "../../store/HelpContactContext";
import { useShipments } from "../../store/ShipmentContext";
import type { ShipmentStatus, TimelineEventType } from "../../types";
import { ApiError } from "../../utils/apiClient";
import { checkPhotoSize, compressImage } from "../../utils/compressImage";
import {
  fetchDriverLastPosition,
  fetchDriverShipmentDetail,
  reportDriverPosition,
  type DriverLastPosition,
  type DriverShipmentDetail as DriverShipmentDetailData,
} from "../../utils/driverApi";
import { formatJam, formatTanggalPanjang, nowHHMM, todayISO, isoToWib } from "../../utils/format";
import { getAllowedNextEvents } from "../../utils/status";

function formatCoord(n: number): string {
  return n.toFixed(5);
}

const KENDALA_REASONS = [
  "Penerima Tidak Ada",
  "Alamat Tidak Ditemukan",
  "Nomor Penerima Tidak Aktif",
  "Kendaraan Bermasalah",
  "Kecelakaan / Keadaan Darurat",
  "Jalan Tidak Dapat Dilalui",
  "Penerima Menolak Barang",
  "Barang Bermasalah",
];

const SELESAI_STATUS = "Selesai / Terkirim";

export default function DriverShipmentDetail() {
  const { awb } = useParams<{ awb: string }>();
  const { addTrackingUpdate } = useShipments();
  // Lokasi update status mengarah ke "Nama Area" (hanya field Nama Area di Kota & Titik Transit).
  const [data, setData] = useState<DriverShipmentDetailData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lastPosition, setLastPosition] = useState<DriverLastPosition | null>(null);
  const [reporting, setReporting] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [positionSaved, setPositionSaved] = useState(false);

  const [statusType, setStatusType] = useState<TimelineEventType | "">("");
  const [statusLokasi, setStatusLokasi] = useState("");
  const [statusKeterangan, setStatusKeterangan] = useState("");
  const [statusNamaPenerima, setStatusNamaPenerima] = useState("");
  const [fotoBarangDiterima, setFotoBarangDiterima] = useState<string | null>(null);
  const [fotoSuratJalan, setFotoSuratJalan] = useState<string | null>(null);
  const [statusFoto, setStatusFoto] = useState<string[]>([]);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSaved, setStatusSaved] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!awb) return;
    let cancelled = false;
    fetchDriverShipmentDetail(awb)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat pengiriman.");
      });
    fetchDriverLastPosition(awb)
      .then((pos) => {
        if (!cancelled) setLastPosition(pos);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [awb]);

  async function handleRefresh() {
    if (!awb) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchDriverShipmentDetail(awb)
          .then(setData)
          .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Gagal memuat pengiriman.")),
        fetchDriverLastPosition(awb).then(setLastPosition).catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleReportPosition() {
    if (!awb) return;
    if (!navigator.geolocation) {
      setPositionError("Perangkat/browser ini tidak mendukung geolokasi.");
      return;
    }
    setReporting(true);
    setPositionError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        reportDriverPosition(awb, coords)
          .then(() => {
            setLastPosition({ ...coords, created_at: new Date().toISOString() });
            setPositionSaved(true);
            setTimeout(() => setPositionSaved(false), 2500);
          })
          .catch((err) => {
            setPositionError(err instanceof ApiError ? err.message : "Gagal mengirim posisi.");
          })
          .finally(() => setReporting(false));
      },
      (err) => {
        setReporting(false);
        setPositionError(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser."
            : "Gagal mendapatkan lokasi perangkat. Coba lagi.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function handleFotoBarangChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkPhotoSize(file);
    if (sizeError) {
      setFotoError(sizeError);
      return;
    }
    setFotoError(null);
    compressImage(file)
      .then(setFotoBarangDiterima)
      .catch(() => setFotoError("Gagal memproses foto. Coba foto lain."));
  }

  function handleFotoSuratJalanChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkPhotoSize(file);
    if (sizeError) {
      setFotoError(sizeError);
      return;
    }
    setFotoError(null);
    compressImage(file)
      .then(setFotoSuratJalan)
      .catch(() => setFotoError("Gagal memproses foto. Coba foto lain."));
  }

  function handleStatusFotoChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setFotoError(null);
    files.forEach((file) => {
      const sizeError = checkPhotoSize(file);
      if (sizeError) {
        setFotoError(sizeError);
        return;
      }
      compressImage(file)
        .then((dataUrl) => setStatusFoto((prev) => [...prev, dataUrl]))
        .catch(() => setFotoError("Gagal memproses salah satu foto. Coba lagi."));
    });
  }

  async function handleStatusSubmit(e: FormEvent) {
    e.preventDefault();
    if (!awb || !statusType) return;
    const isSelesai = statusType === SELESAI_STATUS;
    if (!isSelesai && !statusLokasi.trim()) {
      setStatusError("Lokasi wajib diisi.");
      return;
    }
    if (isSelesai && !statusNamaPenerima.trim()) {
      setStatusError("Nama penerima wajib diisi.");
      return;
    }
    if (isSelesai && !fotoBarangDiterima) {
      setStatusError("Foto barang diterima wajib diunggah sebagai bukti serah terima.");
      return;
    }
    if (!statusKeterangan.trim()) {
      setStatusError("Catatan wajib diisi.");
      return;
    }

    setStatusSubmitting(true);
    setStatusError(null);
    const result = await addTrackingUpdate({
      awb,
      type: statusType,
      lokasi: statusLokasi.trim(),
      tanggal: todayISO(),
      jam: nowHHMM(),
      keterangan: statusKeterangan.trim(),
      namaPenerima: isSelesai ? statusNamaPenerima.trim() : undefined,
      foto: isSelesai
        ? [fotoBarangDiterima, fotoSuratJalan].filter((f): f is string => !!f)
        : statusFoto.length > 0
          ? statusFoto
          : undefined,
    });
    setStatusSubmitting(false);

    if (!result.ok) {
      setStatusError(result.error);
      return;
    }

    setStatusType("");
    setStatusLokasi("");
    setStatusKeterangan("");
    setStatusNamaPenerima("");
    setFotoBarangDiterima(null);
    setFotoSuratJalan(null);
    setStatusFoto([]);
    setStatusSaved(true);
    setTimeout(() => setStatusSaved(false), 2500);
    fetchDriverShipmentDetail(awb)
      .then(setData)
      .catch(() => {});
  }

  if (loadError) {
    return (
      <DriverLayout>
        <Link to={driverPath("/")} className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900">
          <ArrowLeft size={15} /> Kembali
        </Link>
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          <AlertTriangle size={15} /> {loadError}
        </div>
      </DriverLayout>
    );
  }

  if (!data) {
    return (
      <DriverLayout>
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
        </div>
      </DriverLayout>
    );
  }

  const { shipment, timeline } = data;
  const mapsQuery = encodeURIComponent(`${shipment.alamatTujuan}, ${shipment.kotaTujuan}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const isLocked = shipment.status === SELESAI_STATUS;
  const allowedNext = isLocked
    ? []
    : getAllowedNextEvents(shipment.status as ShipmentStatus).filter((t) => t !== "Transfer Unit" && t !== "Re-route" && t !== "Penarikan");
  const isSelesaiSelected = statusType === SELESAI_STATUS;
  const isKendalaSelected = statusType === "Kendala";

  return (
    <DriverLayout wide>
      <div className="mb-4 flex items-center justify-between">
        <Link to={driverPath("/")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900">
          <ArrowLeft size={15} /> Kembali
        </Link>
        <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
      </div>

      <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-4">
        {/* Left column: shipment info (read-heavy) */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-bold text-slate-900">{shipment.awb}</span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {shipment.status}
              </span>
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarClock size={13} className="shrink-0 text-slate-400" />
              Estimasi Tiba:{" "}
              <span className="font-semibold text-slate-700">
                {shipment.estimasiTiba ? formatTanggalPanjang(shipment.estimasiTiba) : "Belum tersedia"}
              </span>
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Asal</p>
                  {shipment.pengirim?.nama && <p className="text-sm font-medium text-slate-900">{shipment.pengirim.nama}</p>}
                  <p className="text-sm text-slate-700">{shipment.alamatAsal}, {shipment.kotaAsal}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tujuan</p>
                  <p className="text-sm font-medium text-slate-900">{shipment.penerima.nama}</p>
                  <p className="text-sm text-slate-700">{shipment.alamatTujuan}, {shipment.kotaTujuan}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 py-3 text-sm font-semibold text-white hover:bg-blue-800"
              >
                <Navigation size={16} /> Rute Tujuan
              </a>

              {shipment.penerima.telepon && (
                <a
                  href={`https://wa.me/${toWhatsAppNumber(shipment.penerima.telepon)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-300 bg-emerald-50 py-2.5 text-emerald-700 hover:bg-emerald-100"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle size={16} /> Hubungi Penerima
                  </span>
                  <span className="text-xs font-normal text-emerald-600">{shipment.penerima.telepon}</span>
                </a>
              )}
            </div>

            <DriverHelpLink
              message={`Halo Admin, saya driver AWB ${shipment.awb} butuh bantuan.`}
              className="mt-2 flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-300 bg-amber-50 py-2.5 text-amber-700 hover:bg-amber-100"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Headset size={16} /> Hubungi Admin (Darurat/Kendala)
              </span>
            </DriverHelpLink>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Informasi Barang</h2>
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-slate-700">
                <Package size={15} className="text-slate-400" />
                {shipment.jumlahKoli} Koli &middot; {shipment.beratKg} Kg &middot; {shipment.layanan}
              </div>
              <p className="text-slate-600">{shipment.deskripsiBarang}</p>
              {shipment.truckNomorUnit && (
                <div className="flex items-center gap-2.5 text-slate-700">
                  <Truck size={15} className="text-slate-400" />
                  {shipment.truckNomorUnit}
                </div>
              )}
              <div className="flex items-center gap-2.5 text-slate-700">
                <User size={15} className="text-slate-400" />
                {shipment.penerima.nama}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Riwayat Perjalanan</h2>
            <ol className="flex flex-col gap-3">
              {[...timeline].reverse().map((e) => (
                <li key={e.id} className="border-l-2 border-slate-200 pl-3">
                  <p className="text-xs text-slate-400">
                    {formatTanggalPanjang(e.tanggal)} &middot; {formatJam(e.jam)}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{e.type}</p>
                  <p className="text-xs text-slate-500">{e.lokasi}</p>
                  {e.keterangan && <p className="mt-0.5 text-xs text-slate-500">{e.keterangan}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right column: driver actions */}
        <div className="mt-4 flex flex-col gap-4 lg:col-span-2 lg:mt-0">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Perbarui Status</h2>

            {isLocked ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={15} /> Pengiriman ini sudah Selesai/Terkirim.
              </div>
            ) : (
              <form onSubmit={handleStatusSubmit} className="flex flex-col gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Status Baru</span>
                  <select
                    required
                    value={statusType}
                    onChange={(e) => {
                      setStatusType(e.target.value as TimelineEventType);
                      setStatusKeterangan("");
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Pilih status...</option>
                    {allowedNext.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                {statusType && !isSelesaiSelected && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-600">Lokasi (Nama Area)</span>
                      <LocationTextInput
                        id="driver-status-lokasi"
                        required
                        value={statusLokasi}
                        onChange={setStatusLokasi}
                        kind="area"
                        placeholder="Pilih / ketik Nama Area, contoh: Semarang Barat"
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-slate-600">
                        Foto <span className="text-slate-400">(Opsional)</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <PhotoPickerBox onChange={handleStatusFotoChange} size="sm" multiple />
                        {statusFoto.map((src, i) => (
                          <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                            <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setStatusFoto((prev) => prev.filter((_, idx) => idx !== i))}
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {isSelesaiSelected && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Penerima</span>
                      <input
                        required
                        value={statusNamaPenerima}
                        onChange={(e) => setStatusNamaPenerima(e.target.value)}
                        placeholder="Nama yang menerima barang"
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-slate-600">
                        Foto Barang Diterima <span className="text-red-500">*</span>
                      </span>
                      <div className="flex items-center gap-3">
                        {fotoBarangDiterima ? (
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                            <img
                              src={fotoBarangDiterima}
                              alt="Foto barang diterima"
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setFotoBarangDiterima(null)}
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <PhotoPickerBox onChange={handleFotoBarangChange} />
                        )}
                        <p className="text-xs text-slate-400">
                          Wajib. Bukti foto barang sudah diterima - ini yang tampil di tracking customer.
                        </p>
                      </div>
                    </div>

                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-slate-600">
                        Foto Surat Jalan <span className="text-slate-400">(Opsional)</span>
                      </span>
                      <div className="flex items-center gap-3">
                        {fotoSuratJalan ? (
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                            <img
                              src={fotoSuratJalan}
                              alt="Foto surat jalan"
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setFotoSuratJalan(null)}
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <PhotoPickerBox onChange={handleFotoSuratJalanChange} />
                        )}
                        <p className="text-xs text-slate-400">
                          Opsional. Tidak ditampilkan ke customer, hanya untuk arsip internal.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {fotoError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                    <AlertTriangle size={14} /> {fotoError}
                  </div>
                )}

                {isKendalaSelected && (
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Jenis Kendala</span>
                    <div className="flex flex-wrap gap-1.5">
                      {KENDALA_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setStatusKeterangan(reason)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            statusKeterangan === reason
                              ? "border-red-500 bg-red-50 text-red-700"
                              : "border-slate-300 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {statusType && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Catatan</span>
                    <textarea
                      required
                      rows={2}
                      value={statusKeterangan}
                      onChange={(e) => setStatusKeterangan(e.target.value)}
                      placeholder="Keterangan singkat"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                )}

                {statusError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                    <AlertTriangle size={14} /> {statusError}
                  </div>
                )}
                {statusSaved && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 size={14} /> Status berhasil diperbarui.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!statusType || statusSubmitting}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-900 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {statusSubmitting && <Loader2 size={15} className="animate-spin" />}
                  Simpan Status
                </button>
              </form>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Laporkan Posisi</h2>

            {lastPosition && (
              <p className="mb-3 text-xs text-slate-500">
                Posisi terakhir: {formatCoord(lastPosition.latitude)}, {formatCoord(lastPosition.longitude)}
                <br />
                {formatTanggalPanjang(isoToWib(lastPosition.created_at).tanggal)} &middot;{" "}
                {formatJam(isoToWib(lastPosition.created_at).jam)}
              </p>
            )}

            <button
              type="button"
              onClick={handleReportPosition}
              disabled={reporting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <MapPin size={16} />
              {reporting ? "Mengambil lokasi..." : "Perbarui Posisi"}
            </button>

            {positionError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                <AlertTriangle size={14} /> {positionError}
              </div>
            )}
            {positionSaved && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={14} /> Posisi berhasil dikirim.
              </div>
            )}
          </div>
        </div>
      </div>
    </DriverLayout>
  );
}
