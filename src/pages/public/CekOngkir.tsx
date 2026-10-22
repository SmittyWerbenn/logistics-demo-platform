import { ArrowLeft, Boxes, Calculator, Clock3, Gauge, MapPin, Truck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../../components/compro/Navbar";
import { Footer } from "../../components/compro/Footer";
import { SearchableSelect } from "../../components/SearchableSelect";
import { COMPRO_IMAGES } from "../../data/compro/imagesData";
import { useLanguage } from "../../store/LanguageContext";
import { ApiError } from "../../utils/apiClient";
import { estimasiHariLabel, fetchLayananOptions, fetchMinimumWeight, fetchOngkir, fetchWilayah, formatRupiah, type OngkirEstimate } from "../../utils/ongkir";
import { useSeo } from "../../utils/seo";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-lg sm:text-xl text-slate-900 placeholder:text-slate-400 transition-colors focus:border-gms-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gms-gold/20";

export default function CekOngkir() {
  const { t, language } = useLanguage();
  useSeo({
    title: language === "id" ? "Cek Ongkir | GMS Logistics" : "Check Shipping Cost | GMS Logistics",
    description: t.cekOngkir.desc,
    path: "/cek-ongkir",
  });
  const navigate = useNavigate();

  const [provAsal, setProvAsal] = useState("");
  const [kotaAsal, setKotaAsal] = useState("");
  const [provTujuan, setProvTujuan] = useState("");
  const [kotaTujuan, setKotaTujuan] = useState("");
  const [kecTujuan, setKecTujuan] = useState("");
  const [beratKg, setBeratKg] = useState("");
  const [jumlahKoli, setJumlahKoli] = useState("1");
  // Jenis layanan: loaded from Master Layanan (active entries) - nothing is listed in the frontend.
  const [layananOptions, setLayananOptions] = useState<Array<{ id: string; nama: string }>>([]);
  const [layananId, setLayananId] = useState("");
  useEffect(() => {
    fetchLayananOptions()
      .then((items) => {
        setLayananOptions(items);
        setLayananId((cur) => (items.some((i) => i.id === cur) ? cur : (items.find((i) => i.nama === "LTL") ?? items[0])?.id ?? ""));
      })
      .catch(() => setLayananOptions([]));
  }, []);
  // Minimum billing weight of the chosen destination (decided by the API). The weight field is pre-filled with it and
  // a warning shows when the user types less; the price itself is always computed by the API.
  const [minWeight, setMinWeight] = useState<{ kg: number; kategori: string | null }>({ kg: 0, kategori: null });
  const prevMinRef = useRef(0);
  useEffect(() => {
    if (!provTujuan || !layananId) {
      setMinWeight({ kg: 0, kategori: null });
      prevMinRef.current = 0;
      return;
    }
    let live = true;
    fetchMinimumWeight({ provinsi: provTujuan, kota: kotaTujuan, asalProvinsi: provAsal, asalKota: kotaAsal, layananId })
      .then((r) => {
        if (!live) return;
        const prev = prevMinRef.current;
        prevMinRef.current = r.minimumKg;
        setMinWeight({ kg: r.minimumKg, kategori: r.minimumKategori });
        // Fill the weight when empty, below the new minimum, or still holding the previous auto-filled minimum.
        setBeratKg((cur) => {
          const n = Number(cur);
          if (r.minimumKg <= 0) return cur !== "" && prev > 0 && n === prev ? "" : cur;
          if (cur === "" || !Number.isFinite(n) || n < r.minimumKg || (prev > 0 && n === prev)) return String(r.minimumKg);
          return cur;
        });
      })
      .catch(() => live && setMinWeight({ kg: 0, kategori: null }));
    return () => {
      live = false;
    };
  }, [provTujuan, kotaTujuan, provAsal, kotaAsal, layananId]);
  const belowMin = minWeight.kg > 0 && beratKg !== "" && Number(beratKg) > 0 && Number(beratKg) < minWeight.kg;

  const [result, setResult] = useState<OngkirEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Wilayah master (Provinsi -> Kab/Kota -> Kecamatan) comes from the API; each
  // level loads when its parent is chosen. Child values reset when a parent changes.
  const [provinsiList, setProvinsiList] = useState<string[]>([]);
  const [kotaAsalList, setKotaAsalList] = useState<string[]>([]);
  const [kotaTujuanList, setKotaTujuanList] = useState<string[]>([]);
  const [kecTujuanList, setKecTujuanList] = useState<string[]>([]);

  useEffect(() => {
    fetchWilayah().then(setProvinsiList).catch(() => setProvinsiList([]));
  }, []);
  useEffect(() => {
    if (!provAsal) return;
    let live = true;
    fetchWilayah(provAsal).then((l) => live && setKotaAsalList(l)).catch(() => live && setKotaAsalList([]));
    return () => {
      live = false;
    };
  }, [provAsal]);
  useEffect(() => {
    if (!provTujuan) return;
    let live = true;
    fetchWilayah(provTujuan).then((l) => live && setKotaTujuanList(l)).catch(() => live && setKotaTujuanList([]));
    return () => {
      live = false;
    };
  }, [provTujuan]);
  useEffect(() => {
    if (!provTujuan || !kotaTujuan) return;
    let live = true;
    fetchWilayah(provTujuan, kotaTujuan).then((l) => live && setKecTujuanList(l)).catch(() => live && setKecTujuanList([]));
    return () => {
      live = false;
    };
  }, [provTujuan, kotaTujuan]);

  const toOptions = (list: string[]) => list.map((v) => ({ value: v, label: v }));
  const provinsiOptions = toOptions(provinsiList);


  const benefits = [
    { icon: Gauge, title: t.cekOngkir.benefit1Title, desc: t.cekOngkir.benefit1Desc },
    { icon: Clock3, title: t.cekOngkir.benefit2Title, desc: t.cekOngkir.benefit2Desc },
    { icon: Truck, title: t.cekOngkir.benefit3Title, desc: t.cekOngkir.benefit3Desc },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!provAsal || !kotaAsal || !provTujuan || !kotaTujuan || !kecTujuan) {
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
          asal: { provinsi: provAsal, kota: kotaAsal },
          tujuan: { provinsi: provTujuan, kota: kotaTujuan, kecamatan: kecTujuan },
          beratKg: berat,
          jumlahKoli: Number(jumlahKoli) || 1,
          layananId,
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
        <section className="relative isolate overflow-hidden bg-gms-deep pb-40 pt-24 sm:pb-52 sm:pt-28">
          <img
            src={COMPRO_IMAGES.hero.url}
            alt=""
            aria-hidden
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-gms-deep via-gms-deep/85 to-gms-corp/40" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gms-deep" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/40 px-3.5 py-2 text-lg sm:text-xl font-semibold text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={15} /> {t.trackingResult.back}
            </button>

            <div className="mt-8 max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-gms-gold/40 bg-gms-gold/10 px-3.5 py-1.5 text-base sm:text-lg font-bold uppercase tracking-[0.14em] text-gms-light">
                <Calculator size={13} /> {t.cekOngkir.title}
              </p>
              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
                {t.cekOngkir.heroTitle} <span className="text-gms-bright">{t.cekOngkir.heroTitleGold}</span>
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
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gms-gold/15 text-gms-corp">
                  <Calculator size={20} />
                </span>
                <div>
                  <h2 className="font-display text-2xl font-bold text-gms-corp">{t.cekOngkir.formTitle}</h2>
                  <p className="text-base sm:text-lg text-slate-500">{t.cekOngkir.formDesc}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.originProvince}</label>
                    <SearchableSelect
                      large
                      options={provinsiOptions}
                      value={provAsal}
                      onChange={(v) => {
                        setProvAsal(v);
                        setKotaAsal("");
                        setKotaAsalList([]);
                      }}
                      placeholder={t.cekOngkir.originProvince}
                      emptyLabel={t.cekOngkir.provinceNotFound}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.originCity}</label>
                    <SearchableSelect
                      large
                      options={toOptions(provAsal ? kotaAsalList : [])}
                      value={kotaAsal}
                      onChange={setKotaAsal}
                      placeholder={provAsal ? t.cekOngkir.originCity : t.cekOngkir.selectProvinceFirst}
                      emptyLabel={t.cekOngkir.cityNotFound}
                      disabled={!provAsal}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.destinationProvince}</label>
                    <SearchableSelect
                      large
                      options={provinsiOptions}
                      value={provTujuan}
                      onChange={(v) => {
                        setProvTujuan(v);
                        setKotaTujuan("");
                        setKecTujuan("");
                        setKotaTujuanList([]);
                        setKecTujuanList([]);
                      }}
                      placeholder={t.cekOngkir.destinationProvince}
                      emptyLabel={t.cekOngkir.provinceNotFound}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.destinationCity}</label>
                    <SearchableSelect
                      large
                      options={toOptions(provTujuan ? kotaTujuanList : [])}
                      value={kotaTujuan}
                      onChange={(v) => {
                        setKotaTujuan(v);
                        setKecTujuan("");
                        setKecTujuanList([]);
                      }}
                      placeholder={provTujuan ? t.cekOngkir.destinationCity : t.cekOngkir.selectProvinceFirst}
                      emptyLabel={t.cekOngkir.cityNotFound}
                      disabled={!provTujuan}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.destinationDistrict}</label>
                    <SearchableSelect
                      large
                      options={toOptions(kotaTujuan ? kecTujuanList : [])}
                      value={kecTujuan}
                      onChange={setKecTujuan}
                      placeholder={kotaTujuan ? t.cekOngkir.destinationDistrict : t.cekOngkir.destinationCity}
                      emptyLabel={t.cekOngkir.cityNotFound}
                      disabled={!kotaTujuan}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.weightLabel}</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={beratKg}
                    onChange={(e) => setBeratKg(e.target.value)}
                    placeholder={t.cekOngkir.weightPlaceholder}
                    className={`${inputClass} ${belowMin ? "!border-amber-400 !ring-2 !ring-amber-100" : ""}`}
                  />
                  {minWeight.kg > 0 && (
                    <p className={`mt-1.5 text-sm ${belowMin ? "font-semibold text-amber-700" : "text-slate-400"}`}>
                      {(belowMin ? t.cekOngkir.belowMinWarning : t.cekOngkir.minWeightHint)
                        .replace("{kategori}", minWeight.kategori ?? "")
                        .replace("{min}", String(minWeight.kg))}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.koliLabel}</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={jumlahKoli}
                    onChange={(e) => setJumlahKoli(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-base sm:text-lg font-medium text-slate-600">{t.cekOngkir.serviceLabel}</label>
                  <select
                    value={layananId}
                    onChange={(e) => setLayananId(e.target.value)}
                    className={inputClass}
                  >
                    {layananOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-base sm:text-lg font-medium text-red-700">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gms-gold px-6 py-3.5 text-lg sm:text-xl font-bold text-gms-deep shadow-lg shadow-gms-gold/30 transition-all hover:-translate-y-0.5 hover:bg-gms-bright sm:w-auto"
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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gms-corp text-gms-light">
                    <b.icon size={18} />
                  </span>
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-gms-corp">{b.title}</p>
                    <p className="mt-0.5 text-base sm:text-lg leading-relaxed text-slate-500">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result && (
            <div className="mt-6 rounded-3xl border border-gms-gold/20 bg-gms-sky p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base sm:text-lg font-semibold text-gms-corp/70">
                    {result.asal.kota} ({result.asal.provinsi}) &rarr; {result.tujuan.kecamatan}, {result.tujuan.kota}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gms-deep sm:text-3xl">{formatRupiah(result.total)}</p>
                  <p className="mt-1 text-base sm:text-lg text-slate-500">{t.cekOngkir.resultDisclaimer}</p>
                  {!result.ratePublishTersedia && (
                    <p className="mt-1 text-base sm:text-lg font-medium text-amber-700">{t.cekOngkir.noRateNote}</p>
                  )}
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-base sm:text-lg font-semibold text-gms-corp ring-1 ring-inset ring-gms-gold/30">
                  {result.layanan}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-white p-3">
                  <p className="flex items-center gap-1.5 text-sm text-slate-400">
                    <MapPin size={12} /> {t.cekOngkir.route}
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-800">{result.tujuan.provinsi}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Truck size={12} /> {t.cekOngkir.areaCategory}
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-800">{result.tujuan.kategoriArea}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Clock3 size={12} /> {t.cekOngkir.estimatedArrival}
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-800">{estimasiHariLabel(result.leadTimeMin, result.leadTimeMax, language)}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Boxes size={12} /> {t.cekOngkir.weightKoli}
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-800">
                    {result.beratKg} kg &middot; {result.jumlahKoli} koli
                  </p>
                  {result.minimumKg > 0 && (
                    <p className="mt-1 text-sm text-slate-500">
                      {t.cekOngkir.minWeightNote
                        .replace("{kategori}", result.minimumKategori ?? "")
                        .replace("{min}", String(result.minimumKg))
                        .replace("{charge}", String(result.chargeableKg))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-10 sm:h-16" />
      </main>
      <Footer />
    </div>
  );
}
