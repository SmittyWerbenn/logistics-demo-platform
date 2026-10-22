import { Calculator, Check, ChevronDown, Menu, Package, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logoIcon from "../../assets/icon-mark.png";
import { C } from "../../data/compro/content";
import type { Language } from "../../data/translations";
import { useLanguage } from "../../store/LanguageContext";
import { FlagEN, FlagID } from "../FlagIcon";
import { useL } from "./utils";

export const NAV_SECTIONS = [
  { id: "home", key: "home" },
  { id: "tentang", key: "about" },
  { id: "layanan", key: "services" },
  { id: "armada", key: "fleet" },
  { id: "coverage", key: "coverage" },
  { id: "kontak", key: "contact" },
] as const;

const LANGS: { value: Language; label: string; Flag: typeof FlagID }[] = [
  { value: "id", label: "Indonesia", Flag: FlagID },
  { value: "en", label: "English", Flag: FlagEN },
];

/** Language dropdown (flag + code, opens a list of languages). */
function LangSwitch({ solid }: { solid: boolean }) {
  const { language, setLanguage } = useLanguage();
  const l = useL();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const Current = LANGS.find((x) => x.value === language) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={l(C.nav.langLabel)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-base font-bold uppercase transition-colors sm:px-3 ${
          solid
            ? "border-slate-200 bg-gms-mist text-slate-700 hover:text-gms-corp"
            : "border-white/25 bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        <Current.Flag className="hidden h-3 w-4 rounded-[2px] min-[360px]:block" />
        {language}
        <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={l(C.nav.langLabel)}
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {LANGS.map(({ value, label, Flag }) => (
            <li key={value} role="option" aria-selected={language === value}>
              <button
                type="button"
                onClick={() => {
                  setLanguage(value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-base font-medium text-slate-700 hover:bg-gms-mist"
              >
                <Flag className="h-3.5 w-5 shrink-0 rounded-[2px]" />
                <span className="flex-1">{label}</span>
                {language === value && <Check size={15} className="text-gms-corp" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Navbar({ overlay }: { overlay: boolean }) {
  const l = useL();
  const { language } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");
  const navigate = useNavigate();
  const location = useLocation();
  const onHome = location.pathname === "/";
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy for the active (gold) menu item.
  useEffect(() => {
    if (!onHome) return;
    const els = NAV_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [onHome]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function go(id: string) {
    setOpen(false);
    if (onHome) {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate("/", { state: { scrollTo: id } });
    }
  }

  const solid = scrolled || !overlay || open;
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        solid ? "bg-white shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:h-24 lg:px-8">
        <Link to="/" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <img src={logoIcon} alt="GMS Logistics - PT Gangsar Mitra Suatama" className="h-9 w-9 shrink-0 object-contain min-[360px]:h-10 min-[360px]:w-10 min-[400px]:h-11 min-[400px]:w-11 sm:h-12 sm:w-12" />
          <span className="shrink-0 leading-tight">
            <span className={`block whitespace-nowrap font-display text-lg font-extrabold min-[360px]:text-xl min-[400px]:text-2xl sm:text-3xl ${solid ? "text-gms-corp" : "text-white"}`}>
              GMS Logistics
            </span>
            <span className={`hidden whitespace-nowrap text-lg sm:block ${solid ? "text-slate-500" : "text-white/70"}`}>
              {l(C.hero.eyebrow)}
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-0.5 xl:ml-8 xl:flex">
          {NAV_SECTIONS.map((s) => {
            const isActive = onHome && active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => go(s.id)}
                aria-current={isActive ? "true" : undefined}
                className={`relative whitespace-nowrap rounded-md px-2.5 py-2 text-xl font-semibold transition-colors ${
                  isActive
                    ? solid
                      ? "text-gms-gold"
                      : "text-gms-light"
                    : solid
                      ? "text-slate-700 hover:text-gms-corp"
                      : "text-white/85 hover:text-white"
                }`}
              >
                {l(C.nav[s.key])}
                <span
                  aria-hidden
                  className={`absolute inset-x-3 -bottom-0.5 h-0.5 rounded bg-gms-gold transition-transform ${
                    isActive ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LangSwitch solid={solid} />
          <button
            type="button"
            className={`rounded-md p-2 xl:hidden ${solid ? "text-gms-corp hover:bg-gms-sky" : "text-white hover:bg-white/10"}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? l(C.nav.closeMenu) : l(C.nav.openMenu)}
            aria-expanded={open}
            aria-controls="compro-mobile-menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="compro-mobile-menu"
          ref={menuRef}
          className="fixed inset-x-0 top-20 z-50 max-h-[calc(100vh-80px)] overflow-y-auto bg-white px-4 pb-8 pt-3 shadow-lg xl:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(s.id)}
                className={`flex min-h-12 items-center justify-between border-b border-slate-100 px-2 text-left text-2xl font-semibold ${
                  onHome && active === s.id ? "text-gms-gold" : "text-gms-corp"
                }`}
              >
                {l(C.nav[s.key])}
                <ChevronDown size={16} className="-rotate-90 text-slate-400" aria-hidden />
              </button>
            ))}
          </nav>
          <div className="mt-5 grid gap-2.5">
            <a
              href="https://gms-logistics.id/cek-ongkir"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gms-gold font-bold text-gms-deep"
            >
              <Calculator size={18} />
              {language === "id" ? "Cek Ongkir" : "Check Rates"}
            </a>
            <a
              href="https://gms-logistics.id/tracking"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-gms-gold font-bold text-gms-gold"
            >
              <Package size={18} />
              {language === "id" ? "Lacak Paket" : "Track Package"}
            </a>
            <button
              type="button"
              onClick={() => go("kontak")}
              className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-gms-corp font-bold text-gms-corp"
            >
              {l(C.hero.ctaQuote)}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
