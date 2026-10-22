import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Mail, MapPin, RotateCw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import logoIcon from "../../assets/icon-mark.png";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { useSettings } from "../../store/SettingsContext";
import { useShipments } from "../../store/ShipmentContext";
import type { Shipment } from "../../types";
import { formatTanggalPanjang } from "../../utils/format";
import { sendTrackingEmail } from "../../utils/sendEmail";
import { adminPath, trackingUrl } from "../../utils/urls";

export default function EmailPreview() {
  const { awb } = useParams<{ awb: string }>();
  const { getByAwb, markEmailSent } = useShipments();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pengirimSending, setPengirimSending] = useState(false);
  const [pengirimSent, setPengirimSent] = useState(false);
  const [pengirimError, setPengirimError] = useState<string | null>(null);

  function trackingUrlFor(current: NonNullable<typeof shipment>) {
  return trackingUrl(current.awb);
  }

  async function handleSend(current: NonNullable<typeof shipment>) {
    if (!settings.emailSendingEnabled) {
      setSending(false);
      setError("Pengiriman email sedang dinonaktifkan. Aktifkan di Admin > Pengaturan.");
      return;
    }
    setSending(true);
    setError(null);
    const result = await sendTrackingEmail(current, trackingUrlFor(current), "penerima");
    setSending(false);
    if (result.ok) {
      markEmailSent(current.awb);
      setSent(true);
    } else {
      setError(result.error ?? "Gagal mengirim email.");
    }
  }

  async function handleSendToPengirim(current: NonNullable<typeof shipment>) {
    if (!settings.emailSendingEnabled) {
      setPengirimError("Pengiriman email sedang dinonaktifkan. Aktifkan di Admin > Pengaturan.");
      return;
    }
    setPengirimSending(true);
    setPengirimError(null);
    const result = await sendTrackingEmail(current, trackingUrlFor(current), "pengirim");
    setPengirimSending(false);
    if (result.ok) {
      setPengirimSent(true);
    } else {
      setPengirimError(result.error ?? "Gagal mengirim email.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getByAwb(awb ?? "").then((s) => {
      if (cancelled) return;
      setShipment(s);
      setSent(!!s?.emailTerkirim);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awb]);

  useEffect(() => {
    if (!shipment || shipment.emailTerkirim) return;
    if (!settings.emailSendingEnabled) {
      setSending(false);
      setError("Pengiriman email sedang dinonaktifkan. Aktifkan di Admin > Pengaturan.");
      return;
    }
    handleSend(shipment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment?.awb, settings.emailSendingEnabled]);

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
          <h1 className="text-2xl font-semibold text-slate-900">Preview Email Customer</h1>
          <p className="mt-1 text-sm text-slate-500">
            Email notifikasi resi dikirim ke pelanggan melalui SMTP Brevo.
          </p>
        </div>
        {sending ? (
          <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
            <Loader2 size={15} className="animate-spin" /> Mengirim email...
          </div>
        ) : !settings.emailSendingEnabled ? (
          <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
            <AlertTriangle size={15} /> Pengiriman email dinonaktifkan
          </div>
        ) : error ? (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
              <AlertTriangle size={15} /> Gagal mengirim email
            </div>
            <button
              onClick={() => shipment && handleSend(shipment)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCw size={14} /> Coba Lagi
            </button>
          </div>
        ) : (
          sent && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} /> Email berhasil dikirim
            </div>
          )
        )}
      </div>

      {!settings.emailSendingEnabled ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Pengiriman email real sedang dinonaktifkan untuk menghemat kuota SMTP. Aktifkan kembali di{" "}
          <Link to={adminPath("/pengaturan/tracking")} className="font-semibold underline">
            Admin &gt; Konfigurasi &gt; Tracking
          </Link>{" "}
          untuk mengirim email ini.
        </div>
      ) : (
        error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Detail error:</p>
            <p className="mt-0.5 break-words">{error}</p>
            <p className="mt-2 text-xs text-red-600">
              Periksa kembali konfigurasi SMTP di file <code className="font-mono">.env</code> (host, login, key, dan
              sender email yang sudah diverifikasi di akun Brevo Anda).
            </p>
          </div>
        )
      )}

      <div className="mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="text-sm text-slate-600">
          Kirim juga salinan resi ini ke email pengirim{" "}
          <span className="font-medium text-slate-800">({shipment.pengirim.email})</span>
        </div>
        {pengirimSent ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <CheckCircle2 size={15} /> Terkirim
          </span>
        ) : (
          <button
            onClick={() => handleSendToPengirim(shipment)}
            disabled={pengirimSending || !settings.emailSendingEnabled}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
          >
            {pengirimSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {pengirimError ? "Coba Lagi" : "Kirim ke Pengirim"}
          </button>
        )}
      </div>
      {pengirimError && (
        <p className="mx-auto mt-1.5 max-w-xl text-xs font-medium text-red-600">{pengirimError}</p>
      )}

      <div className="mx-auto mt-6 max-w-xl">
        {/* Mail client chrome */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <Mail size={15} className="text-slate-400" />
            <p className="text-xs text-slate-500">
              Kepada: <span className="font-medium text-slate-700">{shipment.penerima.email}</span>
            </p>
          </div>
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-400">Subjek</p>
            <p className="text-sm font-semibold text-slate-900">
              Resi Pengiriman Anda - AWB {shipment.awb}
            </p>
          </div>

          {/* Email body */}
          <div className="bg-slate-100 p-4 sm:p-6">
            <div className="overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="bg-blue-900 px-6 py-5 text-center">
                <img src={logoIcon} alt="GMS Logistics" className="mx-auto h-10 w-10 object-contain" />
                <p className="mt-2 text-sm font-semibold text-white">GMS Logistics</p>
              </div>

              <div className="px-6 py-6">
                <p className="text-sm text-slate-700">
                  Halo Bapak/Ibu <strong>{shipment.penerima.nama}</strong>,
                </p>
                <p className="mt-3 text-sm text-slate-700">
                  {shipment.status === "Selesai / Terkirim"
                    ? "Pengiriman Anda telah selesai/terkirim. Berikut detail resi/AWB pengiriman Anda:"
                    : "Pengiriman Anda telah berhasil dibuat dan sedang kami proses. Berikut detail resi pengiriman Anda:"}
                </p>

                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Nomor AWB
                  </p>
                  <p className="font-mono text-lg font-bold text-blue-900">{shipment.awb}</p>

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-sm">
                    <div>
                      <p className="text-[11px] text-slate-400">Dari</p>
                      <p className="font-medium text-slate-700">{shipment.pengirim.nama}</p>
                      <p className="text-xs text-slate-500">{shipment.kotaAsal}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Tujuan</p>
                      <p className="font-medium text-slate-700">{shipment.penerima.nama}</p>
                      <p className="text-xs text-slate-500">{shipment.kotaTujuan}</p>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
                    <p className="text-[11px] text-slate-400">Status</p>
                    <p className="font-medium text-blue-800">{shipment.status}</p>
                  </div>

                  <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
                    <p className="text-[11px] text-slate-400">Tanggal Terbit</p>
                    <p className="font-medium text-slate-700">
                      {formatTanggalPanjang(shipment.tanggalDibuat)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <Link
                    to={`/tracking/${shipment.awb}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    <MapPin size={16} />
                    Lacak Kiriman
                  </Link>
                </div>

                <p className="mt-6 text-xs leading-relaxed text-slate-400">
                  Anda dapat memantau posisi barang secara real-time dengan mengklik tombol
                  "Lacak Kiriman" di atas. Simpan email ini sebagai referensi pengiriman Anda.
                </p>
              </div>

              <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center text-[11px] text-slate-400">
                © {new Date().getFullYear()} PT Gangsar Mitra Suatama · Email otomatis, mohon tidak
                membalas email ini.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
