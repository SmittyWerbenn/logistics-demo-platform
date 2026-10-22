import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { services, type ServiceId } from "../../data/compro/servicesData";
import { tr } from "../../data/compro/servicesData";
import { useLanguage } from "../../store/LanguageContext";
import { serviceAssets } from "../../data/compro/assetsMap";

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function ServicesExplorer() {
  const [activeId, setActiveId] = useState<ServiceId>("ltl");
  const { language } = useLanguage();

  const active = services.find((s) => s.id === activeId);
  if (!active) return null;

  const requestQuote = () => {
    scrollToSection("kontak");
    window.sessionStorage.setItem("selectedService", activeId);
  };

  return (
    <section id="layanan" className="relative py-16 md:py-24 bg-white">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-5xl md:text-6xl font-bold text-[#071B41]">
            {language === "id" ? "Layanan Logistik Modern" : "Modern Logistics Services"}
          </h2>
          <p className="text-2xl text-gray-600 max-w-2xl mx-auto">
            {language === "id"
              ? "Solusi transportasi lengkap untuk setiap kebutuhan pengiriman Anda"
              : "Complete transportation solutions for all your shipping needs"}
          </p>
        </div>

        {/* Service Tab Selector - Segmented Control Style */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8">
          {services.map((svc) => (
            <button
              key={svc.id}
              onClick={() => setActiveId(svc.id)}
              className={`px-4 md:px-5 py-2.5 md:py-3 rounded-lg font-semibold text-lg md:text-xl transition-all duration-300 ${
                activeId === svc.id
                  ? "bg-[#0B2553] text-white shadow-lg scale-105"
                  : "bg-[#EAF0F8] text-[#0B2553] hover:bg-[#D4A72C] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <svc.icon size={18} />
                {svc.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Service Detail Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Service Image from Assets */}
          <div className="relative bg-gradient-to-br from-[#EAF0F8] to-[#F4F7FC] rounded-2xl p-6 md:p-8 shadow-sm border border-[#D4A72C] border-opacity-20 overflow-hidden">
            <img
              src={serviceAssets[activeId]}
              alt={`${active.name} service illustration`}
              loading="lazy"
              className="w-full h-auto object-cover rounded-lg"
            />

            {/* Active badge */}
            <div className="absolute top-4 right-4 bg-[#D4A72C] text-[#071B41] px-3 py-1.5 rounded-full text-xs font-bold uppercase">
              {language === "id" ? "Aktif" : "Active"}
            </div>
          </div>

          {/* Right: Service Details & Info */}
          <div className="space-y-6">
            {/* Title & Description */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-[#D4A72C] p-3 rounded-lg flex-shrink-0">
                  <active.icon size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-4xl md:text-5xl font-bold text-[#071B41]">{active.name}</h3>
                  <p className="text-lg text-[#0B2553] font-semibold">
                    {tr(active.fullName, language)}
                  </p>
                </div>
              </div>

              <p className="text-gray-700 text-xl leading-relaxed mt-4">
                {tr(active.description, language)}
              </p>
            </div>

            {/* Service Info Cards - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: language === "id" ? "Moda" : "Mode", value: active.mode },
                { label: language === "id" ? "Kapasitas" : "Capacity", value: active.capacity },
                { label: language === "id" ? "Kecepatan" : "Speed", value: active.speed },
                { label: language === "id" ? "Biaya" : "Cost", value: active.cost },
              ].map((info, idx) => (
                <div key={idx} className="bg-[#EAF0F8] p-4 rounded-lg border border-[#D4A72C] border-opacity-20">
                  <p className="text-base font-semibold text-[#0B2553] uppercase tracking-wide mb-1">
                    {info.label}
                  </p>
                  <p className="text-lg font-bold text-[#071B41]">{tr(info.value, language)}</p>
                </div>
              ))}
            </div>

            {/* Use Cases */}
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[#0B2553] uppercase tracking-wide">
                {language === "id" ? "Cocok untuk" : "Ideal for"}
              </p>
              <ul className="space-y-2">
                {active.useCases.map((uc, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-lg text-gray-700">
                    <Check size={18} className="text-[#D4A72C] flex-shrink-0 mt-0.5" />
                    <span>{tr(uc, language)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3 pt-4">
              <button className="flex-1 bg-[#0B2553] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#071B41] transition-all duration-300 flex items-center justify-center gap-2">
                {language === "id" ? "Pelajari " + active.name : "Learn " + active.name}
                <ArrowRight size={18} />
              </button>
              <button
                onClick={requestQuote}
                className="flex-1 bg-[#D4A72C] text-[#071B41] font-semibold py-3 px-4 rounded-lg hover:bg-[#E5B83B] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {language === "id" ? "Minta Penawaran" : "Request Quote"}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table - Desktop */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-16 hidden md:block">
        <div className="text-center mb-8">
          <h3 className="text-4xl font-bold text-[#071B41] mb-2">
            {language === "id" ? "Bandingkan Semua Layanan" : "Compare All Services"}
          </h3>
          <p className="text-gray-600 text-xl">
            {language === "id"
              ? "Pilih layanan yang paling sesuai dengan kebutuhan Anda"
              : "Choose the service that best suits your needs"}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#D4A72C] border-opacity-20">
          <table className="w-full bg-white">
            <thead>
              <tr className="bg-[#0B2553] text-white">
                <th className="px-6 py-4 text-left font-semibold text-lg">
                  {language === "id" ? "Layanan" : "Service"}
                </th>
                <th className="px-6 py-4 text-left font-semibold text-lg">
                  {language === "id" ? "Moda" : "Mode"}
                </th>
                <th className="px-6 py-4 text-left font-semibold text-lg">
                  {language === "id" ? "Kapasitas" : "Capacity"}
                </th>
                <th className="px-6 py-4 text-left font-semibold text-lg">
                  {language === "id" ? "Kecepatan" : "Speed"}
                </th>
                <th className="px-6 py-4 text-left font-semibold text-lg">
                  {language === "id" ? "Biaya" : "Cost"}
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr
                  key={svc.id}
                  className={`border-t border-[#D4A72C] border-opacity-20 cursor-pointer hover:bg-[#EAF0F8] transition ${
                    activeId === svc.id ? "bg-[#F7E9B5] bg-opacity-50" : ""
                  }`}
                  onClick={() => setActiveId(svc.id)}
                >
                  <td className="px-6 py-4 font-semibold text-lg text-[#071B41] flex items-center gap-2">
                    <svc.icon size={18} className="text-[#D4A72C]" />
                    {svc.name}
                  </td>
                  <td className="px-6 py-4 text-lg text-gray-700">{tr(svc.mode, language)}</td>
                  <td className="px-6 py-4 text-lg text-gray-700">{tr(svc.capacity, language)}</td>
                  <td className="px-6 py-4 text-lg text-gray-700">{tr(svc.speed, language)}</td>
                  <td className="px-6 py-4 text-lg text-gray-700">{tr(svc.cost, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
