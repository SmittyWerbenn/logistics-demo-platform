import { Loader2, RotateCw } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useLanguage } from "../store/LanguageContext";
import { fetchCaptcha, type CaptchaChallenge } from "../utils/captchaApi";

export interface CaptchaHandle {
  /** New challenge (old one becomes invalid on the server by expiry/attempts; the input is cleared). */
  refresh: () => void;
  /** Current challenge id to send with the request. */
  id: () => string;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Inline error text (already localised). */
  error?: string;
  /** Tighter layout for the tracking form. */
  compact?: boolean;
  idPrefix: string;
}

const T = {
  title: { id: "Verifikasi Keamanan", en: "Security Verification" },
  hint: { id: "Masukkan kode yang terlihat pada gambar", en: "Enter the code shown in the image" },
  label: { id: "Kode CAPTCHA", en: "CAPTCHA code" },
  placeholder: { id: "Masukkan kode", en: "Enter code" },
  refresh: { id: "Muat ulang kode CAPTCHA", en: "Refresh CAPTCHA code" },
  imageAlt: { id: "Gambar kode CAPTCHA", en: "CAPTCHA code image" },
  loadFail: { id: "Verifikasi keamanan sedang mengalami gangguan. Silakan coba lagi.", en: "Security verification is temporarily unavailable. Please try again." },
  retry: { id: "Coba lagi", en: "Retry" },
};

/** Server-generated CAPTCHA image + code input. The answer never reaches the browser. */
export const Captcha = forwardRef<CaptchaHandle, Props>(function Captcha({ value, onChange, error, compact, idPrefix }, ref) {
  const { language } = useLanguage();
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const idRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setFailed(false);
    onChangeRef.current("");
    try {
      const c = await fetchCaptcha();
      if (my !== seq.current) return;
      idRef.current = c.id;
      setChallenge(c);
    } catch {
      if (my === seq.current) {
        idRef.current = "";
        setChallenge(null);
        setFailed(true);
      }
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Silently swap in a fresh code when this one expires (5 min).
  useEffect(() => {
    if (!challenge) return;
    const ms = challenge.expiresAt - Date.now() - 1000;
    const t = setTimeout(() => void load(), Math.max(ms, 1000));
    return () => clearTimeout(t);
  }, [challenge, load]);

  useImperativeHandle(ref, () => ({ refresh: () => void load(), id: () => idRef.current, focus: () => inputRef.current?.focus() }), [load]);

  const tx = (k: keyof typeof T) => T[k][language];
  const inputId = `${idPrefix}-captcha`;
  const src = challenge ? `data:image/svg+xml;utf8,${encodeURIComponent(challenge.image)}` : "";

  return (
    <div className={compact ? "" : "rounded-2xl border border-slate-200 bg-gms-mist p-4"}>
      {!compact && (
        <>
          <p className="text-base font-bold text-gms-corp">{tx("title")}</p>
          <p className="mt-0.5 text-sm text-slate-600">{tx("hint")}</p>
        </>
      )}
      <div className={`flex items-stretch gap-2 ${compact ? "" : "mt-3"}`}>
        <div className="relative flex h-16 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-gms-gold/40 bg-gradient-to-br from-gms-mist to-gms-sky sm:h-[4.5rem] sm:max-w-[16rem]">
          {src && !loading ? (
            <img src={src} alt={tx("imageAlt")} className="h-full w-full select-none object-contain" draggable={false} />
          ) : loading ? (
            <Loader2 size={20} className="animate-spin text-gms-corp" aria-hidden />
          ) : (
            <span className="px-2 text-center text-xs font-semibold text-red-600">{tx("loadFail")}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label={tx("refresh")}
          title={tx("refresh")}
          className="inline-flex h-16 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-gms-corp transition-colors hover:border-gms-gold hover:text-gms-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gms-gold disabled:opacity-60 sm:h-[4.5rem]"
        >
          <RotateCw size={18} className={loading ? "animate-spin" : ""} aria-hidden />
        </button>
      </div>
      <label htmlFor={inputId} className="mb-1 mt-3 block text-sm font-semibold text-gms-corp">
        {tx("label")} <span className="text-red-600" aria-hidden>*</span>
      </label>
      <input
        id={inputId}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
        placeholder={tx("placeholder")}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        maxLength={8}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-err` : undefined}
        className={`min-h-12 w-full rounded-xl border bg-white px-3.5 font-mono text-lg font-bold uppercase tracking-[0.3em] text-gms-ink placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 ${error ? "border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-gms-gold focus:ring-gms-gold/30"}`}
      />
      {failed && (
        <button type="button" onClick={() => void load()} className="mt-1 text-xs font-semibold text-gms-corp underline">
          {tx("retry")}
        </button>
      )}
      {error && (
        <p id={`${inputId}-err`} role="alert" className="mt-1 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
