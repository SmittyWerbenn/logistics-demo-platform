import { ArrowLeft, BellRing, History, MapPin, QrCode, Search, ShieldCheck, Trash2, Truck, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import heroImage from "../../assets/hero-package-handoff.jpg";
import { BarcodeScannerModal } from "../../components/BarcodeScannerModal";
import { Navbar } from "../../components/compro/Navbar";
import { Footer } from "../../components/compro/Footer";
import { StatusBadge } from "../../components/StatusBadge";
import { useLanguage } from "../../store/LanguageContext";
import type { ShipmentStatus } from "../../types";
import {
  clearAwbHistory,
  formatRelativeView,
  getAwbHistory,
  removeAwbHistory,
  type AwbHistoryEntry,
} from "../../utils/awbHistory";
import { Captcha } from "../../components/Captcha";
import { useTrackingGate } from "../../utils/useTrackingGate";
import { TRACKING_CAPTCHA_ENABLED, getHumanPass } from "../../utils/captchaApi";
import { useSeo } from "../../utils/seo";

export default function TrackingSearch() {
  const { t, language } = useLanguage();
  useSeo({
    title: language === "id" ? "Tracking Pengiriman | GMS Logistics" : "Shipment Tracking | GMS Logistics",
    description: t.trackingSearch.heroDesc,
    path: "/tracking",
  });
  const [awb, setAwb] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [checking, setChecking] = useState(false);
  const [history, setHistory] = useState<AwbHistoryEntry[]>(() => getAwbHistory());
  const [scannerOpen, setScannerOpen] = useState(false);
  const navigate = useNavigate();
  const gate = useTrackingGate();
  const [scanNotice, setScanNotice] = useState("");

  async function goToAwbIfExists(trimmed: string) {
    setChecking(true);
    let result;
    try {
      result = await gate.lookup(trimmed);
    } finally {
      setChecking(false);
    }
    if (result === "blocked") return;
    if (result) {
      setNotFound(false);
      navigate(`/tracking/${trimmed}`);
    } else {
      setNotFound(true);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = awb.trim();
    if (!trimmed) return;
    goToAwbIfExists(trimmed);
  }

  function handleScanned(scannedAwb: string) {
    setScannerOpen(false);
    setAwb(scannedAwb);
    setNotFound(false);
    // Already verified -> go straight on. Otherwise show the scanned AWB and ask for the
    // code once, WITHOUT reopening the scanner.
    if (!TRACKING_CAPTCHA_ENABLED || getHumanPass()) {
      setScanNotice("");
      goToAwbIfExists(scannedAwb);
    } else {
      setScanNotice(scannedAwb);
      setTimeout(() => gate.captchaRef.current?.focus(), 150);
    }
  }

  const features = [
    { icon: MapPin, title: t.trackingSearch.feature1Title, desc: t.trackingSearch.feature1Desc },
    { icon: ShieldCheck, title: t.trackingSearch.feature2Title, desc: t.trackingSearch.feature2Desc },
    { icon: BellRing, title: t.trackingSearch.feature3Title, desc: t.trackingSearch.feature3Desc },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar overlay={false} />
      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-gms-deep pb-16 pt-24 sm:pb-20 sm:pt-28">
          <img
            src={heroImage}
            alt=""
            aria-hidden
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-gms-deep via-gms-deep/90 to-gms-corp/60" />

          {/* Decorative route line - desktop only, purely visual */}
          <div aria-hidden className="pointer-events-none absolute right-10 top-10 hidden items-center gap-2 lg:flex">
            <MapPin size={18} className="text-gms-light" />
            <span className="block h-px w-16 border-t border-dashed border-gms-light/50" />
            <MapPin size={18} className="text-gms-gold" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/40 px-3.5 py-2 text-base sm:text-lg font-semibold text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={15} /> {t.trackingResult.back}
            </button>

            <div className="mt-6 grid grid-cols-1 items-center gap-10 lg:grid-cols-5">
              <div className="text-center lg:col-span-3 lg:text-left">
                <p className="inline-flex items-center gap-2 rounded-full border border-gms-gold/40 bg-gms-gold/10 px-3.5 py-1.5 text-sm sm:text-base font-bold uppercase tracking-[0.14em] text-gms-light">
                  <Search size={13} /> {t.nav.trackPackage}
                </p>
                <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
                  {t.trackingSearch.heroTitle} <span className="text-gms-bright">{t.trackingSearch.heroTitleGold}</span>
                </h1>
                <p className="mx-auto mt-3 max-w-md text-base sm:text-lg leading-relaxed text-blue-100/90 sm:text-lg lg:mx-0">
                  {t.trackingSearch.heroDesc}
                </p>

                <form onSubmit={handleSubmit} className="mx-auto mt-6 w-full max-w-md lg:mx-0">
                  <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 text-left shadow-2xl ring-1 ring-black/5">
                    <input
                      value={awb}
                      onChange={(e) => {
                        setAwb(e.target.value);
                        setNotFound(false);
                        setScanNotice("");
                      }}
                      placeholder={t.trackingSearch.placeholder}
                      aria-label="AWB"
                      autoComplete="off"
                      className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-lg text-slate-900 focus:border-gms-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gms-gold/20"
                    />
                    {scanNotice && gate.needsCaptcha && (
                      <p role="status" className="rounded-lg bg-gms-soft px-3 py-2 text-sm sm:text-base font-semibold text-gms-corp">
                        {language === "id" ? `AWB ${scanNotice} terbaca. Masukkan kode verifikasi lalu tekan Lacak.` : `AWB ${scanNotice} scanned. Enter the verification code, then press Track.`}
                      </p>
                    )}
                    {gate.needsCaptcha && (
                      <Captcha ref={gate.captchaRef} idPrefix="trk" compact value={gate.code} onChange={gate.setCode} error={gate.error} />
                    )}
                    <button
                      type="submit"
                      disabled={checking}
                      className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gms-corp px-6 py-3 text-base sm:text-lg font-bold text-white shadow-lg transition-all hover:bg-gms-deep disabled:opacity-60"
                    >
                      <Search size={16} />
                      {checking ? (language === "id" ? "Memproses..." : "Processing...") : t.trackingSearch.submitButton}
                    </button>
                  </div>
                  {notFound && (
                    <p className="mt-2 text-left text-sm sm:text-base font-medium text-red-200">{t.trackingSearch.notFound}</p>
                  )}
                </form>

                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-base sm:text-lg font-semibold text-white/90 shadow-sm backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-white/20 lg:mx-0"
                >
                  <QrCode size={18} />
                  {t.trackingSearch.scanButton}
                </button>
              </div>

              <div className="hidden flex-col items-center justify-center gap-3 lg:col-span-2 lg:flex">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <Truck size={44} className="text-white" />
                </div>
                <p className="max-w-[220px] text-center font-serif text-xl italic text-blue-100">
                  {t.trackingSearch.taglineImage}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature cards - slightly overlapping the hero for a layered feel */}
        <section className="relative mx-auto -mt-8 max-w-6xl px-4 sm:-mt-10 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5 sm:p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gms-corp text-gms-light">
                  <f.icon size={19} />
                </span>
                <div>
                  <p className="text-base sm:text-lg font-bold text-gms-corp">{f.title}</p>
                  <p className="mt-0.5 text-sm sm:text-base leading-relaxed text-slate-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Search history */}
        {history.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
            <div className="w-full text-left">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm sm:text-base font-semibold uppercase tracking-wide text-slate-400">
                  <History size={13} />
                  {t.trackingSearch.historyTitle}
                </p>
                <button
                  onClick={() => setHistory(clearAwbHistory())}
                  className="flex items-center gap-1 text-sm sm:text-base font-medium text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={12} /> {t.trackingSearch.clearAll}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {history.map((h) => (
                  <div
                    key={h.awb}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-gms-gold/50 hover:bg-gms-sky"
                  >
                    <button
                      onClick={() => navigate(`/tracking/${h.awb}`)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-base sm:text-lg font-medium text-slate-800">{h.awb}</p>
                        <p className="text-sm sm:text-base text-slate-400">
                          {t.trackingSearch.lastViewed}: {formatRelativeView(h.lastViewedAt, language)}
                        </p>
                      </div>
                      <StatusBadge status={h.status as ShipmentStatus} size="sm" />
                    </button>
                    <button
                      onClick={() => setHistory(removeAwbHistory(h.awb))}
                      title={t.trackingSearch.removeFromHistory}
                      className="shrink-0 rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="h-6 sm:h-10" />

        {scannerOpen && (
          <BarcodeScannerModal onClose={() => setScannerOpen(false)} onDetected={handleScanned} />
        )}
      </main>
      <Footer />
    </div>
  );
}
