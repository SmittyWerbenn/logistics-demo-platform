import { C } from "../../data/compro/content";
import { PULAU_KOTA } from "../../data/ongkirData";
import { Container, SectionHeader } from "./SectionHeader";
import { Reveal, useL } from "./utils";

/** Island order shown in the coverage panel. */
const ISLAND_ORDER = ["Jawa", "Sumatera", "Bali", "Kalimantan", "Sulawesi"];

/** Master cities grouped by island/region. */
const byIsland = ISLAND_ORDER.map((island) => ({
  island,
  cities: Object.keys(PULAU_KOTA)
    .filter((city) => PULAU_KOTA[city] === island)
    .sort((a, b) => a.localeCompare(b)),
})).filter((g) => g.cities.length > 0);

const TOTAL_CITIES = byIsland.reduce((n, g) => n + g.cities.length, 0);

export function Coverage() {
  const l = useL();
  return (
    <section id="coverage" className="scroll-mt-16 bg-snt-mist py-20 sm:py-24">
      <Container>
        <SectionHeader title={l(C.coverage.title)} sub={l(C.coverage.sub)} large />

        <Reveal className="mx-auto mt-12 w-full max-w-4xl">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 sm:px-8">
              <p className="font-display text-2xl font-extrabold text-snt-corp">
                {TOTAL_CITIES} <span className="text-base font-semibold text-slate-500">{l(C.coverage.citiesSuffix)}</span>
              </p>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-snt-accent">{l(C.coverage.eyebrow)}</p>
            </div>

            <dl className="divide-y divide-slate-100">
              {byIsland.map(({ island, cities }) => (
                <div key={island} className="px-6 py-5 sm:px-8">
                  <dt className="font-display text-lg font-extrabold text-snt-corp">
                    {C.coverage.islands[island] ?? island}
                    <span className="ml-2 text-sm font-semibold text-slate-400">{cities.length}</span>
                  </dt>
                  <dd className="mt-3 flex flex-wrap gap-2">
                    {cities.map((city) => (
                      <span
                        key={city}
                        className="rounded-full bg-snt-mist px-3 py-1 text-sm font-semibold text-snt-corp"
                      >
                        {city}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="border-t border-slate-100 bg-snt-soft/50 px-6 py-4 text-sm text-slate-600 sm:px-8">
              {l(C.coverage.note)}
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
