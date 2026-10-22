import { ArrowLeft, Building2, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PublicLayout } from "../../components/layout/PublicLayout";
import { useLanguage } from "../../store/LanguageContext";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const COMPANY_VALUE_ICONS = [ShieldCheck, PackageCheck, Truck];

export default function About() {
  const { t } = useLanguage();
  useDocumentTitle(t.nav.about);
  const navigate = useNavigate();
  return (
    <PublicLayout>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> {t.trackingResult.back}
      </button>

      <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-900 text-white">
          <Building2 size={22} />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">{t.about.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.about.p1}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.about.p2}</p>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {t.companyValues.map((v, i) => {
          const Icon = COMPANY_VALUE_ICONS[i];
          return (
            <div key={v.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
                <Icon size={18} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">{v.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{v.desc}</p>
            </div>
          );
        })}
      </section>
    </PublicLayout>
  );
}
