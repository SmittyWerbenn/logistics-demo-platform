import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Package,
  Table,
  Truck,
  User,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { BulkShipmentImport } from "../../components/BulkShipmentImport";
import { PhotoPickerBox } from "../../components/PhotoPickerBox";
import { QRCode } from "../../components/QRCode";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useAuth } from "../../store/AuthContext";
import { useFleet } from "../../store/FleetContext";
import { useLayanan } from "../../store/LayananContext";
import { useLocationSuggest } from "../../utils/useLocationSuggest";
import { useSettings } from "../../store/SettingsContext";
import { useShipments } from "../../store/ShipmentContext";
import type { ShipmentFormData } from "../../types";
import { api, ApiError } from "../../utils/apiClient";
import { checkPhotoSize, compressImage } from "../../utils/compressImage";
import { formatTanggalPanjang, todayISO } from "../../utils/format";
import { sendTrackingEmail, type EmailableShipment } from "../../utils/sendEmail";
import { addBusinessDays } from "../../utils/sla";
import { adminPath, trackingUrl as publicTrackingUrl } from "../../utils/urls";

const emptyForm: ShipmentFormData = {
  pengirim: { nama: "", telepon: "", email: "" },
  penerima: { nama: "", telepon: "", email: "" },
  alamatAsal: "",
  kotaAsal: "",
  alamatTujuan: "",
  kotaTujuan: "",
  deskripsiBarang: "",
  // Filled from Master Layanan once it has loaded (see the effect below).
  layanan: "",
  beratKg: 0,
  jumlahKoli: 1,
  fotoBarang: undefined,
  fotoSuratJalan: undefined,
  truckId: "",
  customerId: "",
  reference: "",
  asuransi: false,
  koliAsuransi: "",
  nilaiAsuransi: undefined,
};

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={17} className="text-blue-900" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function CreateShipment() {
  const { createShipment, markEmailSent } = useShipments();
  const { trucksWithDriver } = useFleet();
  const { activeNames: layananOptions, refresh: refreshLayanan } = useLayanan();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isCustAdmin = profile?.role === "Client";

  const [mode, setMode] = useState<"single" | "bulk">("bulk");
  const [form, setForm] = useState<ShipmentFormData>(() => ({
    ...emptyForm,
    customerId: isCustAdmin ? profile?.customerId ?? "" : "",
  }));
  const [customerIds, setCustomerIds] = useState<string[]>([]);

  // Always show the latest Master Layanan when the form opens, then make
  // sure the selected value is one of the active entries (Regular when it's
  // available, as before; otherwise the first active one).
  useEffect(() => {
    refreshLayanan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (layananOptions.length === 0) return;
    setForm((prev) =>
      layananOptions.includes(prev.layanan)
        ? prev
        : { ...prev, layanan: layananOptions.includes("Regular") ? "Regular" : layananOptions[0] },
    );
  }, [layananOptions]);

  useEffect(() => {
    if (isCustAdmin) return;
    api
      .get<{ items: string[] }>("/api/customer-ids")
      .then((res) => setCustomerIds(res.items))
      .catch(() => setCustomerIds([]));
  }, [isCustAdmin]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuratJalanError, setPhotoSuratJalanError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<EmailableShipment | null>(null);
  const [layananNote, setLayananNote] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  function update<K extends keyof ShipmentFormData>(key: K, value: ShipmentFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkPhotoSize(file);
    if (sizeError) {
      setPhotoError(sizeError);
      return;
    }
    setPhotoError(null);
    compressImage(file)
      .then((dataUrl) => update("fotoBarang", dataUrl))
      .catch(() => setPhotoError("Gagal memproses foto. Coba foto lain."));
  }

  function handleFotoSuratJalanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkPhotoSize(file);
    if (sizeError) {
      setPhotoSuratJalanError(sizeError);
      return;
    }
    setPhotoSuratJalanError(null);
    compressImage(file)
      .then((dataUrl) => update("fotoSuratJalan", dataUrl))
      .catch(() => setPhotoSuratJalanError("Gagal memproses foto. Coba foto lain."));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.kotaAsal || !form.kotaTujuan) {
      setFormError("Pilih kota asal dan kota tujuan terlebih dahulu.");
      return;
    }
    if (!form.beratKg || form.beratKg <= 0) {
      setFormError("Masukkan Berat Final (Kg) yang valid.");
      return;
    }
    if (!form.jumlahKoli || form.jumlahKoli <= 0) {
      setFormError("Masukkan jumlah koli yang valid.");
      return;
    }
    if (!form.customerId?.trim()) {
      setFormError("Client ID wajib diisi.");
      return;
    }
    if (form.hold && !form.holdReason?.trim()) {
      setFormError("Alasan Hold wajib diisi.");
      return;
    }
    if (form.asuransi) {
      if (!(form.koliAsuransi ?? "").trim()) {
        setFormError("Nomor koli yang diasuransikan wajib diisi.");
        return;
      }
      if (!form.nilaiAsuransi || form.nilaiAsuransi <= 0) {
        setFormError("Nilai barang yang diasuransikan wajib diisi dan lebih dari 0.");
        return;
      }
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const { awb, layanan, layananFallback } = await createShipment(form);
      setLayananNote(
        layananFallback
          ? `Layanan "${form.layanan}" tidak tersedia di Master Layanan, jadi otomatis memakai ${layanan ?? "LTL"}. Anda bisa mengubahnya lewat Edit Info Pengiriman.`
          : null,
      );
      setCreated({
        awb,
        kotaAsal: form.kotaAsal,
        kotaTujuan: form.kotaTujuan,
        status: form.hold ? "Hold" : "Dalam Persiapan",
        tanggalDibuat: todayISO(),
        pengirim: form.pengirim,
        penerima: form.penerima,
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal membuat pengiriman. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendEmail() {
    if (!created) return;
    if (!settings.emailSendingEnabled) {
      setEmailError("Pengiriman email sedang dinonaktifkan. Aktifkan di Admin > Pengaturan.");
      return;
    }
    setEmailSending(true);
    setEmailError(null);

    const targets: Array<"penerima" | "pengirim"> = ["penerima", "pengirim"];
    const results = await Promise.all(targets.map((role) => sendTrackingEmail(created, trackingUrl, role)));
    setEmailSending(false);

    const failed = results.find((r) => !r.ok);
    if (!failed) {
      markEmailSent(created.awb);
      setEmailSent(true);
    } else {
      setEmailError(failed.error ?? "Gagal mengirim email.");
    }
  }

  const trackingUrl = created ? publicTrackingUrl(created.awb) : "";

  const truckOptions = trucksWithDriver
    .filter((t) => t.status !== "Inactive")
    .map((t) => ({
      value: t.id,
      label: `${t.nomorUnit} - ${t.jenis}`,
      description: t.driver ? `Driver: ${t.driver.nama}` : undefined,
    }));
  const kotaAsalSuggestions = useLocationSuggest("kota", form.kotaAsal);
  const kotaTujuanSuggestions = useLocationSuggest("kota", form.kotaTujuan);
  const selectedTruck = trucksWithDriver.find((t) => t.id === form.truckId);

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
          <h1 className="text-2xl font-semibold text-slate-900">Buat Pengiriman</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "single"
              ? "Isi data pengirim, penerima, dan informasi pengiriman untuk menerbitkan resi (AWB) baru."
              : "Buat banyak resi sekaligus dengan mengisi tabel atau mengimpor file Excel/CSV."}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === "single" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Package size={13} />
            Satu Pengiriman
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === "bulk" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Table size={13} />
            Bulk / Import Excel
          </button>
        </div>
      </div>

      {mode === "bulk" && (
        <div className="mt-6">
          <BulkShipmentImport />
        </div>
      )}

      {mode === "single" && (
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <Section title="Data Pengirim" icon={User}>
          <Field label="Nama Pengirim">
            <input
              required
              className={inputClass}
              placeholder="Nama lengkap"
              value={form.pengirim.nama}
              onChange={(e) => update("pengirim", { ...form.pengirim, nama: e.target.value })}
            />
          </Field>
          <Field label="Nomor HP">
            <input
              required
              className={inputClass}
              placeholder="08xx-xxxx-xxxx"
              value={form.pengirim.telepon}
              onChange={(e) => update("pengirim", { ...form.pengirim, telepon: e.target.value })}
            />
          </Field>
          <Field label="Email" full>
            <input
              required
              type="email"
              className={inputClass}
              placeholder="nama@email.com"
              value={form.pengirim.email}
              onChange={(e) => update("pengirim", { ...form.pengirim, email: e.target.value })}
            />
          </Field>
        </Section>

        <Section title="Data Penerima" icon={User}>
          <Field label="Nama Penerima">
            <input
              required
              className={inputClass}
              placeholder="Nama lengkap"
              value={form.penerima.nama}
              onChange={(e) => update("penerima", { ...form.penerima, nama: e.target.value })}
            />
          </Field>
          <Field label="Nomor HP">
            <input
              required
              className={inputClass}
              placeholder="08xx-xxxx-xxxx"
              value={form.penerima.telepon}
              onChange={(e) => update("penerima", { ...form.penerima, telepon: e.target.value })}
            />
          </Field>
          <Field label="Email" full>
            <input
              required
              type="email"
              className={inputClass}
              placeholder="nama@email.com (penerima notifikasi resi)"
              value={form.penerima.email}
              onChange={(e) => update("penerima", { ...form.penerima, email: e.target.value })}
            />
          </Field>
        </Section>

        <Section title="Pengiriman" icon={MapPin}>
          <Field label="Kota Asal">
            <input
              required
              list="kota-asal-suggestions"
              className={inputClass}
              placeholder="Ketik nama kota asal"
              value={form.kotaAsal}
              onChange={(e) => update("kotaAsal", e.target.value)}
              autoComplete="off"
            />
            <datalist id="kota-asal-suggestions">
              {kotaAsalSuggestions.map((k) => (
                <option key={k.nama} value={k.nama} />
              ))}
            </datalist>
          </Field>
          <Field label="Kota Tujuan">
            <input
              required
              list="kota-tujuan-suggestions"
              className={inputClass}
              placeholder="Ketik nama kota tujuan"
              value={form.kotaTujuan}
              onChange={(e) => update("kotaTujuan", e.target.value)}
              autoComplete="off"
            />
            <datalist id="kota-tujuan-suggestions">
              {kotaTujuanSuggestions.map((k) => (
                <option key={k.nama} value={k.nama} />
              ))}
            </datalist>
          </Field>
          <Field label="Alamat Asal" full>
            <input
              required
              className={inputClass}
              placeholder="Jl. Raya ... No. ..."
              value={form.alamatAsal}
              onChange={(e) => update("alamatAsal", e.target.value)}
            />
          </Field>
          <Field label="Alamat Tujuan" full>
            <input
              required
              className={inputClass}
              placeholder="Jl. Raya ... No. ..."
              value={form.alamatTujuan}
              onChange={(e) => update("alamatTujuan", e.target.value)}
            />
          </Field>
          <Field label="Layanan">
            <select
              className={inputClass}
              value={form.layanan}
              onChange={(e) => update("layanan", e.target.value)}
            >
              {layananOptions.length === 0 && <option value="">Memuat layanan...</option>}
              {layananOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Client ID">
            <input
              required
              disabled={isCustAdmin}
              list="customer-id-suggestions"
              className={`${inputClass} ${isCustAdmin ? "bg-slate-50 text-slate-500" : ""}`}
              placeholder="Contoh: IDTMDI001"
              value={form.customerId ?? ""}
              onChange={(e) => update("customerId", e.target.value)}
              autoComplete="off"
            />
            <datalist id="customer-id-suggestions">
              {customerIds.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {isCustAdmin && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Terkunci ke Client ID akun Anda.
              </p>
            )}
          </Field>
          <Field label="Berat Final (Kg)">
            <input
              required
              type="number"
              min={0.1}
              step={0.1}
              className={inputClass}
              placeholder="Contoh: 85"
              value={form.beratKg || ""}
              onChange={(e) => update("beratKg", Number(e.target.value))}
            />
          </Field>
          <Field label="Jumlah Koli">
            <input
              required
              type="number"
              min={1}
              step={1}
              className={inputClass}
              placeholder="Contoh: 3"
              value={form.jumlahKoli || ""}
              onChange={(e) => update("jumlahKoli", Number(e.target.value))}
            />
          </Field>
          <Field label="Target Pengiriman (Hari)">
            <input
              type="number"
              min={1}
              step={1}
              className={inputClass}
              placeholder="Contoh: 3 (opsional)"
              value={form.slaValue ?? ""}
              onChange={(e) => update("slaValue", e.target.value === "" ? undefined : Number(e.target.value))}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              {form.slaValue && form.slaValue > 0
                ? `Estimasi Tiba: ${formatTanggalPanjang(addBusinessDays(todayISO(), form.slaValue))}`
                : "Opsional. Jika diisi, sistem menghitung Estimasi Tiba otomatis dan menampilkannya ke customer."}
            </p>
          </Field>
          <Field label="Referensi (Opsional)" full>
            <input
              className={inputClass}
              maxLength={100}
              placeholder="Nomor order Anda, contoh: ORD-001"
              value={form.reference ?? ""}
              onChange={(e) => update("reference", e.target.value)}
              autoComplete="off"
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              Pengenal order dari sisi Anda. Referensi yang sama tidak bisa dipakai dua kali, sehingga satu order tidak pernah mendapat dua AWB.
            </p>
          </Field>
          <Field label="Deskripsi Barang" full>
            <textarea
              required
              rows={3}
              className={inputClass}
              placeholder="Contoh: Spare part mesin, 3 dus (85kg)"
              value={form.deskripsiBarang}
              onChange={(e) => update("deskripsiBarang", e.target.value)}
            />
          </Field>
          <Field label="Status Awal" full>
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-orange-600"
                checked={!!form.hold}
                onChange={(e) => update("hold", e.target.checked)}
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">Hold Pengiriman</span>
                <span className="block text-xs text-slate-500">
                  AWB tetap diterbitkan (mis. untuk penagihan), tetapi order belum masuk ke proses Driver sampai Anda memilih Lepas Hold.
                </span>
              </span>
            </div>
            {form.hold && (
              <textarea
                required
                rows={2}
                maxLength={500}
                className={`${inputClass} mt-2`}
                placeholder="Alasan Hold, contoh: Menunggu pembayaran dari pembeli."
                value={form.holdReason ?? ""}
                onChange={(e) => update("holdReason", e.target.value)}
              />
            )}
          </Field>
          <Field label="Asuransi Barang" full>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600"
                  checked={!!form.asuransi}
                  onChange={(e) => {
                    update("asuransi", e.target.checked);
                    if (!e.target.checked) {
                      update("koliAsuransi", "");
                      update("nilaiAsuransi", undefined);
                    }
                  }}
                />
                <span className="text-sm text-slate-700">
                  <span className="font-medium">Asuransi Pengiriman</span>
                  <span className="block text-xs text-slate-500">
                    Centang jika barang ini diasuransikan. Pilih koli yang diasuransikan dan isi nilai barang.
                  </span>
                </span>
                </div>
              {form.asuransi && (
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  <Field label="Nomor Koli yang Diasuransikan">
                    <input
                      required={form.asuransi}
                      className={inputClass}
                      placeholder="Contoh: 62001, 62002"
                      value={form.koliAsuransi ?? ""}
                      onChange={(e) => update("koliAsuransi", e.target.value)}
                    />
                  </Field>
                  <p className="-mt-1 text-[11px] text-slate-400">
                    Isi nomor koli yang diasuransikan, dipisah koma.
                  </p>
                  <Field label="Nilai Barang yang Diasuransikan (Rp)">
                    <input
                      type="text"
                      inputMode="numeric"
                      className={inputClass}
                      placeholder="Contoh: 1,000,000"
                      value={form.nilaiAsuransi ? Number(form.nilaiAsuransi).toLocaleString("en-US") : ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        update("nilaiAsuransi", digits ? Number(digits) : undefined);
                      }}
                    />
                  </Field>
                </div>
              )}
            </div>
          </Field>
          <Field label="Foto Barang" full>
            <div className="flex items-center gap-3">
              <PhotoPickerBox onChange={handlePhotoChange} />
              {form.fotoBarang && (
                <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
                  <img src={form.fotoBarang} alt="Preview barang" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => update("fotoBarang", undefined)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-400">
                Opsional. Foto kondisi fisik barang yang dikirim. Jika tidak diunggah, sistem akan menggunakan foto
                contoh.
              </p>
            </div>
            {photoError && <p className="mt-1.5 text-xs font-medium text-red-600">{photoError}</p>}
          </Field>
          <Field label="Foto Surat Jalan" full>
            <div className="flex items-center gap-3">
              <PhotoPickerBox onChange={handleFotoSuratJalanChange} />
              {form.fotoSuratJalan && (
                <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
                  <img src={form.fotoSuratJalan} alt="Preview surat jalan" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => update("fotoSuratJalan", undefined)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-400">
                Opsional. Foto dokumen surat jalan/pengantar yang menyertai barang saat berangkat.
              </p>
            </div>
            {photoSuratJalanError && <p className="mt-1.5 text-xs font-medium text-red-600">{photoSuratJalanError}</p>}
          </Field>
        </Section>

        <Section title="Informasi Truck" icon={Truck}>
          <Field label="Pilih Unit Truck" full>
            <SearchableSelect
              options={truckOptions}
              value={form.truckId ?? ""}
              onChange={(v) => update("truckId", v)}
              placeholder="Pilih Unit Truck (opsional)"
              emptyLabel={isCustAdmin ? "Belum ada armada dedicated untuk Anda." : "Tidak ada unit truck yang tersedia."}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              {isCustAdmin
                ? "Opsional. Hanya armada dedicated yang ditugaskan GMS untuk Anda yang bisa dipilih."
                : `Opsional. Kosongkan supaya pengiriman ini masuk ke daftar "Pesanan Terbuka" - semua driver
              bisa melihat dan mengajukan klaim, lalu Anda tinggal konfirmasi siapa yang mengambilnya.`}
            </p>
          </Field>
          {selectedTruck ? (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 px-3.5 py-3 text-sm">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Truck size={15} className="text-slate-400" />
                <span className="font-medium">{selectedTruck.nomorUnit}</span>
                <span className="text-slate-400">- {selectedTruck.jenis}</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <User size={15} className="text-slate-400" />
                Driver: <span className="font-medium">{selectedTruck.driver?.nama ?? "-"}</span>
              </span>
              <span className="text-xs text-slate-400">{selectedTruck.driver?.telepon}</span>
            </div>
          ) : (
            <p className="sm:col-span-2 text-xs text-slate-400">
              Belum ada unit dipilih. Kelola daftar armada di{" "}
              <Link to={adminPath("/armada")} className="text-blue-700 hover:underline">
                Master Armada
              </Link>
              .
            </p>
          )}
        </Section>

        <div className="flex flex-col items-end gap-2.5">
          {formError && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <AlertTriangle size={14} /> {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <Package size={17} />}
            {submitting ? "Menerbitkan Resi..." : "Terbitkan Resi"}
          </button>
        </div>
      </form>
      )}

      {/* Success modal */}
      {created && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex flex-col items-center gap-2 border-b border-slate-100 px-6 pb-5 pt-7 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={30} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Resi Berhasil Dibuat</h2>
              <p className="text-sm text-slate-500">
                AWB baru telah diterbitkan dan tersimpan dalam sistem.
              </p>
              {layananNote && (
                <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{layananNote}</p>
              )}
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-slate-50 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Nomor AWB
                </p>
                <p className="font-mono text-2xl font-bold tracking-tight text-blue-900">
                  {created.awb}
                </p>
                <QRCode data={trackingUrl} size={140} />
                <p className="max-w-xs break-all text-center text-[11px] text-slate-400">
                  {trackingUrl}
                </p>
              </div>

              {!emailSent && (
                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
                  <Mail size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    Resi akan dikirim ke email penerima{" "}
                    <span className="font-medium text-slate-800">({created.penerima.email})</span> dan pengirim{" "}
                    <span className="font-medium text-slate-800">({created.pengirim.email})</span>.
                  </span>
                </div>
              )}

              {emailSent && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={16} />
                  {`Email berhasil dikirim ke penerima (${created.penerima.email}) dan pengirim (${created.pengirim.email})`}
                </div>
              )}
              {emailError && (
                <div className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle size={16} />
                    Gagal mengirim email
                  </div>
                  <p className="mt-1 break-words text-xs text-red-600">{emailError}</p>
                </div>
              )}
              {!settings.emailSendingEnabled && !emailSent && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                  <AlertTriangle size={16} />
                  Pengiriman email sedang dinonaktifkan. Aktifkan di Admin &gt; Pengaturan.
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  onClick={handleSendEmail}
                  disabled={emailSending || emailSent || !settings.emailSendingEnabled}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-60"
                >
                  {emailSending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Mail size={16} />
                  )}
                  {emailSent ? "Email Terkirim" : emailError ? "Coba Lagi" : "Kirim Email"}
                </button>
                <button
                  onClick={() => navigate(`/tracking/${created.awb}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <MapPin size={16} />
                  Lihat Tracking
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  onClick={() => navigate(adminPath(`/resi/${created.awb}`))}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Lihat Detail Resi
                </button>
                <button
                  onClick={() => navigate(adminPath(`/resi/${created.awb}/email`))}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Preview Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
