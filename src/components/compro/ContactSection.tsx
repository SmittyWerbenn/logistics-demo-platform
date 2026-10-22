import { Clock, Loader2, Mail, MapPin, MessageCircle, Phone, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { C } from "../../data/compro/content";
import { services } from "../../data/compro/servicesData";
import { toTelHref, useHelpContact } from "../../store/HelpContactContext";
import { Captcha, type CaptchaHandle } from "../Captcha";
import { api } from "../../utils/apiClient";
import { CAPTCHA_MESSAGES, captchaFailureOf } from "../../utils/captchaApi";
import { useLanguage } from "../../store/LanguageContext";
import { Container, SectionHeader } from "./SectionHeader";
import { Reveal, useL } from "./utils";

/** Jenis Pengiriman options come from the company profile's service list (LTL, FTL, FCL, ...). */
const typeLabel = (id: string, lang: "id" | "en") => {
  const sv = services.find((x) => x.id === id);
  if (!sv) return id;
  return sv.fullName[lang] === sv.name ? sv.name : `${sv.name} (${sv.fullName[lang]})`;
};

interface FormState { name: string; company: string; email: string; phone: string; type: string; origin: string; destination: string; message: string }
const EMPTY: FormState = { name: "", company: "", email: "", phone: "", type: "", origin: "", destination: "", message: "" };
type Errors = Partial<Record<keyof FormState, "required" | "email" | "phone">>;

export function ContactForm({ prefillMessage }: { prefillMessage: string }) {
  const l = useL();
  const { language } = useLanguage();
  const { helpWhatsAppNumber } = useHelpContact();
  const [v, setV] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [noNumber, setNoNumber] = useState(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [serverError, setServerError] = useState("");
  const captchaRef = useRef<CaptchaHandle>(null);
  const f = C.contact.form;

  useEffect(() => {
    if (prefillMessage) setV((s) => ({ ...s, message: prefillMessage }));
  }, [prefillMessage]);

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
    setDone(false);
    setNoNumber(false);
  };

  function validate(): Errors {
    const er: Errors = {};
    (["name", "email", "phone", "type", "origin", "destination"] as const).forEach((k) => {
      if (!v[k].trim()) er[k] = "required";
    });
    if (!er.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) er.email = "email";
    if (!er.phone && v.phone.replace(/\D/g, "").length < 8) er.phone = "phone";
    return er;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const er = validate();
    setErrors(er);
    setServerError("");
    const code = captchaCode.trim();
    if (!code) {
      setCaptchaError(l(CAPTCHA_MESSAGES.required));
      captchaRef.current?.focus();
    } else {
      setCaptchaError("");
    }
    if (Object.keys(er).length || !code) return;
    // No valid WhatsApp CS number configured: don't pretend it was sent.
    if (!helpWhatsAppNumber) {
      setNoNumber(true);
      return;
    }
    const lines = [
      `📋 *REQUEST QUOTATION*`,
      `🏢 GMS Logistics`,
      ``,
      `👤 ${f.name[language]}: *${v.name}*`,
      v.company && `🏭 ${f.company[language]}: *${v.company}*`,
      `📧 ${f.email[language]}: ${v.email}`,
      `📱 ${f.phone[language]}: ${v.phone}`,
      ``,
      `🚚 ${f.type[language]}: *${typeLabel(v.type, language)}*`,
      `📍 ${f.origin[language]}: *${v.origin}*`,
      `📍 ${f.destination[language]}: *${v.destination}*`,
      v.message && ``,
      v.message && `💬 ${f.message[language]}:`,
      v.message && `_${v.message}_`,
      ``,
      `---`,
      `${new Date().toLocaleString(language === "id" ? "id-ID" : "en-US")}`,
    ].filter(Boolean);
    setBusy(true);
    // Open the tab inside the click (mobile browsers block popups opened after an await).
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    try {
      // The server checks the CAPTCHA (single use, 5 min, 5 attempts), rate-limits and validates before accepting.
      await api.post(
        "/api/public/quotation",
        {
          nama: v.name, perusahaan: v.company, email: v.email, telepon: v.phone, jenisPengiriman: typeLabel(v.type, language),
          asal: v.origin, tujuan: v.destination, pesan: v.message,
          captchaId: captchaRef.current?.id() ?? "", captchaCode: code,
        },
        { auth: false },
      );
      const url = `https://wa.me/${helpWhatsAppNumber}?text=${encodeURIComponent(lines.join(String.fromCharCode(10)))}`;
      if (win) win.location.href = url;
      else window.location.href = url;
      setDone(true);
      captchaRef.current?.refresh();
    } catch (err) {
      win?.close();
      const kind = captchaFailureOf(err);
      if (kind === "required" || kind === "invalid" || kind === "expired" || kind === "tooMany") {
        setCaptchaError(l(CAPTCHA_MESSAGES[kind]));
      } else if (kind) {
        setServerError(l(CAPTCHA_MESSAGES[kind]));
      } else {
        setServerError(err instanceof Error ? err.message : l(CAPTCHA_MESSAGES.server));
      }
      captchaRef.current?.refresh();
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof FormState, label: string, opts: { type?: string; optional?: boolean; autoComplete?: string } = {}) => {
    const err = errors[k];
    const msg = err ? (err === "required" ? `${label} ${l(f.errors.required)}` : l(f.errors[err])) : "";
    return (
      <div>
        <label htmlFor={`cf-${k}`} className="mb-1 block text-base font-semibold text-gms-corp">
          {label}{" "}
          {opts.optional ? <span className="font-normal text-slate-400">({l(f.optional)})</span> : <span className="text-red-600" aria-hidden>*</span>}
        </label>
        <input
          id={`cf-${k}`}
          type={opts.type ?? "text"}
          value={v[k]}
          onChange={set(k)}
          autoComplete={opts.autoComplete}
          aria-invalid={!!err}
          aria-describedby={err ? `cf-${k}-err` : undefined}
          className={`min-h-11 w-full rounded-lg border bg-white px-3.5 text-base text-gms-ink focus:outline-none focus:ring-2 ${err ? "border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-gms-gold focus:ring-gms-gold/30"}`}
        />
        {err && <p id={`cf-${k}-err`} role="alert" className="mt-1 text-xs font-semibold text-red-600">{msg}</p>}
      </div>
    );
  };

  const typeErr = errors.type;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-3xl bg-white p-6 shadow-lg sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", l(f.name), { autoComplete: "name" })}
        {field("company", l(f.company), { optional: true, autoComplete: "organization" })}
        {field("email", l(f.email), { type: "email", autoComplete: "email" })}
        {field("phone", l(f.phone), { type: "tel", autoComplete: "tel" })}
      </div>
      <div>
        <label htmlFor="cf-type" className="mb-1 block text-base font-semibold text-gms-corp">{l(f.type)} <span className="text-red-600" aria-hidden>*</span></label>
        <select id="cf-type" value={v.type} onChange={set("type")} aria-invalid={!!typeErr} aria-describedby={typeErr ? "cf-type-err" : undefined}
          className={`min-h-11 w-full rounded-lg border bg-white px-3 text-base text-gms-ink focus:outline-none focus:ring-2 ${typeErr ? "border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-gms-gold focus:ring-gms-gold/30"}`}>
          <option value="">{l(f.choose)}</option>
          {services.map((sv) => <option key={sv.id} value={sv.id}>{typeLabel(sv.id, language)}</option>)}
        </select>
        {typeErr && <p id="cf-type-err" role="alert" className="mt-1 text-xs font-semibold text-red-600">{l(f.type)} {l(f.errors.required)}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("origin", l(f.origin))}
        {field("destination", l(f.destination))}
      </div>
      <div>
        <label htmlFor="cf-message" className="mb-1 block text-base font-semibold text-gms-corp">{l(f.message)} <span className="font-normal text-slate-400">({l(f.optional)})</span></label>
        <textarea id="cf-message" rows={4} value={v.message} onChange={set("message")} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-gms-ink focus:border-gms-gold focus:outline-none focus:ring-2 focus:ring-gms-gold/30" />
      </div>
      <Captcha ref={captchaRef} idPrefix="cf" value={captchaCode} onChange={(c) => { setCaptchaCode(c); if (c) setCaptchaError(""); }} error={captchaError} />
      {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{serverError}</p>}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"><TriangleAlert size={16} aria-hidden />{l(f.errors.fix)}</p>
      )}
      {noNumber && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {language === "id"
            ? "Nomor WhatsApp CS belum dikonfigurasi. Silakan hubungi kami lewat email atau telepon."
            : "The WhatsApp CS number has not been configured. Please contact us by email or phone."}
        </p>
      )}
      {done && <p role="status" className="rounded-lg bg-gms-soft px-3 py-2 text-sm font-semibold text-gms-corp">{l(f.sent)}</p>}
      <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gms-corp px-6 font-bold text-white transition-colors hover:bg-gms-navy disabled:opacity-70">
        {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {busy ? l(f.sending) : l(f.submit)}
      </button>
    </form>
  );
}

export function ContactSection({ prefillMessage }: { prefillMessage: string }) {
  const l = useL();
  const { helpPhoneDisplay, helpWhatsAppNumber, contactPhone, contactEmail, contactHours, headOffice } = useHelpContact();
  const items = [
    { icon: Mail, label: C.contact.email, value: contactEmail, href: `mailto:${contactEmail}` },
    { icon: Phone, label: C.contact.phone, value: contactPhone, href: toTelHref(contactPhone) },
    ...(helpWhatsAppNumber
      ? [{ icon: MessageCircle, label: C.contact.whatsapp, value: helpPhoneDisplay, href: `https://wa.me/${helpWhatsAppNumber}` }]
      : []),
    { icon: MapPin, label: C.contact.address, value: headOffice },
    { icon: Clock, label: C.contact.hours, value: contactHours },
  ];
  return (
    <section id="kontak" className="scroll-mt-16 bg-gms-sky py-20 sm:py-24">
      <Container>
        <SectionHeader title={l(C.contact.title)} sub={l(C.contact.sub)} large />
        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <ul className="grid gap-3">
              {items.map((it) => {
                const body = (
                  <>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gms-corp text-gms-light"><it.icon size={19} aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold uppercase tracking-wider text-gms-gold">{l(it.label)}</span>
                      <span className="block break-words text-lg font-semibold text-gms-corp">{it.value}</span>
                    </span>
                  </>
                );
                return (
                  <li key={it.label.en}>
                    {it.href ? (
                      <a href={it.href} target={it.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl bg-white p-4 transition-shadow hover:shadow-md">{body}</a>
                    ) : (
                      <div className="flex items-center gap-4 rounded-2xl bg-white p-4">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Reveal>
          <Reveal className="lg:col-span-3" delay={80}><ContactForm prefillMessage={prefillMessage} /></Reveal>
        </div>
      </Container>
    </section>
  );
}
