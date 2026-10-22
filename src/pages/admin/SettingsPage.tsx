import { CheckCircle2, Clock, Headset, LifeBuoy, Mail, MapPin, MessageCircle, Phone, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { useAuth } from "../../store/AuthContext";
import { useSettings } from "../../store/SettingsContext";
import { ApiError } from "../../utils/apiClient";
import { normalizeWhatsApp } from "../../utils/whatsapp";

/**
 * Konfigurasi Portal Admin - satu halaman, tiga menu di sidebar:
 *   KONFIGURASI > Tracking            -> section "tracking"  (ambang AWB macet + toggle email)
 *   KONFIGURASI > Informasi CS        -> section "cs"        (telepon, WhatsApp CS, email, alamat, jam operasional)
 *   KONFIGURASI > Informasi Bantuan   -> section "bantuan"   (WhatsApp Admin + WhatsApp Superadmin)
 *
 * Semua nilai disimpan lewat mekanisme existing (tabel `settings`, API PATCH /api/settings,
 * dimuat oleh SettingsContext) - backend tetap source of truth, tidak ada nilai yang
 * di-hardcode atau disimpan hanya di localStorage. Tidak ada konfigurasi duplikat: field
 * "AWB dianggap macet setelah (hari)" memakai `stagnantThresholdDays` yang sudah ada.
 *
 * Permission tidak berubah: halaman ini tetap hanya untuk Superadmin + Admin, dan
 * field informasi kontak tetap hanya bisa diubah Superadmin (ditegakkan di API).
 */
export type SettingsSection = "tracking" | "cs" | "bantuan";

const SECTION_META: Record<SettingsSection, { title: string; description: string }> = {
  tracking: {
    title: "Tracking",
    description: "Konfigurasi sistem tracking.",
  },
  cs: {
    title: "Informasi CS",
    description: "Informasi Customer Service yang tampil di halaman Kontak dan Company Profile (publik).",
  },
  bantuan: {
    title: "Informasi Bantuan",
    description: "Tujuan tombol bantuan di halaman login dan Portal Driver.",
  },
};

export default function SettingsPage({ section = "tracking" }: { section?: SettingsSection }) {
  const { profile } = useAuth();
  const isSuperadmin = profile?.role === "Superadmin";
  const { settings, setStagnantThresholdDays, setEmailSendingEnabled, setContactInfo } = useSettings();
  const [days, setDays] = useState(settings.stagnantThresholdDays);
  const [saved, setSaved] = useState(false);

  // Contact details shown on the public Contact page (/kontak).
  const [contact, setContact] = useState({
    helpPhoneNumber: settings.helpPhoneNumber,
    helpWhatsAppAdmin: settings.helpWhatsAppAdmin,
    helpWhatsAppSuperadmin: settings.helpWhatsAppSuperadmin,
    contactPhone: settings.contactPhone,
    contactEmail: settings.contactEmail,
    contactHours: settings.contactHours,
    headOffice: settings.headOffice,
  });
  const [contactSaved, setContactSaved] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSaving, setContactSaving] = useState(false);

  useEffect(() => {
    setDays(settings.stagnantThresholdDays);
  }, [settings.stagnantThresholdDays]);

  useEffect(() => {
    setContact({
      helpPhoneNumber: settings.helpPhoneNumber,
      helpWhatsAppAdmin: settings.helpWhatsAppAdmin,
      helpWhatsAppSuperadmin: settings.helpWhatsAppSuperadmin,
        contactPhone: settings.contactPhone,
        contactEmail: settings.contactEmail,
      contactHours: settings.contactHours,
      headOffice: settings.headOffice,
    });
  }, [settings.headOffice, settings.contactPhone, settings.helpPhoneNumber, settings.helpWhatsAppAdmin, settings.helpWhatsAppSuperadmin, settings.contactEmail, settings.contactHours]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStagnantThresholdDays(Math.max(1, days));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleContactSubmit(e: FormEvent) {
    e.preventDefault();
    setContactError(null);
    // Same rule as the API (which re-checks it): must be a usable WhatsApp
    // number; Admin / Superadmin may be left empty = "belum dikonfigurasi".
    // Only the fields visible in this section are validated here - the API
    // validates the full payload again, so nothing slips through.
    const invalid = [
      { label: "WhatsApp CS", value: contact.helpPhoneNumber, optional: false, section: "cs" as SettingsSection },
      { label: "WhatsApp Admin", value: contact.helpWhatsAppAdmin, optional: true, section: "bantuan" as SettingsSection },
      { label: "WhatsApp Superadmin", value: contact.helpWhatsAppSuperadmin, optional: true, section: "bantuan" as SettingsSection },
    ]
      .filter((f) => f.section === section)
      .find((f) => !(f.optional && f.value.trim() === "") && normalizeWhatsApp(f.value) === null);
    if (invalid) {
      setContactError(`${invalid.label} tidak valid. Gunakan format 08xxxxxxxxxx atau +628xxxxxxxxxx.`);
      return;
    }
    setContactSaving(true);
    try {
      await setContactInfo({
        helpPhoneNumber: contact.helpPhoneNumber.trim(),
        helpWhatsAppAdmin: contact.helpWhatsAppAdmin.trim(),
        helpWhatsAppSuperadmin: contact.helpWhatsAppSuperadmin.trim(),
        contactPhone: contact.contactPhone.trim(),
        contactEmail: contact.contactEmail.trim(),
        contactHours: contact.contactHours.trim(),
        headOffice: contact.headOffice.trim(),
      });
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2500);
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : "Gagal menyimpan informasi kontak. Coba lagi.");
    } finally {
      setContactSaving(false);
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";

  const meta = SECTION_META[section];

  return (
    <AdminLayout>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{meta.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
      </div>

      {section === "tracking" && (
        <>
          <form
            onSubmit={handleSubmit}
            className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <SettingsIcon size={17} className="text-blue-900" />
              <h2 className="text-sm font-semibold text-slate-800">Tracking</h2>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                AWB dianggap macet setelah (hari)
              </span>
              <input
                type="number"
                min={1}
                required
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <p className="mt-2 text-xs text-slate-400">
              AWB yang tidak mengalami perubahan status selama lebih dari jumlah hari ini akan muncul
              pada daftar "AWB Memerlukan Perhatian" di Dashboard.
            </p>

            {saved && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={15} />
                Pengaturan disimpan.
              </div>
            )}

            <button
              type="submit"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              Simpan Pengaturan
            </button>
          </form>

          <div className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Mail size={17} className="text-blue-900" />
              <h2 className="text-sm font-semibold text-slate-800">Pengiriman Email</h2>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-800">Kirim email notifikasi ke customer</p>
                <p className="mt-1 text-xs text-slate-400">
                  Matikan sementara untuk menghemat kuota SMTP. Saat nonaktif, tombol kirim email
                  (resi baru, kendala, selesai) tidak akan mengirim email sungguhan.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.emailSendingEnabled}
                onClick={() => setEmailSendingEnabled(!settings.emailSendingEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  settings.emailSendingEnabled ? "bg-blue-900" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.emailSendingEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div
              className={`mt-4 flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                settings.emailSendingEnabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              <CheckCircle2 size={15} />
              {settings.emailSendingEnabled ? "Pengiriman email aktif." : "Pengiriman email dinonaktifkan."}
            </div>
          </div>
        </>
      )}

      {section !== "tracking" && (
        <form
          onSubmit={handleContactSubmit}
          className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          {section === "cs" ? (
            <>
              <div className="mb-1 flex items-center gap-2">
                <Headset size={17} className="text-blue-900" />
                <h2 className="text-sm font-semibold text-slate-800">Informasi CS</h2>
              </div>
              <p className="mb-4 text-xs text-slate-400">
                Tampil di halaman Kontak dan Company Profile (publik). WhatsApp CS dipakai oleh tombol WhatsApp pada Compro.
              </p>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Phone size={13} className="text-slate-400" /> Telepon
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    disabled={!isSuperadmin}
                    value={contact.contactPhone}
                    onChange={(e) => setContact({ ...contact, contactPhone: e.target.value })}
                    placeholder="021-2200-8899"
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <MessageCircle size={13} className="text-slate-400" /> WhatsApp CS
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    disabled={!isSuperadmin}
                    value={contact.helpPhoneNumber}
                    onChange={(e) => setContact({ ...contact, helpPhoneNumber: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Mail size={13} className="text-slate-400" /> Email
                  </span>
                  <input
                    type="email"
                    required
                    maxLength={120}
                    disabled={!isSuperadmin}
                    value={contact.contactEmail}
                    onChange={(e) => setContact({ ...contact, contactEmail: e.target.value })}
                    placeholder="cs@gms-logistics.co.id"
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <MapPin size={13} className="text-slate-400" /> Alamat
                  </span>
                  <textarea
                    required
                    rows={2}
                    maxLength={300}
                    disabled={!isSuperadmin}
                    value={contact.headOffice}
                    onChange={(e) => setContact({ ...contact, headOffice: e.target.value })}
                    placeholder="Jl. Tambak Medokan Ayu A24 Gg. XI, Medokan Ayu, Kec. Rungkut, Surabaya"
                    className={`${fieldClass} resize-y`}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Clock size={13} className="text-slate-400" /> Jam Operasional
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    disabled={!isSuperadmin}
                    value={contact.contactHours}
                    onChange={(e) => setContact({ ...contact, contactHours: e.target.value })}
                    placeholder="Senin - Sabtu, 08.00 - 18.00 WIB"
                    className={fieldClass}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 flex items-center gap-2">
                <LifeBuoy size={17} className="text-blue-900" />
                <h2 className="text-sm font-semibold text-slate-800">Informasi Bantuan</h2>
              </div>
              <p className="mb-4 text-xs text-slate-400">
                Tujuan tombol bantuan di halaman login dan Portal Driver. Format: 08xxxxxxxxxx atau +628xxxxxxxxxx. Kosongkan
                jika belum ada; tombol akan memberi tahu bahwa nomor belum dikonfigurasi.
              </p>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <MessageCircle size={13} className="text-slate-400" /> WhatsApp Admin
                  </span>
                  <input
                    type="text"
                    maxLength={30}
                    disabled={!isSuperadmin}
                    value={contact.helpWhatsAppAdmin}
                    onChange={(e) => setContact({ ...contact, helpWhatsAppAdmin: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className={fieldClass}
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Lupa Password untuk Driver, Client, Viewer, dan Mitra, serta Hubungi Kendala untuk Driver.
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <MessageCircle size={13} className="text-slate-400" /> WhatsApp Superadmin
                  </span>
                  <input
                    type="text"
                    maxLength={30}
                    disabled={!isSuperadmin}
                    value={contact.helpWhatsAppSuperadmin}
                    onChange={(e) => setContact({ ...contact, helpWhatsAppSuperadmin: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className={fieldClass}
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">Lupa Password untuk akun GMS-Admin.</span>
                </label>
              </div>
            </>
          )}

          <p className="mt-3 text-xs text-slate-400">
            {isSuperadmin
              ? "Hanya Superadmin yang bisa mengubahnya, supaya tetap stabil walau ada pergantian Admin."
              : "Hanya Superadmin yang dapat mengubah informasi ini."}
          </p>

          {contactError && <p className="mt-3 text-sm font-medium text-red-600">{contactError}</p>}
          {contactSaved && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} />
              Informasi kontak disimpan.
            </div>
          )}

          {isSuperadmin && (
            <button
              type="submit"
              disabled={contactSaving}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
            >
              {contactSaving ? "Menyimpan..." : section === "cs" ? "Simpan Informasi CS" : "Simpan Informasi Bantuan"}
            </button>
          )}
        </form>
      )}
    </AdminLayout>
  );
}
