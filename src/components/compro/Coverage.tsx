import { C } from "../../data/compro/content";
import { Container, SectionHeader } from "./SectionHeader";
import { Reveal, useL } from "./utils";

export function Coverage() {
  const l = useL();
  return (
    <section id="coverage" className="scroll-mt-16 bg-gms-mist py-20 sm:py-24">
      <Container>
        <SectionHeader title={l(C.coverage.title)} sub={l(C.coverage.sub)} large />
        <div className="mt-12 flex justify-center">
          <Reveal className="w-full max-w-4xl">
            <div className="relative overflow-hidden rounded-3xl bg-white shadow-lg">
              <img 
                src="/assets/coverage.webp"
                alt={l(C.coverage.mapLabel)}
                loading="lazy"
                className="w-full h-auto object-contain"
              />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
