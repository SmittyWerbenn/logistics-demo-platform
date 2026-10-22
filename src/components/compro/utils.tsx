import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { useLanguage } from "../../store/LanguageContext";
import type { L } from "../../data/compro/fleetData";

/** Returns a resolver for bilingual text objects, following the language switcher. */
export function useL() {
  const { language } = useLanguage();
  return (v: L) => v[language];
}

/** Fade/slide-up when scrolled into view (CSS .reveal). */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? "is-in" : ""} ${className}`}
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** Counts up a value like "9.355+" / "28 Ton" once visible; non-numeric values render as-is. */
export function CountUp({ value }: { value: string }) {
  const match = value.match(/^(\d[\d.]*)(.*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(value);
  useEffect(() => {
    if (!match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const hasThousand = /^\d{1,3}(\.\d{3})+$/.test(match[1]);
    const target = parseFloat(hasThousand ? match[1].replace(/\./g, "") : match[1]);
    const suffix = match[2];
    const fmt = (n: number) => (hasThousand ? Math.round(n).toLocaleString("id-ID") : String(Math.round(n)));
    setText(fmt(0) + suffix);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / 1100);
        setText(fmt(target * (1 - Math.pow(1 - p, 3))) + suffix);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={ref}>{text}</span>;
}

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
