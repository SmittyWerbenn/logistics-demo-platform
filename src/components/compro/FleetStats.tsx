import { C } from "../../data/compro/content";
import { COMPANY_STATS, FLEET_STATS_CONFIG } from "../../data/compro/config";
import { Container } from "./SectionHeader";
import { CountUp, Reveal, useL } from "./utils";

export function StatisticCard({ value, label, delay }: { value: string; label: string; delay: number }) {
  return (
    <Reveal delay={delay} className="min-w-0 border-l-2 border-gms-gold/60 pl-4 sm:pl-5">
      <p className="font-display break-words text-3xl font-extrabold text-gms-gold min-[400px]:text-4xl sm:text-5xl lg:text-6xl"><CountUp value={value} /></p>
      <p className="mt-1 break-words text-sm font-semibold uppercase tracking-wider sm:text-base text-blue-100/80">{label}</p>
    </Reveal>
  );
}

export function FleetStats() {
  const l = useL();
  const items = [
    { v: FLEET_STATS_CONFIG.fleetTypes, k: C.stats.fleetTypes },
    { v: FLEET_STATS_CONFIG.maxCapacity, k: C.stats.capacity },
    { v: FLEET_STATS_CONFIG.trailer, k: C.stats.trailer },
    { v: FLEET_STATS_CONFIG.coverage, k: C.stats.coverage },
  ];
  void COMPANY_STATS;
  return (
    <section aria-label="Fleet statistics" className="overflow-hidden bg-gms-deep py-14">
      <Container>
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-8 lg:grid-cols-4">
          {items.map((s, i) => (
            <StatisticCard key={s.k.en} value={s.v} label={l(s.k)} delay={i * 80} />
          ))}
        </div>
      </Container>
    </section>
  );
}
