import { ArrowRight, Search, X, Weight, Box } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../../data/compro/content";
import {
  cargoTypes,
  fleetCategories,
  fleetData,
  fleetFilters,
  fleetVehicles,
  type FleetCategory,
  type FleetGroup,
  type FleetItem,
  type FleetVehicle,
} from "../../data/compro/fleetData";
import { useLanguage } from "../../store/LanguageContext";
import { Container, SectionHeader } from "./SectionHeader";
import { TruckArt } from "./TruckArt";
import { Reveal, scrollToSection, useL } from "./utils";

/** Photo of a category (or one of its variants); falls back to the branded vector. */
function FleetImage({ category, src, art, dark, eager }: { category: FleetCategory; src?: string; art: FleetItem["art"]; dark?: boolean; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        src={src ?? category.hero}
        alt={category.alt}
        width={1536}
        height={1024}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    );
  }
  return <TruckArt kind={art} dark={dark} />;
}

/** Capacity / length / heavy flag of a vehicle's group, from the verified fleetData items. */
function groupInfo(group: FleetGroup) {
  const items = fleetData.filter((f) => f.group === group);
  const caps = items.flatMap((f) => f.specs.map((sp) => parseFloat(sp.capacity)));
  const capacity = caps.length ? (Math.min(...caps) === Math.max(...caps) ? `${Math.max(...caps)} Ton` : `${Math.min(...caps)} – ${Math.max(...caps)} Ton`) : null;
  return { items, capacity, length: items.find((f) => f.length)?.length, heavy: items.some((f) => f.heavy), art: items[0]?.art ?? "pickup" };
}

export function FleetCard({ vehicle, onOpen, delay }: { vehicle: FleetVehicle; onOpen: (i: FleetItem, src: string) => void; delay: number }) {
  const l = useL();
  const info = groupInfo(vehicle.group);
  const category = fleetCategories.find((c) => c.group === vehicle.group)!;
  const heavy = info.heavy;
  return (
    <Reveal delay={delay} className="h-full">
      <article
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
          heavy ? "border-gms-gold bg-gms-corp text-white" : "border-slate-200 bg-white text-gms-ink hover:border-gms-corp"
        }`}
      >
        <div className={`relative flex aspect-[3/2] items-center justify-center p-2 sm:p-3 ${heavy ? "bg-gms-deep" : "bg-gms-mist"}`}>
          <div className="h-full w-full transition-transform duration-500 group-hover:scale-105">
            <img
              src={vehicle.src}
              alt={vehicle.alt}
              width={1536}
              height={1024}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain"
            />
          </div>
          {heavy && (
            <span className="absolute left-3 top-3 rounded-full bg-gms-gold px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-gms-deep">
              {l(C.fleet.heavyBadge)}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className={`font-display text-2xl font-extrabold ${heavy ? "text-white" : "text-gms-corp"}`}>{vehicle.name}</h3>
          <p className={`mt-0.5 text-base font-semibold ${heavy ? "text-gms-light" : "text-gms-gold"}`}>
            {info.length ? l(info.length) : info.capacity ? `${l(C.fleet.capacity)} ${info.capacity}` : "\u00A0"}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={l(C.fleet.body)}>
            {vehicle.bodies.map((b) => (
              <li key={b} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${heavy ? "bg-white/10 text-blue-100" : "bg-gms-sky text-gms-corp"}`}>
                {b}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onOpen(info.items.find((f) => vehicle.name.toLowerCase().startsWith(f.name.toLowerCase())) ?? info.items[0], vehicle.src)}
            aria-haspopup="dialog"
            className={`mt-auto inline-flex items-center gap-1.5 pt-5 text-base font-bold ${heavy ? "text-gms-light hover:text-white" : "text-gms-corp hover:text-gms-gold"}`}
          >
            {l(C.fleet.viewSpec)} <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-1" />
            <span className="sr-only">: {vehicle.name} ({category.name})</span>
          </button>
        </div>
      </article>
    </Reveal>
  );
}

export function FleetFilter({ value, onChange }: { value: "all" | FleetGroup; onChange: (v: "all" | FleetGroup) => void }) {
  const l = useL();
  return (
    <div role="group" aria-label={l(C.fleet.filterLabel)} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {fleetFilters.map((f) => {
        const active = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f.id)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-base font-semibold transition-colors ${
              active
                ? "border-gms-corp bg-gms-corp text-white"
                : "border-slate-300 bg-white text-gms-corp hover:border-gms-gold hover:text-gms-gold"
            }`}
          >
            {l(f.label)}
          </button>
        );
      })}
    </div>
  );
}

export function FleetDetailModal({ item: openedItem, initialSrc, onClose, onRequest }: { item: FleetItem | null; initialSrc?: string; onClose: () => void; onRequest: (i: FleetItem) => void }) {
  const l = useL();
  // A category can hold several fleetData items (e.g. CDE / CDE Long): the dialog
  // lets the visitor switch between them, and between the body-variant photos.
  const [picked, setPicked] = useState<{ from: FleetItem | null; item: FleetItem | null; photo: number }>({ from: null, item: null, photo: 0 });
  const openCategory = openedItem ? fleetCategories.find((c) => c.group === openedItem.group) : undefined;
  const startPhoto = Math.max(0, openCategory?.variants.findIndex((v) => v.src === initialSrc) ?? 0);
  const current = picked.from === openedItem ? picked : { from: openedItem, item: openedItem, photo: startPhoto };
  const item = current.item;
  const category = item ? fleetCategories.find((c) => c.group === item.group) : undefined;
  const siblings = item ? fleetData.filter((f) => f.group === item.group) : [];
  const photo = category ? category.variants[Math.min(current.photo, category.variants.length - 1)] : undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openedItem) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [openedItem, onClose]);
  if (!item || !category) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-gms-deep/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fleet-dialog-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl animate-[fadeIn_0.25s_ease-out] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className={`relative flex h-52 shrink-0 items-center justify-center p-3 sm:h-72 ${item.heavy ? "bg-gms-deep" : "bg-gms-sky"}`}>
          <div className="h-full w-full max-w-xl"><FleetImage category={category} src={photo?.src} art={item.art} dark={item.heavy} eager /></div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={l(C.fleet.close)}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gms-corp shadow hover:bg-gms-soft"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-6 sm:p-8">
          {category.variants.length > 1 && (
            <ul className="-mt-1 mb-5 flex flex-wrap gap-2" aria-label={l(C.fleet.variants)}>
              {category.variants.map((v, i) => (
                <li key={v.label}>
                  <button
                    type="button"
                    aria-pressed={photo?.src === v.src}
                    onClick={() => setPicked({ from: openedItem, item, photo: i })}
                    className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                      photo?.src === v.src ? "border-gms-corp bg-gms-corp text-white" : "border-slate-300 text-gms-corp hover:border-gms-gold"
                    }`}
                  >
                    {v.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {siblings.length > 1 && (
            <div role="group" aria-label={category.name} className="mb-4 flex flex-wrap gap-2">
              {siblings.map((sb) => (
                <button
                  key={sb.id}
                  type="button"
                  aria-pressed={sb.id === item.id}
                  onClick={() => setPicked({ from: openedItem, item: sb, photo: current.photo })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold ${sb.id === item.id ? "bg-gms-gold text-gms-deep" : "bg-gms-mist text-gms-corp hover:bg-gms-sky"}`}
                >
                  {sb.name}
                </button>
              ))}
            </div>
          )}
          <h3 id="fleet-dialog-title" className="font-display text-3xl font-extrabold text-gms-corp">{item.name}</h3>
          {item.length && <p className="mt-0.5 font-semibold text-gms-gold">{l(item.length)}</p>}
          <p className="mt-3 text-base text-slate-600">{l(item.description)}</p>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-gms-gold">{l(C.fleet.body)}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {item.bodyTypes.map((b) => (
              <li key={b} className="rounded-md bg-gms-corp px-2.5 py-1 text-sm font-semibold text-white">{b}</li>
            ))}
          </ul>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-gms-gold">{l(C.fleet.specs)}</p>
          {item.specs.length === 0 ? (
            <p className="mt-2 rounded-xl bg-gms-soft/60 p-4 text-base text-gms-ink">{l(C.fleet.noSpec)}</p>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {item.specs.map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-display font-bold text-gms-corp">{s.label}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div><dt className="text-xs text-slate-500">{l(C.fleet.tires)}</dt><dd className="font-semibold text-gms-ink">{s.tires} {l(C.fleet.tiresUnit)}</dd></div>
                    <div><dt className="text-xs text-slate-500">{l(C.fleet.capacity)}</dt><dd className="flex items-center gap-1 font-semibold text-gms-ink"><Weight size={13} className="text-gms-gold" aria-hidden />{s.capacity}</dd></div>
                    <div className="col-span-2"><dt className="text-xs text-slate-500">{l(C.fleet.dimensions)}</dt><dd className="font-semibold text-gms-ink">{s.dimensions}</dd></div>
                    <div><dt className="text-xs text-slate-500">{l(C.fleet.volume)}</dt><dd className="flex items-center gap-1 font-semibold text-gms-ink"><Box size={13} className="text-gms-gold" aria-hidden />{s.volume}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          )}

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-gms-gold">{l(C.fleet.useCase)}</p>
          <ul className="mt-2 grid gap-1.5 text-base text-gms-ink sm:grid-cols-2">
            {item.useCases.map((u) => (
              <li key={u.en} className="flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gms-gold" />{l(u)}</li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => onRequest(item)}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-gms-gold px-6 font-bold text-gms-deep transition-colors hover:bg-gms-bright sm:w-auto"
          >
            {l(C.fleet.requestFleet)} <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export function FleetFinder({ onPick }: { onPick: (g: FleetGroup) => void }) {
  const l = useL();
  const [sel, setSel] = useState<string | null>(null);
  const cargo = cargoTypes.find((c) => c.id === sel);
  // Same 23 vehicles (and photos) as the Armada section, filtered by cargo type.
  const results = useMemo(() => (cargo ? fleetVehicles.filter((f) => cargo.groups.includes(f.group)) : []), [cargo]);
  return (
    <section id="finder" className="scroll-mt-16 bg-gms-sky py-20 sm:py-24">
      <Container>
        <SectionHeader title={l(C.finder.title)} sub={l(C.finder.sub)} />
        <Reveal className="mx-auto mt-10 max-w-4xl rounded-3xl bg-white p-6 shadow-lg sm:p-8">
          <p id="finder-label" className="text-base font-bold text-gms-corp">{l(C.finder.label)}</p>
          <div role="radiogroup" aria-labelledby="finder-label" className="mt-3 flex flex-wrap gap-2">
            {cargoTypes.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={sel === c.id}
                onClick={() => setSel(c.id)}
                className={`min-h-11 rounded-full border-2 px-4 text-base font-semibold transition-colors ${
                  sel === c.id ? "border-gms-gold bg-gms-corp text-white" : "border-slate-200 text-gms-corp hover:border-gms-gold"
                }`}
              >
                {l(c.label)}
              </button>
            ))}
          </div>
          <div className="mt-6 border-t border-slate-100 pt-6" aria-live="polite">
            {!cargo ? (
              <p className="text-base text-slate-500">{l(C.finder.hint)}</p>
            ) : (
              <>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-gms-gold">{l(C.finder.result)}</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {results.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => { onPick(f.group); scrollToSection("armada"); }}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-gms-gold hover:bg-gms-mist"
                      >
                        <span className="h-14 w-24 shrink-0 overflow-hidden rounded-md bg-gms-mist">
                          <img src={f.src} alt={f.alt} width={1536} height={1024} loading="lazy" decoding="async" className="h-full w-full object-contain" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display font-bold text-gms-corp">{f.name}</span>
                          <span className="block truncate text-xs text-slate-500">{f.bodies.join(" · ")}</span>
                        </span>
                        <ArrowRight size={16} className="shrink-0 text-gms-gold" aria-hidden />
                        <span className="sr-only">{l(C.finder.viewAll)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-slate-500">{l(C.finder.note)}</p>
              </>
            )}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export function Fleet({
  group,
  setGroup,
  onRequest,
}: {
  group: "all" | FleetGroup;
  setGroup: (g: "all" | FleetGroup) => void;
  onRequest: (f: FleetItem) => void;
}) {
  const l = useL();
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<{ item: FleetItem; src: string } | null>(null);

  // One card per vehicle photo, light -> heavy. Search looks at the vehicle name,
  // its body labels and the group's fleetData (names, bodies, spec labels, use cases).
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fleetVehicles.filter((vh) => {
      if (group !== "all" && vh.group !== group) return false;
      if (!q) return true;
      const hay = [
        vh.name,
        ...vh.bodies,
        ...fleetData
          .filter((f) => f.group === vh.group)
          .flatMap((f) => [f.name, ...f.specs.map((sp) => sp.label), f.length?.[language] ?? "", ...f.useCases.map((u) => u[language])]),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [group, query, language]);

  return (
    <section id="armada" className="scroll-mt-16 bg-white py-20 sm:py-24">
      <Container>
        <SectionHeader title={l(C.fleet.title)} sub={l(C.fleet.sub)} large />
        <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FleetFilter value={group} onChange={setGroup} />
          <div className="relative w-full lg:max-w-xs">
            <label htmlFor="fleet-search" className="sr-only">{l(C.fleet.searchLabel)}</label>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="fleet-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={l(C.fleet.searchPlaceholder)}
              className="min-h-11 w-full rounded-full border border-slate-300 bg-white pl-10 pr-4 text-base text-gms-ink focus:border-gms-gold focus:outline-none focus:ring-2 focus:ring-gms-gold/30"
            />
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500" aria-live="polite">{list.length} {l(C.fleet.count)}</p>

        {list.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-gms-mist p-10 text-center">
            <p className="text-base text-slate-600">{l(C.fleet.empty)}</p>
            <button
              type="button"
              onClick={() => { setQuery(""); setGroup("all"); }}
              className="mt-4 rounded-lg bg-gms-corp px-5 py-2.5 text-base font-bold text-white hover:bg-gms-navy"
            >
              {l(C.fleet.reset)}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((vh, i) => (
              <FleetCard key={vh.id} vehicle={vh} onOpen={(it, src) => setOpen({ item: it, src })} delay={(i % 3) * 60} />
            ))}
          </div>
        )}
      </Container>
      <FleetDetailModal
        item={open?.item ?? null}
        initialSrc={open?.src}
        onClose={() => setOpen(null)}
        onRequest={(f) => { setOpen(null); onRequest(f); }}
      />
    </section>
  );
}
