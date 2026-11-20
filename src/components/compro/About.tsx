import { Quote, Target } from "lucide-react";
import { C } from "../../data/compro/content";
import { ABOUT_STATS, SITE_IMAGES } from "../../data/compro/config";
import { COMPRO_IMAGES } from "../../data/compro/imagesData";
import { SectionHeader, Container } from "./SectionHeader";
import { CountUp, Reveal, useL } from "./utils";

export function About() {
  const l = useL();
  const img = SITE_IMAGES.about || COMPRO_IMAGES.about.url;
  return (
    <section id="tentang" className="scroll-mt-16 bg-white py-20 sm:py-24">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative">
            <img src={img} alt={COMPRO_IMAGES.about.alt} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl" />
            <div aria-hidden className="absolute -bottom-4 -left-4 -z-10 h-2/3 w-2/3 rounded-2xl bg-gms-soft" />
            <div aria-hidden className="absolute -right-3 -top-3 -z-10 h-24 w-24 rounded-2xl bg-gms-gold" />
          </Reveal>
          <div>
            <SectionHeader align="left" title={l(C.about.title)} />
            <Reveal delay={80}>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">{l(C.about.p1)}</p>
              <p className="mt-3 text-lg leading-relaxed text-slate-600">{l(C.about.p2)}</p>
            </Reveal>
            <dl className="mt-8 grid grid-cols-2 gap-3">
              {ABOUT_STATS.map((s, i) => (
                <Reveal key={s.value + s.label.en} delay={i * 70} className="rounded-xl bg-gms-mist p-4 text-center">
                  <dt className="sr-only">{l(s.label)}</dt>
                  <dd>
                    <span className="block break-words font-display text-xl font-extrabold text-gms-corp sm:text-2xl">
                      <CountUp value={s.value} />
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-slate-500">{l(s.label)}</span>
                  </dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-16 grid gap-5 lg:grid-cols-2">
          <Reveal className="rounded-2xl bg-gms-corp p-7 text-white">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-gms-light">
              <Quote size={14} aria-hidden /> {l(C.about.visionLabel)}
            </p>
            <p className="mt-3 text-xl font-semibold leading-relaxed">{l(C.about.vision)}</p>
          </Reveal>
          <Reveal delay={80} className="rounded-2xl bg-gms-soft p-7">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-gms-corp">
              <Target size={14} aria-hidden /> {l(C.about.missionLabel)}
            </p>
            <ol className="mt-3 space-y-2 text-xl leading-relaxed text-gms-ink">
              {C.about.mission.map((m, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-display font-extrabold text-gms-corp">{i + 1}.</span>
                  {l(m)}
                </li>
              ))}
            </ol>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {C.about.values.map((v, i) => (
            <Reveal key={v.title.en} delay={i * 80} className="rounded-xl border border-slate-200 p-6 transition-colors hover:border-gms-gold">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gms-corp text-gms-light">
                <v.icon size={20} aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-gms-corp">{l(v.title)}</h3>
              <p className="mt-2 text-base leading-relaxed text-slate-600">{l(v.desc)}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
