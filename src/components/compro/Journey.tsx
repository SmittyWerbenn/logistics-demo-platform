import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { C } from "../../data/compro/content";
import { journeySteps } from "../../data/compro/journeySteps";
import { Container, SectionHeader } from "./SectionHeader";
import { JourneyArt } from "./JourneyArt";
import { Reveal, useL } from "./utils";

export function Journey() {
  const l = useL();
  const [idx, setIdx] = useState(0);
  const step = journeySteps[idx];
  const pct = (idx / (journeySteps.length - 1)) * 100;

  return (
    <section id="proses" className="scroll-mt-16 bg-white py-20 sm:py-24">
      <Container>
        <SectionHeader title={l(C.journey.title)} sub={l(C.journey.sub)} />

        {/* Desktop/tablet horizontal timeline */}
        <div className="mt-14 hidden md:block" role="tablist" aria-label={l(C.journey.timeline)}>
          <div className="relative">
            <div aria-hidden className="absolute left-[8.33%] right-[8.33%] top-6 h-1 rounded bg-gms-corp/20" />
            <div aria-hidden className="absolute left-[8.33%] top-6 h-1 rounded bg-gms-gold transition-all duration-500" style={{ width: `${pct * 0.8333}%` }} />
            <ol className="relative grid grid-cols-6">
              {journeySteps.map((s, i) => {
                const done = i < idx;
                const cur = i === idx;
                return (
                  <li key={s.id} className="flex flex-col items-center">
                    <button
                      type="button"
                      role="tab"
                      id={`journey-tab-${s.id}`}
                      aria-selected={cur}
                      aria-controls="journey-panel"
                      onClick={() => setIdx(i)}
                      onMouseEnter={() => setIdx(i)}
                      onFocus={() => setIdx(i)}
                      className="group flex flex-col items-center"
                    >
                      <span
                        className={`relative flex h-12 w-12 items-center justify-center rounded-full border-4 font-display text-sm font-extrabold transition-all ${
                          cur ? "scale-110 border-gms-gold bg-gms-corp text-gms-light shadow-lg"
                          : done ? "border-gms-gold bg-gms-gold text-gms-deep"
                          : "border-gms-corp/30 bg-white text-gms-corp group-hover:border-gms-gold"
                        }`}
                      >
                        {done ? <Check size={18} aria-hidden /> : String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={`mt-3 text-xs font-bold uppercase tracking-wider ${cur ? "text-gms-corp" : "text-slate-500"}`}>{l(s.short)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div
            id="journey-panel"
            role="tabpanel"
            aria-labelledby={`journey-tab-${step.id}`}
            key={step.id}
            className="mt-10 grid animate-[fadeIn_0.35s_ease-out] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2"
          >
            <div className="min-h-[260px]">
              {step.image ? <img src={step.image} alt={l(step.imageAlt)} loading="lazy" className="h-full w-full object-cover" /> : <JourneyArt step={step} />}
            </div>
            <div className="flex flex-col justify-center border-t-4 border-gms-gold p-8 lg:border-l-0 lg:border-t-0 lg:p-10">
              <span className="inline-flex w-fit rounded-full bg-gms-corp px-3 py-1 text-xs font-extrabold tracking-wider text-gms-light">{step.status}</span>
              <p className="mt-4 font-display text-sm font-bold uppercase tracking-wider text-gms-gold">{l(C.journey.step)} {String(idx + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 font-display text-2xl font-extrabold text-gms-corp sm:text-3xl">{l(step.title)}</h3>
              <p className="mt-3 leading-relaxed text-slate-600">{l(step.description)}</p>
            </div>
          </div>
        </div>

        {/* Mobile vertical timeline */}
        <ol className="relative mt-12 md:hidden">
          <div aria-hidden className="absolute bottom-4 left-5 top-4 w-0.5 bg-gms-gold/60" />
          {journeySteps.map((s, i) => (
            <Reveal as="li" key={s.id} className="relative pb-8 pl-14 last:pb-0">
              <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-gms-gold bg-gms-corp font-display text-xs font-extrabold text-gms-light">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="inline-flex rounded-full bg-gms-corp px-2.5 py-0.5 text-[11px] font-extrabold tracking-wider text-gms-light">{s.status}</span>
              <h3 className="mt-2 font-display text-lg font-extrabold text-gms-corp">{l(s.title)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{l(s.description)}</p>
              <div className="mt-3 overflow-hidden rounded-2xl shadow-md">
                {s.image ? <img src={s.image} alt={l(s.imageAlt)} loading="lazy" className="h-48 w-full object-cover" /> : <JourneyArt step={s} />}
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-14 rounded-3xl bg-gms-corp p-7 text-white sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <p className="font-display text-xl font-extrabold">{l(C.journey.systemTitle)}</p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {C.journey.system.map((s) => (
                  <li key={s.en} className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gms-gold text-gms-deep"><Check size={12} aria-hidden /></span>
                    {l(s)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:text-right">
              <p className="text-blue-100/85">{l(C.journey.ctaCopy)}</p>
              <Link to="/tracking" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg bg-gms-gold px-6 font-bold text-gms-deep transition-colors hover:bg-gms-bright">
                {l(C.journey.cta)} <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
