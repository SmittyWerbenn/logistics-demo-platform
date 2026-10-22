import { ArrowUpRight } from "lucide-react";
import { C } from "../../data/compro/content";
import { Container, SectionHeader } from "./SectionHeader";
import { Reveal, scrollToSection, useL } from "./utils";

export function ServiceCard({ icon: Icon, title, desc, learn, onClick, delay }: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  title: string; desc: string; learn: string; onClick: () => void; delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <button
        type="button"
        onClick={onClick}
        className="group relative flex h-full w-full flex-col items-start overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:border-gms-gold hover:shadow-lg"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gms-gold transition-transform duration-300 group-hover:scale-x-100" />
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gms-corp text-gms-light transition-colors group-hover:bg-gms-gold group-hover:text-gms-deep">
          <Icon size={22} aria-hidden />
        </span>
        <h3 className="mt-5 font-display text-lg font-bold text-gms-corp">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{desc}</p>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-gms-corp group-hover:text-gms-gold">
          {learn} <ArrowUpRight size={15} aria-hidden />
        </span>
      </button>
    </Reveal>
  );
}

export function Services({ onPickFleet }: { onPickFleet: (cargoOrGroup: string) => void }) {
  const l = useL();
  return (
    <section id="layanan" className="scroll-mt-16 bg-gms-sky py-20 sm:py-24">
      <Container>
        <SectionHeader title={l(C.services.title)} sub={l(C.services.sub)} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {C.services.items.map((s, i) => (
            <ServiceCard
              key={s.title.en}
              icon={s.icon}
              title={l(s.title)}
              desc={l(s.desc)}
              learn={l(C.services.learn)}
              delay={(i % 4) * 70}
              onClick={() => {
                onPickFleet(s.fleet);
                scrollToSection("armada");
              }}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
