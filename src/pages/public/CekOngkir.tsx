import { ArrowLeft, Boxes, Calculator, Clock3, Gauge, MapPin, Truck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../../components/compro/Navbar";
import { Footer } from "../../components/compro/Footer";
import { SearchableSelect } from "../../components/SearchableSelect";
import { COMPRO_IMAGES } from "../../data/compro/imagesData";
import { useLanguage } from "../../store/LanguageContext";
import { ApiError } from "../../utils/apiClient";
import { estimasiHariLabel, fetchOngkir, fetchOngkirTujuan, formatRupiah, type OngkirDestination, type OngkirEstimate } from "../../utils/ongkir";
import { useSeo } from "../../utils/seo";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-lg sm:text-xl text-slate-900 placeholder:text-slate-400 transition-colors focus:border-snt-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-snt-accent/20";

export default function CekOngkir() {
  const { t, language } = useLanguage();
  useSeo({
    title: language === "id" ? "Cek Ongkir | Sinartrans Logistics" : "Check Shipping Cost | Sinartrans Logistics",
    description: t.cekOngkir.desc,
    path: "/cek-ongkir",
  });
  const navigate = useNavigate();

  const [hub, setHub] = useState("JKT");
  const [mode, setMode] = useState("CARGO");
  const [rateId, setRateId] = useState("");
  const [grup, setGrup] = useState("");
  const [beratKg, setBeratKg] = useState("");
  const [jumlahKoli, setJumlahKoli] = useState("1");
  const [panjang, setPanjang] = useState("");
  const [lebar, setLebar] = useState("");
  const [tinggi, setTinggi] = useState("");
  const [hubs, setHubs] = useState<Array<{ id: string; nama: string }>>([{ id: "JKT", nama: "Jakarta" }, { id: "SUB", nama: "Surabaya" }]);
  const [modes, setModes] = useState<Array<{ id: string; nama: string }>>([{ id: "CARGO", nama: "Cargo Darat & Laut" }, { id: "KERETA", nama: "Kereta Api Express" }]);
  const [tujuan, setTujuan] = useState<OngkirDestination[]>([]);

  const [result, setResult] = useState<OngkirEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Destination list of the chosen hub + mode, straight from the Sinar Trans price list.
  useEffect(() => {
    let live = true;
    setRateId("");
    setGrup("");
    setResult(null);
    fetchOngkirTujuan(hub, mode)
      .then((r) => {
        if (!live) return;
        setHubs(r.hubs);
        setModes(r.modes);
        setTujuan(r.items);
      })
      .catch(() => live && setTujuan([]));
    return () => {
      live = false;
    };
  }, [hub, mode]);

  const grupList = Array.from(new Set(tujuan.map((x) => x.grup)));
  const kotaOptions = tujuan.filter((x) => !grup || x.grup === grup).map((x) => ({ value: String(x.id), label: x.kota }));
  const picked = tujuan.find((x) => String(x.id) === rateId);
  const belowMin = !!picked && beratKg !== "" && Number(beratKg) > 0 && Number(beratKg) < picked.minKg;

  const benefits = [
    { icon: Gauge, title: t.cekOngkir.benefit1Title, desc: t.cekOngkir.benefit1Desc },
    { icon: Clock3, title: t.cekOngkir.benefit2Title, desc: t.cekOngkir.benefit2Desc },
    { icon: Truck, title: t.cekOngkir.benefit3Title, desc: t.cekOngkir.benefit3Desc },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rateId) {
      setResult(null);
      setError(t.cekOngkir.errorRoute);
      return;
    }
    const berat = Number(beratKg);
    if (!berat || berat <= 0) {
      setResult(null);
      setError(t.cekOngkir.errorWeight);
      return;
    }
    setLoading(true);
    try {
      setResult(
        await fetchOngkir({
          hub,
          mode,
          rateId: Number(rateId),
          beratKg: berat,
          jumlahKoli: Number(jumlahKoli) || 1,
          panjangCm: Number(panjang) || undefined,
          lebarCm: Number(lebar) || undefined,
          tinggiCm: Number(tinggi) || undefined,
        }),
      );
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : t.cekOngkir.errorPricing);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar overlay={false} />
      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-snt-deep pb-40 pt-24 sm:pb-52 sm:pt-28">
          <img
            src={COMPRO_IMAGES.hero.url}
            alt=""
            aria-hidden
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-snt-deep via-snt-deep/85 to-snt-corp/40" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-snt-deep" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/40 px-3.5 py-2 text-lg sm:text-xl font-semibold text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={15} /> {t.trackingResult.back}
            </button>

            <div className="mt-8 max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-snt-accent/40 bg-snt-accent/10 px-3.5 py-1.5 text-base sm:text-lg font-bold uppercase tracking-[0.14em] text-snt-light">
                <Calculator size={13} /> {t.cekOngkir.title}
              </p>
              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
                {t.cekOngkir.heroTitle} <span className="text-snt-bright">{t.cekOngkir.heroTitleGold}</span>
              </h1>
              <p className="mt-3 max-w-md text-lg sm:text-xl leading-relaxed text-blue-100/90 sm:text-xl">{t.cekOngkir.desc}</p>
            </div>
          </div>
        </section>

        {/* Floating form card + benefits, overlapping the hero */}
        <div className="relative mx-auto -mt-28 max-w-6xl px-4 sm:-mt-36 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-black/5 sm:p-7"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-snt-accent/15 text-snt-corp">
                  <Calculator size={20} />
                </span>
                <div>
                  <h2 className="font-display text-2xl font-bold text-snt-corp">{t.cekOngkir.formTitle}</h2>
                  <p className="text-base sm:text-lg text-slate-500">{t.cekOngkir.formDesc}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">Kota Asal</label>
                  <select value={hub} onChange={(e) => setHub(e.target.value)} className={inputClass}>
                    {hubs.map((o) => (<option key={o.id} value={o.id}>{o.nama}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">Jenis Layanan</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}>
                    {modes.map((o) => (<option key={o.id} value={o.id}>{o.nama}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">Provinsi / Wilayah Tujuan</label>
                  <select value={grup} onChange={(e) => { setGrup(e.target.value); setRateId(""); }} className={inputClass}>
                    <option value="">Semua wilayah</option>
                    {grupList.map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">Kota Tujuan</label>
                  <SearchableSelect large options={kotaOptions} value={rateId} onChange={setRateId} placeholder="Pilih kota tujuan" emptyLabel={t.cekOngkir.cityNotFound} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.weightLabel}</label>
                  <input type="number" min={0.1} step={0.1} value={beratKg} onChange={(e) => setBeratKg(e.target.value)} placeholder={t.cekOngkir.weightPlaceholder} className={`${inputClass} ${belowMin ? "!border-amber-400 !ring-2 !ring-amber-100" : ""}`} />
                  {picked && (
                    <p className={`mt-1.5 text-sm ${belowMin ? "font-semibold text-amber-700" : "text-slate-400"}`}>
                      Minimum {picked.minKg} kg{belowMin ? " - akan ditagihkan sebesar minimum." : "."}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.koliLabel}</label>
                  <input type="number" min={1} step={1} value={jumlahKoli} onChange={(e) => setJumlahKoli(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">Dimensi per koli (cm, opsional - berat volume = P x L x T / 4000)</label>
                <div className="grid grid-cols-3 gap-3">
                  <input type="number" min={1} value={panjang} onChange={(e) => setPanjang(e.target.value)} placeholder="Panjang" className={inputClass} />
                  <input type="number" min={1} value={lebar} onChange={(e) => setLebar(e.target.value)} placeholder="Lebar" className={inputClass} />
                  <input type="number" min={1} value={tinggi} onChange={(e) => setTinggi(e.target.value)} placeholder="Tinggi" className={inputClass} />
                </div>
              </div>

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-base sm:text-lg font-medium text-red-700">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-snt-accent px-6 py-3.5 text-lg sm:text-xl font-bold text-snt-deep shadow-lg shadow-snt-accent/30 transition-all hover:-translate-y-0.5 hover:bg-snt-bright sm:w-auto"
              >
                <Calculator size={16} />
                {loading ? t.cekOngkir.calculating : t.cekOngkir.submitButton}
              </button>
            </form>

            <div className="hidden flex-col gap-4 lg:flex">
              {benefits.map((b) => (
                <div
                  key={b.title}
                  className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-snt-corp text-snt-light">
                    <b.icon size={18} />
                  </span>
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-snt-corp">{b.title}</p>
                    <p className="mt-0.5 text-base sm:text-lg leading-relaxed text-slate-500">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result && (
            <div className="mt-6 rounded-3xl border border-snt-accent/20 bg-snt-sky p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base sm:text-lg font-semibold text-snt-corp/70">
                    {result.asal.nama} &rarr; {result.tujuan.kota} ({result.tujuan.grup})
                  </p>
                  <p className="mt-1 text-2xl font-bold text-snt-deep sm:text-3xl">{formatRupiah(result.total)}</p>
                  <p className="mt-1 text-base sm:text-lg text-slate-500">{t.cekOngkir.resultDisclaimer}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-base sm:text-lg font-semibold text-snt-corp ring-1 ring-inset ring-snt-accent/30">
                  {result.mode.nama}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-white p-3">
                  <p className="flex items-center gap-1.5 text-sm text-slate-400"><MapPin size={12} /> Tarif / kg</p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-800">{formatRupiah(result.tarifPerKg)}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="flex items-center gap-1.5 text-sm text-slate-400"><Truck size={12} /> Berat ditagih</p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-800">{result.chargeableKg} kg</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Min {result.minimumKg} kg{result.volumetricKg > 0 ? ` · volume ${result.volumetricKg} kg` : ""}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="flex items-center gap-1.5 text-sm text-slate-400"><Clock3 size={12} /> {t.cekOngkir.estimatedArrival}</p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-800">{result.estimasi || estimasiHariLabel(result.leadTimeMin, result.leadTimeMax, language)}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="flex items-center gap-1.5 text-sm text-slate-400"><Boxes size={12} /> {t.cekOngkir.weightKoli}</p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-800">{result.beratKg} kg &middot; {result.jumlahKoli} koli</p>
                </div>
              </div>

              <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-slate-500">
                <li>Harga Port to Dooring dalam kota; alamat Kabupaten/Desa dikenakan biaya pengantaran tambahan.</li>
                <li>Pengiriman pada hari kerja. Pulau luar Jawa tergantung cuaca dan jadwal kapal.</li>
                {result.mode.id === "KERETA" && <li>Kereta berangkat Senin-Sabtu pukul 16.00 WIB.</li>}
                <li>Tarif khusus B2B/B2C tersedia. Hubungi 0819-0822-9028.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="h-10 sm:h-16" />
      </main>
      <Footer />
    </div>
  );
}
