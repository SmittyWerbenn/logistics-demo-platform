import { adminPath } from "../../utils/urls";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  MapPin,
  Pencil,
  Save,
  Send,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LocationTextInput } from "../../components/LocationTextInput";
import { PhotoPickerBox } from "../../components/PhotoPickerBox";
import { SearchableSelect } from "../../components/SearchableSelect";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../store/AuthContext";
import { useLayanan } from "../../store/LayananContext";
import { useFleet } from "../../store/FleetContext";
import { useShipments } from "../../store/ShipmentContext";
import type { Shipment, TimelineEventType, TrackingUpdateFormData, UpdateShipmentInfoData } from "../../types";
import { checkPhotoSize, compressImage } from "../../utils/compressImage";
import { formatTanggalJam, formatTanggalPanjang, nowHHMM, todayISO } from "../../utils/format";
import { addBusinessDays } from "../../utils/sla";
import { getAllowedNextEvents } from "../../utils/status";
import { useLocationSuggest } from "../../utils/useLocationSuggest";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function UpdateTracking() {
  const { awb } = useParams<{ awb: string }>();
  const { getByAwb, addTrackingUpdate, updateShipmentInfo, updatePodPhoto } = useShipments();
  const { activeNames: activeLayanan, refresh: refreshLayanan } = useLayanan();
  const { trucksWithDriver } = useFleet();
  const { profile } = useAuth();
  const isMitra = profile?.role === "Mitra";
  // Editing shipment data (incl. the addresses) needs shipments.update_info on
  // the API, which only Superadmin/Admin have. Everyone else (e.g. Mitra) gets
  // a read-only view of the same details - the edit controls are not rendered.
  const canEditInfo = profile?.role === "Superadmin" || profile?.role === "Admin";
  const navigate = useNavigate();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedFor = useRef<string | null>(null);

  const [type, setType] = useState<TimelineEventType>("Transit");
  const [lokasi, setLokasi] = useState("");
  const [tanggal, setTanggal] = useState(todayISO());
  const [jam, setJam] = useState(nowHHMM());
  const [keterangan, setKeterangan] = useState("");
  const [namaPenerima, setNamaPenerima] = useState("");
  const [foto, setFoto] = useState<string[]>([]);
  const [fotoBarangDiterima, setFotoBarangDiterima] = useState<string | null>(null);
  const [fotoSuratJalan, setFotoSuratJalan] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editPengirim, setEditPengirim] = useState({ nama: "", telepon: "", email: "" });
  const [editPenerima, setEditPenerima] = useState({ nama: "", telepon: "", email: "" });
  const [editKotaAsal, setEditKotaAsal] = useState("");
  // City pickers search the master data server-side as the user types.
  const [kotaAsalQuery, setKotaAsalQuery] = useState("");
  const [kotaTujuanQuery, setKotaTujuanQuery] = useState("");
  const toKotaOption = (k: { nama: string; provinsi?: string | null; jenis?: string | null }) => ({
    value: k.nama,
    label: k.nama,
    description: [k.jenis, k.provinsi].filter(Boolean).join(" - "),
  });
  const kotaAsalOptions = useLocationSuggest("kota", kotaAsalQuery).map(toKotaOption);
  const kotaTujuanOptions = useLocationSuggest("kota", kotaTujuanQuery).map(toKotaOption);
  const [editAlamatAsal, setEditAlamatAsal] = useState("");
  const [editKotaTujuan, setEditKotaTujuan] = useState("");
  const [editAlamatTujuan, setEditAlamatTujuan] = useState("");
  const [editSlaValue, setEditSlaValue] = useState<number | undefined>(undefined);
  const [editLayanan, setEditLayanan] = useState("");
  const [editSaved, setEditSaved] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // The Layanan dropdown must reflect Master Layanan as of now, not as of
  // when this session started.
  useEffect(() => {
    if (editInfoOpen) refreshLayanan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editInfoOpen]);

  const [podBarangError, setPodBarangError] = useState<string | null>(null);
  const [podBarangSaved, setPodBarangSaved] = useState(false);
  const [podSuratJalanError, setPodSuratJalanError] = useState<string | null>(null);
  const [podSuratJalanSaved, setPodSuratJalanSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getByAwb(awb ?? "").then((s) => {
      if (cancelled) return;
      setShipment(s);
      setIsLoading(false);
      if (s && initializedFor.current !== s.awb) {
        initializedFor.current = s.awb;
        const allowedOptions = getAllowedNextEvents(s.status).filter((o) => !isMitra || o !== "Transfer Unit");
        setType(allowedOptions[0] ?? "Transit");
        setNamaPenerima(s.penerima.nama);
        setTruckId(s.truckId ?? "");
        setEditPengirim(s.pengirim);
        setEditPenerima(s.penerima);
        setEditKotaAsal(s.kotaAsal);
        setEditAlamatAsal(s.alamatAsal);
        setEditKotaTujuan(s.kotaTujuan);
        setEditAlamatTujuan(s.alamatTujuan);
        setEditSlaValue(s.slaValue);
        setEditLayanan(s.layanan);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awb]);

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

  const allowedOptions = getAllowedNextEvents(shipment.status).filter((o) => !isMitra || o !== "Transfer Unit");
  const locked = shipment.status === "Selesai / Terkirim";
  const POD_EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  const deliveredEvent = [...shipment.timeline].reverse().find((e) => e.type === "Selesai / Terkirim");
  const deliveredAtMs = deliveredEvent?.inputAt ? new Date(deliveredEvent.inputAt).getTime() : null;
  const podEditDeadlineMs = deliveredAtMs !== null ? deliveredAtMs + POD_EDIT_WINDOW_MS : null;
  const nowMs = new Date().getTime();
  const canEditPodPhoto = Boolean(shipment.pod && podEditDeadlineMs !== null && nowMs < podEditDeadlineMs);
  const podEditDaysLeft =
    podEditDeadlineMs !== null ? Math.max(0, Math.ceil((podEditDeadlineMs - nowMs) / (24 * 60 * 60 * 1000))) : 0;
  const deliveredAtLabel = deliveredEvent ? formatTanggalJam(deliveredEvent.tanggal, deliveredEvent.jam) : null;

  function handlePodPhotoChange(slot: "barang" | "suratJalan") {
    const setError = slot === "barang" ? setPodBarangError : setPodSuratJalanError;
    const setSaved = slot === "barang" ? setPodBarangSaved : setPodSuratJalanSaved;
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const sizeError = checkPhotoSize(file);
      if (sizeError) {
        setError(sizeError);
        return;
      }
      setError(null);
      setSaved(false);
      compressImage(file)
        .then(async (dataUrl) => {
          await updatePodPhoto(shipment!.awb, slot, dataUrl);
          const refreshed = await getByAwb(shipment!.awb);
          if (refreshed) setShipment(refreshed);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        })
        .catch(() => setError("Gagal memproses foto. Coba foto lain."));
    };
  }
  const truckOptions = trucksWithDriver.map((t) => ({
    value: t.id,
    label: `${t.nomorUnit} - ${t.jenis}`,
    description: t.driver ? `Driver: ${t.driver.nama}` : undefined,
  }));
  const selectedTruck = trucksWithDriver.find((t) => t.id === truckId);
  const isSelesai = type === "Selesai / Terkirim";
  const resolvedLokasi = isSelesai ? shipment.kotaTujuan : lokasi;
  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    if (!editKotaAsal || !editKotaTujuan) {
      setEditFormError("Pilih kota asal dan kota tujuan terlebih dahulu.");
      return;
    }
    setEditFormError(null);
    const data: UpdateShipmentInfoData = {
      pengirim: editPengirim,
      penerima: editPenerima,
      alamatAsal: editAlamatAsal,
      kotaAsal: editKotaAsal,
      alamatTujuan: editAlamatTujuan,
      kotaTujuan: editKotaTujuan,
      layanan: editLayanan,
      slaValue: editSlaValue ?? null,
    };
    const result = await updateShipmentInfo(shipment!.awb, data);
    if (result.ok) {
      setEditSaved(true);
      setTimeout(() => setEditSaved(false), 2500);
    } else {
      setEditFormError(result.error);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoError(null);
    files.forEach((file) => {
      const sizeError = checkPhotoSize(file);
      if (sizeError) {
        setPhotoError(sizeError);
        return;
      }
      compressImage(file)
        .then((dataUrl) => setFoto((prev) => [...prev, dataUrl]))
        .catch(() => setPhotoError("Gagal memproses salah satu foto. Coba lagi."));
    });
  }

  function handleFotoBarangDiterimaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkPhotoSize(file);
    if (sizeError) {
      setPhotoError(sizeError);
      return;
    }
    setPhotoError(null);
    compressImage(file)
      .then(setFotoBarangDiterima)
      .catch(() => setPhotoError("Gagal memproses foto barang diterima. Coba lagi."));
  }

  function handleFotoSuratJalanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkPhotoSize(file);
    if (sizeError) {
      setPhotoError(sizeError);
      return;
    }
    setPhotoError(null);
    compressImage(file)
      .then(setFotoSuratJalan)
      .catch(() => setPhotoError("Gagal memproses foto surat jalan. Coba lagi."));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSelesai && !resolvedLokasi) {
      setFormError("Isi lokasi terlebih dahulu.");
      return;
    }
    if (isSelesai && !namaPenerima.trim()) {
      setFormError("Isi nama penerima barang terlebih dahulu.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const data: TrackingUpdateFormData = {
      awb: shipment!.awb,
      type,
      lokasi: resolvedLokasi,
      tanggal,
      jam,
      keterangan,
      // Order matters here: addTrackingUpdate takes foto[0] as bukti barang
      // diterima and foto[1] (falling back to foto[0]) as bukti surat
      // jalan - keep these two labeled uploads in that exact order.
      foto: isSelesai
        ? [fotoBarangDiterima, fotoSuratJalan].filter((f): f is string => !!f)
        : foto,
      // Only actually submit truckId when it changed from the shipment's
      // current unit - the field is pre-filled with the current value on
      // every load, and sending it unchanged on an ordinary status update
      // would otherwise look like (and for Driver/Mitra, be rejected as) a
      // reassignment attempt.
      truckId: truckId && truckId !== shipment!.truckId ? truckId : undefined,
      namaPenerima: isSelesai ? namaPenerima.trim() : undefined,
    };
    const result = await addTrackingUpdate(data);
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
      setTimeout(() => navigate(`/tracking/${shipment!.awb}`), 1100);
    } else {
      setFormError(result.error);
    }
  }

  return (
    <AdminLayout>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> Kembali
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Update Tracking</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{shipment.awb}</p>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      {shipment.status === "Hold" && (
        <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          Pengiriman ini sedang di-Hold, jadi belum bisa diproses atau diberi update tracking. Pembuat order dapat memilih Lepas Hold dari halaman detail resi.
        </div>
      )}
      {!locked && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          {canEditInfo ? (
            <button
              type="button"
              onClick={() => setEditInfoOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
            >
              <span className="flex items-center gap-2">
                <Pencil size={16} className="text-blue-900" />
                <span className="text-sm font-semibold text-slate-800">Data Pengiriman</span>
                <span className="hidden text-xs text-slate-400 sm:inline">(Pengirim, Penerima, Rute, Layanan)</span>
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-slate-400 transition-transform ${editInfoOpen ? "rotate-180" : ""}`}
              />
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <span className="flex items-center gap-2">
                <MapPin size={16} className="text-blue-900" />
                <span className="text-sm font-semibold text-slate-800">Data Pengiriman</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">Hanya lihat</span>
            </div>
          )}

          {!canEditInfo && (
            <div className="grid grid-cols-1 gap-5 border-t border-slate-100 px-5 py-4 text-sm sm:grid-cols-2 sm:px-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pengirim</p>
                <p className="mt-0.5 font-medium text-slate-800">{shipment.pengirim.nama}</p>
                <p className="text-xs text-slate-500">{shipment.pengirim.telepon}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Penerima</p>
                <p className="mt-0.5 font-medium text-slate-800">{shipment.penerima.nama}</p>
                <p className="text-xs text-slate-500">{shipment.penerima.telepon}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Alamat Asal</p>
                <p className="mt-0.5 font-medium text-slate-800">{shipment.kotaAsal}</p>
                <p className="text-xs text-slate-500">{shipment.alamatAsal}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Alamat Tujuan</p>
                <p className="mt-0.5 font-medium text-slate-800">{shipment.kotaTujuan}</p>
                <p className="text-xs text-slate-500">{shipment.alamatTujuan}</p>
              </div>
            </div>
          )}

          {canEditInfo && !editInfoOpen && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 px-5 py-4 text-sm sm:grid-cols-3 sm:px-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pengirim</p>
                <p className="mt-0.5 font-medium text-slate-800">{shipment.pengirim.nama}</p>
                <p className="text-xs text-slate-500">{shipment.pengirim.telepon}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Penerima</p>
                <p className="mt-0.5 font-medium text-slate-800">{shipment.penerima.nama}</p>
                <p className="text-xs text-slate-500">{shipment.penerima.telepon}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Rute</p>
                <p className="mt-0.5 font-medium text-slate-800">
                  {shipment.kotaAsal} &rarr; {shipment.kotaTujuan}
                </p>
              </div>
            </div>
          )}

          {canEditInfo && editInfoOpen && (
            <form onSubmit={handleSaveInfo} className="border-t border-slate-100 px-5 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <User size={13} /> Pengirim
                  </p>
                  <div className="flex flex-col gap-3">
                    <input
                      required
                      className={inputClass}
                      placeholder="Nama lengkap"
                      value={editPengirim.nama}
                      onChange={(e) => setEditPengirim((p) => ({ ...p, nama: e.target.value }))}
                    />
                    <input
                      required
                      className={inputClass}
                      placeholder="08xx-xxxx-xxxx"
                      value={editPengirim.telepon}
                      onChange={(e) => setEditPengirim((p) => ({ ...p, telepon: e.target.value }))}
                    />
                    <input
                      required
                      type="email"
                      className={inputClass}
                      placeholder="nama@email.com"
                      value={editPengirim.email}
                      onChange={(e) => setEditPengirim((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <User size={13} /> Penerima
                  </p>
                  <div className="flex flex-col gap-3">
                    <input
                      required
                      className={inputClass}
                      placeholder="Nama lengkap"
                      value={editPenerima.nama}
                      onChange={(e) => setEditPenerima((p) => ({ ...p, nama: e.target.value }))}
                    />
                    <input
                      required
                      className={inputClass}
                      placeholder="08xx-xxxx-xxxx"
                      value={editPenerima.telepon}
                      onChange={(e) => setEditPenerima((p) => ({ ...p, telepon: e.target.value }))}
                    />
                    <input
                      required
                      type="email"
                      className={inputClass}
                      placeholder="nama@email.com"
                      value={editPenerima.email}
                      onChange={(e) => setEditPenerima((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <MapPin size={13} /> Rute
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Kota Asal</span>
                    <SearchableSelect
                      options={kotaAsalOptions}
                      onSearch={setKotaAsalQuery}
                      value={editKotaAsal}
                      onChange={setEditKotaAsal}
                      placeholder="Pilih kota asal"
                      emptyLabel="Kota tidak ditemukan."
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Kota Tujuan</span>
                    <SearchableSelect
                      options={kotaTujuanOptions}
                      onSearch={setKotaTujuanQuery}
                      value={editKotaTujuan}
                      onChange={setEditKotaTujuan}
                      placeholder="Pilih kota tujuan"
                      emptyLabel="Kota tidak ditemukan."
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Alamat Asal</span>
                    <input
                      required
                      className={inputClass}
                      placeholder="Jl. Raya ... No. ..."
                      value={editAlamatAsal}
                      onChange={(e) => setEditAlamatAsal(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Alamat Tujuan</span>
                    <input
                      required
                      className={inputClass}
                      placeholder="Jl. Raya ... No. ..."
                      value={editAlamatTujuan}
                      onChange={(e) => setEditAlamatTujuan(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Layanan</span>
                    <select className={inputClass} value={editLayanan} onChange={(e) => setEditLayanan(e.target.value)}>
                      {/* An order's current layanan stays visible even if it was
                          deactivated later; every other choice is an active
                          Master Layanan entry. */}
                      {!activeLayanan.includes(shipment.layanan) && (
                        <option value={shipment.layanan}>{shipment.layanan} (nonaktif)</option>
                      )}
                      {activeLayanan.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Target Pengiriman (Hari)</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={inputClass}
                      placeholder="Contoh: 3 (opsional)"
                      value={editSlaValue ?? ""}
                      onChange={(e) => setEditSlaValue(e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      {editSlaValue && editSlaValue > 0
                        ? `Estimasi Tiba: ${formatTanggalPanjang(addBusinessDays(shipment.tanggalDibuat, editSlaValue))}`
                        : "Kosongkan untuk menghapus ETA/Estimasi Tiba."}
                    </p>
                  </label>
                </div>
              </div>

              {editFormError && (
                <p className="mt-4 text-sm font-medium text-red-600">{editFormError}</p>
              )}
              {editSaved && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={16} /> Perubahan disimpan.
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                >
                  <Save size={15} /> Simpan Perubahan
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {locked ? (
        <>
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={28} />
            <p className="font-semibold text-emerald-800">Pengiriman ini sudah Selesai/Terkirim</p>
            <p className="mt-1 text-sm text-emerald-700">
              Sesuai kebijakan (FR-17), riwayat pengiriman yang sudah closing dikunci dan tidak dapat
              diubah lagi untuk menjaga validitas data.
            </p>
            <Link
              to={`/tracking/${shipment.awb}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <MapPin size={15} /> Lihat Tracking
            </Link>
          </div>

          {shipment.pod && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <ImagePlus size={16} className="text-blue-900" /> Foto Bukti Serah Terima
              </p>
              {canEditPodPhoto ? (
                <p className="mb-4 text-xs text-slate-500">
                  Bisa diganti dalam 30 hari sejak pengiriman selesai
                  {deliveredAtLabel && (
                    <>
                      {" "}
                      (<span className="font-medium text-slate-700">{deliveredAtLabel}</span>)
                    </>
                  )}
                  . Sisa waktu: <span className="font-medium text-slate-700">{podEditDaysLeft} hari</span>.
                </p>
              ) : (
                <p className="mb-4 text-xs text-slate-500">
                  Batas waktu 30 hari untuk mengganti foto sudah lewat
                  {deliveredAtLabel && (
                    <>
                      {" "}
                      (paket diterima pada{" "}
                      <span className="font-medium text-slate-700">{deliveredAtLabel}</span>)
                    </>
                  )}
                  .
                </p>
              )}

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-600">Foto Barang Diterima</p>
                  <div className="flex flex-wrap items-center gap-4">
                    {shipment.pod.fotoBarang ? (
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                        <img
                          src={shipment.pod.fotoBarang}
                          alt="Foto barang diterima"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-[10px] text-slate-400">
                        Belum ada foto
                      </div>
                    )}
                    {canEditPodPhoto && <PhotoPickerBox onChange={handlePodPhotoChange("barang")} />}
                  </div>
                  {podBarangError && <p className="mt-3 text-xs font-medium text-red-600">{podBarangError}</p>}
                  {podBarangSaved && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 size={16} /> Foto berhasil diperbarui.
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-600">Foto Surat Jalan</p>
                  <div className="flex flex-wrap items-center gap-4">
                    {shipment.pod.fotoSuratJalan ? (
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                        <img
                          src={shipment.pod.fotoSuratJalan}
                          alt="Foto surat jalan"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-[10px] text-slate-400">
                        Belum ada foto
                      </div>
                    )}
                    {canEditPodPhoto && <PhotoPickerBox onChange={handlePodPhotoChange("suratJalan")} />}
                  </div>
                  {podSuratJalanError && <p className="mt-3 text-xs font-medium text-red-600">{podSuratJalanError}</p>}
                  {podSuratJalanSaved && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 size={16} /> Foto berhasil diperbarui.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : submitted ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={28} />
          <p className="font-semibold text-emerald-800">Update tracking berhasil disimpan</p>
          <p className="mt-1 text-sm text-emerald-700">Mengarahkan ke halaman tracking publik...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Status</span>
              <select
                className={inputClass}
                value={type}
                onChange={(e) => setType(e.target.value as TimelineEventType)}
              >
                {allowedOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-[11px] text-slate-400">
                Hanya status lanjutan dari status saat ini ({shipment.status}) yang bisa dipilih -
                pipeline tidak bisa dibuat mundur.
              </span>
            </label>
            {isSelesai ? (
              <div className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Lokasi</span>
                <div className={`${inputClass} bg-slate-50 text-slate-600`}>{shipment.kotaTujuan}</div>
                <span className="mt-1.5 block text-[11px] text-slate-400">
                  Otomatis memakai kota tujuan pengiriman, tidak perlu diisi ulang.
                </span>
              </div>
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Lokasi (Nama Area)</span>
                <LocationTextInput
                  id="update-tracking-lokasi"
                  required
                  className={inputClass}
                  value={lokasi}
                  onChange={setLokasi}
                  kind="area"
                  placeholder="Pilih / ketik Nama Area, contoh: Semarang Barat"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Tanggal</span>
              <input
                required
                type="date"
                className={inputClass}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Jam</span>
              <input
                required
                type="time"
                className={inputClass}
                value={jam}
                onChange={(e) => setJam(e.target.value)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Keterangan</span>
              <textarea
                required
                rows={3}
                className={inputClass}
                placeholder="Keterangan status perjalanan"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </label>

            {isSelesai && (
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Nama Penerima (Diterima oleh)
                </span>
                <input
                  required
                  className={inputClass}
                  placeholder="Nama orang yang menerima/menandatangani barang"
                  value={namaPenerima}
                  onChange={(e) => setNamaPenerima(e.target.value)}
                />
                <span className="mt-1.5 block text-[11px] text-slate-400">
                  Default terisi nama penerima ({shipment.penerima.nama}), ubah jika barang diterima
                  oleh orang lain (misalnya rekan kerja atau satpam).
                </span>
              </label>
            )}

            {isSelesai ? (
              <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Foto Barang Diterima</span>
                  <span className="mb-1.5 block text-[11px] text-slate-400">
                    Kondisi barang saat diterima di lokasi tujuan.
                  </span>
                  {fotoBarangDiterima ? (
                    <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
                      <img src={fotoBarangDiterima} alt="Foto barang diterima" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFotoBarangDiterima(null)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <PhotoPickerBox onChange={handleFotoBarangDiterimaChange} />
                  )}
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Foto Surat Jalan</span>
                  <span className="mb-1.5 block text-[11px] text-slate-400">
                    Surat jalan yang ditandatangani/dicap penerima.
                  </span>
                  {fotoSuratJalan ? (
                    <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
                      <img src={fotoSuratJalan} alt="Foto surat jalan" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFotoSuratJalan(null)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <PhotoPickerBox onChange={handleFotoSuratJalanChange} />
                  )}
                </div>
                {photoError && <p className="text-xs font-medium text-red-600 sm:col-span-2">{photoError}</p>}
              </div>
            ) : (
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Foto</span>
                <div className="flex flex-wrap items-center gap-3">
                  <PhotoPickerBox onChange={handlePhotoChange} size="sm" multiple />
                  {foto.map((src, i) => (
                    <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                      <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFoto((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
                {photoError && <p className="mt-1.5 text-xs font-medium text-red-600">{photoError}</p>}
              </div>
            )}

            <div className="sm:col-span-2 border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Informasi Truck {type === "Transfer Unit" && "(Unit Baru)"}
              </p>
            </div>
            {isMitra ? (
              <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 px-3.5 py-3 text-sm">
                <span className="font-medium text-slate-700">{shipment.truck.nomorUnit}</span>
                <span className="text-slate-500">{shipment.truck.jenis}</span>
                {shipment.truck.driver && <span className="text-slate-500">Driver: {shipment.truck.driver}</span>}
              </div>
            ) : (
              <>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Pilih Unit Truck</span>
                  <SearchableSelect
                    options={truckOptions}
                    value={truckId}
                    onChange={setTruckId}
                    placeholder="Pilih Unit Truck"
                    emptyLabel="Tidak ada unit truck."
                  />
                </label>
                {selectedTruck && (
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 px-3.5 py-3 text-sm">
                    <span className="font-medium text-slate-700">{selectedTruck.nomorUnit}</span>
                    <span className="text-slate-500">{selectedTruck.jenis}</span>
                    <span className="text-slate-500">Driver: {selectedTruck.driver?.nama ?? "-"}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {type === "Transfer Unit" && (
            <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700">
              Unit sebelumnya ({shipment.truck.nomorUnit}) akan otomatis tercatat sebagai unit yang
              digantikan pada timeline publik.
            </p>
          )}

          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Update ini akan langsung muncul di halaman tracking publik:{" "}
            <span className="font-medium text-slate-700">
              {formatTanggalPanjang(tanggal)} · {jam} WIB
            </span>
          </div>

          <div className="mt-5 flex flex-col items-end gap-2.5">
            {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
            >
              <Send size={15} /> Simpan Update
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
