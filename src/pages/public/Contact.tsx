import { ArrowLeft, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PublicLayout } from "../../components/layout/PublicLayout";
import { toTelHref, useHelpContact } from "../../store/HelpContactContext";
import { useLanguage } from "../../store/LanguageContext";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const CHANNEL_ICONS = [Phone, MessageCircle, Mail];

export default function Contact() {
  const { t } = useLanguage();
  useDocumentTitle(t.contact.title);
  const navigate = useNavigate();
  const { helpPhoneDisplay, helpWhatsAppNumber, contactPhone, contactEmail, headOffice, contactHours } =
    useHelpContact();
  const channelLabels = [t.contact.channelPhone, t.contact.channelWhatsapp, t.contact.channelEmail];
  const CHANNEL_VALUES = [
    { value: contactPhone, href: toTelHref(contactPhone) },
    // WhatsApp CS; with no valid number configured the card is shown without a link.
    { value: helpPhoneDisplay || "-", href: helpWhatsAppNumber ? `https://wa.me/${helpWhatsAppNumber}` : undefined },
    { value: contactEmail, href: `mailto:${contactEmail}` },
  ];

  return (
    <PublicLayout>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> {t.trackingResult.back}
      </button>

      <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{t.contact.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{t.contact.desc}</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {channelLabels.map((label, i) => {
            const Icon = CHANNEL_ICONS[i];
            const { value, href } = CHANNEL_VALUES[i];
            const Tag = href ? "a" : "div";
            return (
              <Tag
                key={label}
                href={href}
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href ? "noreferrer" : undefined}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
                  <Icon size={18} />
                </span>
                <span className="text-xs font-medium text-slate-400">{label}</span>
                <span className="text-sm font-semibold text-slate-800">{value}</span>
              </Tag>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div className="flex gap-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-400">{t.contact.hqLabel}</p>
              <p className="text-sm text-slate-700">{headOffice}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Clock size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-400">{t.contact.hoursLabel}</p>
              <p className="text-sm text-slate-700">{contactHours}</p>
            </div>
          </div>
        </div>

        <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          {t.contact.footNote} <span className="font-medium text-slate-700">{t.contact.footNoteLink}</span>.
        </p>
      </section>
    </PublicLayout>
  );
}
