import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { C } from "../../data/compro/content";
import { Container, SectionHeader } from "./SectionHeader";
import { Reveal, scrollToSection, useL } from "./utils";
import { api } from "../../utils/apiClient";

interface PublicLogo {
  id: string;
  nama: string;
  altText: string;
  url: string;
}

/** Client logo showcase driven by the Portal Admin (Client Company Profile) -
 * every logo is its own <img> (no collage), ordered by the stored
 * sort_order. The 13 original logos are seeded server-side, so the section
 * keeps working even before any admin has touched the data. If the API is
 * unreachable (offline page / brief outage) we stay empty rather than
 * showing a broken list; the section then falls back to the empty state.
 * 2 columns on mobile, 3 on tablet, 4 on desktop, same as before. */
export function Clients() {
  const l = useL();
  const [logos, setLogos] = useState<PublicLogo[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: Array<Omit<PublicLogo, "url"> & { url: string | null }> }>("/api/public/client-logos", { auth: false })
      .then((res) => {
        if (!cancelled) setLogos(res.items.filter((i): i is PublicLogo => Boolean(i.url)));
      })
      .catch(() => {
        /* keep empty state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="clients" className="scroll-mt-16 bg-white py-20 sm:py-24">
      <Container>
        <SectionHeader title={l(C.clients.title)} sub={l(C.clients.sub)} />
        <Reveal className="mt-10">
          {logos.length === 0 ? (
            <p className="text-center text-sm text-slate-400">{l(C.clients.empty)}</p>
          ) : (
            <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 sm:gap-5">
              {logos.map((c) => (
                <li key={c.id} className="w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.85rem)] lg:w-[calc(25%-0.95rem)]">
                  <div className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4">
                    <img
                      src={c.url}
                      alt={c.altText}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </Container>
    </section>
  );
}

export function CTASection() {
  const l = useL();
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-gms-deep py-20 text-white sm:py-28">
      <div aria-hidden className="absolute -left-20 top-0 -z-10 h-full w-56 skew-x-[-18deg] bg-gms-gold" />
      <div aria-hidden className="absolute left-32 top-0 -z-10 h-full w-10 skew-x-[-18deg] bg-gms-light/50 max-sm:hidden" />
      <div aria-hidden className="absolute -right-16 top-0 -z-10 h-full w-72 skew-x-[-18deg] bg-gms-navy" />
      <Container className="text-center">
        <Reveal>
          <h2 id="cta-title" className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">
            {l(C.cta.title)}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-xl text-blue-100/85">{l(C.cta.sub)}</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => scrollToSection("kontak")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-gms-gold px-8 text-lg font-bold text-gms-deep shadow-lg transition-all hover:-translate-y-0.5 hover:bg-gms-bright">
              {l(C.cta.quote)} <ArrowRight size={18} aria-hidden />
            </button>
            <button type="button" onClick={() => scrollToSection("kontak")} className="inline-flex min-h-14 items-center justify-center rounded-lg border-2 border-white/70 px-8 text-lg font-bold transition-colors hover:border-gms-light hover:text-gms-light">
              {l(C.cta.contact)}
            </button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}