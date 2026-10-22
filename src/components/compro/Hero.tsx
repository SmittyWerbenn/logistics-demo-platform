import { ArrowRight, Calculator, Camera, Gauge, Radar, Users, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { C } from "../../data/compro/content";
import { COMPRO_IMAGES } from "../../data/compro/imagesData";
import { Container } from "./SectionHeader";
import { scrollToSection, useL } from "./utils";

const TRUST_ICONS = [Radar, Camera, Users, Truck];

export function Hero() {
  const l = useL();
  return (
    <section id="home" className="relative isolate overflow-hidden bg-gms-deep pt-20 text-white lg:pt-24">
      {/* Purely decorative backdrop under a dark gradient, so it has an empty
          alt: a non-empty alt gets painted as visible text (faint, behind the
          fixed header) whenever the image is still loading or fails to load. */}
      <img
        src={COMPRO_IMAGES.hero.url}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40"
        fetchPriority="high"
        loading="eager"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-gms-deep via-gms-deep/90 to-gms-corp/60" />
      {/* diagonal gold accents */}
      <div aria-hidden className="absolute -right-24 top-0 -z-10 h-full w-48 skew-x-[-18deg] bg-gms-gold/90 max-sm:hidden" />
      <div aria-hidden className="absolute -right-4 top-0 -z-10 h-full w-8 skew-x-[-18deg] bg-gms-light/40 max-sm:hidden" />

      <Container className="py-20 sm:py-28 lg:py-36">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-gms-gold/40 bg-gms-gold/10 px-3.5 py-1.5 text-sm font-bold uppercase tracking-[0.16em] text-gms-light animate-[fadeIn_0.5s_ease-out]">
            <Gauge size={14} aria-hidden /> {l(C.hero.eyebrow)}
          </p>
          <h1 className="mt-6 font-display leading-[1.1] tracking-tight animate-[fadeIn_0.6s_ease-out]">
            <span className="block text-xl font-bold text-gms-gold sm:text-2xl">GMS Logistics</span>
            <span className="mt-1 block text-5xl font-extrabold sm:text-6xl lg:text-7xl">
              {l(C.hero.titleA)} <span className="text-gms-bright">{l(C.hero.titleB)}</span> {l(C.hero.titleC)}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-blue-100/85 sm:text-xl animate-[fadeIn_0.7s_ease-out]">
            {l(C.hero.sub)}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap animate-[fadeIn_0.8s_ease-out]">
            <Link
              to="/tracking"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gms-gold px-7 text-lg font-bold text-gms-deep shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-gms-bright"
            >
              {l(C.hero.ctaTrack)} <ArrowRight size={18} aria-hidden />
            </Link>
            <a
              href="https://gms-logistics.id/cek-ongkir"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-gms-gold px-7 text-lg font-bold text-gms-light transition-colors hover:bg-gms-gold/10"
            >
              <Calculator size={18} aria-hidden /> {l(C.nav.checkPrice)}
            </a>
            <button
              type="button"
              onClick={() => scrollToSection("kontak")}
              className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-white/70 px-7 text-lg font-bold text-white transition-colors hover:border-gms-light hover:text-gms-light"
            >
              {l(C.hero.ctaQuote)}
            </button>
          </div>
        </div>

        <ul className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:max-w-4xl">
          {C.hero.trust.map((t, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <li key={t.en} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gms-gold/15 text-gms-light">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="text-base font-semibold leading-tight">{l(t)}</span>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
