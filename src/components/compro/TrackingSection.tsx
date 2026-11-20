import { CheckCircle2, Loader2, Search, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../../data/compro/content";
import { Captcha } from "../Captcha";
import { useTrackingGate } from "../../utils/useTrackingGate";
import { Container, SectionHeader } from "./SectionHeader";
import { Reveal, useL } from "./utils";

export function TrackingForm() {
  const l = useL();
  const navigate = useNavigate();
  const [awb, setAwb] = useState("");
  const [error, setError] = useState<"" | "required" | "notFound">("");
  const [busy, setBusy] = useState(false);
  const gate = useTrackingGate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = awb.trim();
    if (!v) return setError("required");
    setBusy(true);
    setError("");
    try {
      const res = await gate.lookup(v);
      if (res === "blocked") return;
      if (res) navigate(`/tracking/${encodeURIComponent(v)}`);
      else setError("notFound");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto mt-10 max-w-2xl">
      <label htmlFor="compro-awb" className="sr-only">{l(C.tracking.label)}</label>
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 text-left shadow-xl">
        <input
          id="compro-awb"
          value={awb}
          onChange={(e) => { setAwb(e.target.value); setError(""); }}
          placeholder={l(C.tracking.placeholder)}
          aria-invalid={error !== ""}
          aria-describedby={error ? "compro-awb-err" : undefined}
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-gms-ink placeholder:text-slate-400 focus:border-gms-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gms-gold"
        />
        {gate.needsCaptcha && <Captcha ref={gate.captchaRef} idPrefix="home-trk" compact value={gate.code} onChange={gate.setCode} error={gate.error} />}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gms-gold px-6 font-bold text-gms-deep transition-colors hover:bg-gms-bright disabled:opacity-70"
        >
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Search size={18} aria-hidden />}
          {busy ? l(C.tracking.checking) : l(C.tracking.button)}
        </button>
      </div>
      {error && (
        <p id="compro-awb-err" role="alert" className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          <TriangleAlert size={16} aria-hidden /> {l(error === "required" ? C.tracking.required : C.tracking.notFound)}
        </p>
      )}
    </form>
  );
}

export function TrackingSection() {
  const l = useL();
  return (
    <section id="tracking" className="relative scroll-mt-16 overflow-hidden bg-gms-corp py-20 sm:py-24">
      <div aria-hidden className="absolute -right-16 top-0 h-full w-32 skew-x-[-18deg] bg-gms-gold/15" />
      <Container className="relative">
        <SectionHeader dark title={l(C.tracking.title)} sub={l(C.tracking.sub)} />
        <Reveal><TrackingForm /></Reveal>
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-blue-100/85">
          {C.tracking.feats.map((f) => (
            <li key={f.en} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-gms-gold" aria-hidden />{l(f)}</li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
