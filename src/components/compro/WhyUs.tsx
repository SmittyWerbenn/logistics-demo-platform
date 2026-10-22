import { C } from "../../data/compro/content";
import { Container, SectionHeader } from "./SectionHeader";
import { Reveal, useL } from "./utils";

export function BenefitCard({ n, icon: Icon, title, desc, delay, className = "" }: {
  n: number; icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>; title: string; desc: string; delay: number; className?: string;
}) {
  return (
    <Reveal delay={delay} className={`group relative rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-gms-gold/60 hover:bg-white/10 ${className}`}>
      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gms-gold/15 text-gms-light">
          <Icon size={22} aria-hidden />
        </span>
        <span className="font-display text-4xl font-extrabold text-gms-gold/80">{String(n).padStart(2, "0")}</span>
      </div>
      <h3 className="mt-5 font-display text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-blue-100/75">{desc}</p>
    </Reveal>
  );
}

export function WhyUs() {
  const l = useL();
  return (
    <section id="keunggulan" className="relative scroll-mt-16 overflow-hidden bg-gms-corp py-20 sm:py-24">
      <div aria-hidden className="absolute -left-20 top-0 h-full w-40 skew-x-[-18deg] bg-gms-navy/60" />
      <Container className="relative">
        <SectionHeader dark title={l(C.why.title)} sub={l(C.why.sub)} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {C.why.items.map((it, i) => (
            <BenefitCard
              key={it.title.en}
              n={i + 1}
              icon={it.icon}
              title={l(it.title)}
              desc={l(it.desc)}
              delay={(i % 3) * 70}
              // A lone card on the last row is centred (3 columns) / spans the
              // row (2 columns) instead of hugging the left edge.
              className={i === C.why.items.length - 1 && i % 3 === 0 ? "sm:col-span-2 lg:col-span-1 lg:col-start-2" : ""}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
