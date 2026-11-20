import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { About } from "../../components/compro/About";
import { Clients, CTASection } from "../../components/compro/Clients";
import { ContactSection } from "../../components/compro/ContactSection";
import { Coverage } from "../../components/compro/Coverage";
import { Fleet, FleetFinder } from "../../components/compro/Fleet";
import { FleetStats } from "../../components/compro/FleetStats";
import { Footer } from "../../components/compro/Footer";
import { Hero } from "../../components/compro/Hero";
import { JourneyCarousel } from "../../components/compro/JourneyCarousel";
import { Navbar } from "../../components/compro/Navbar";
import { ServicesExplorer } from "../../components/compro/ServicesExplorer";
import { scrollToSection, useL } from "../../components/compro/utils";
import { WhyUs } from "../../components/compro/WhyUs";
import { C } from "../../data/compro/content";
import { buildOrganizationSchema, buildWebsiteSchema } from "../../data/compro/seoSchema";
import type { FleetGroup, FleetItem } from "../../data/compro/fleetData";
import { useHelpContact } from "../../store/HelpContactContext";
import { useLanguage } from "../../store/LanguageContext";
import { useSeo } from "../../utils/seo";

function useHomeSeo() {
  const { language } = useLanguage();
  const { contactPhone, contactEmail, headOffice } = useHelpContact();
  useSeo({
    title: C.seo.title[language],
    description: C.seo.description[language],
    path: "/",
    jsonLd: [
      buildOrganizationSchema({
        description: C.seo.description[language],
        telephone: contactPhone,
        email: contactEmail,
        address: headOffice,
      }),
      buildWebsiteSchema(),
    ],
  });
}

export default function Home() {
  const l = useL();
  const location = useLocation();
  const [group, setGroup] = useState<"all" | FleetGroup>("all");
  const [prefill, setPrefill] = useState("");
  const { language } = useLanguage();
  useHomeSeo();

  useEffect(() => {
    const id = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (id) setTimeout(() => scrollToSection(id), 50);
  }, [location.state]);

  // pickService callback no longer needed; ServicesExplorer manages its own state
  const requestFleet = useCallback(
    (f: FleetItem) => {
      setPrefill(`${C.contact.form.fleetPrefix[language]}: ${f.name}`);
      scrollToSection("kontak");
    },
    [language],
  );

  return (
    <div className="compro min-h-screen bg-white font-sans text-gms-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-gms-gold focus:px-4 focus:py-2 focus:font-bold focus:text-gms-deep">
        {l(C.nav.skip)}
      </a>
      <Navbar overlay />
      <main id="main">
        <Hero />
        <About />
        <ServicesExplorer />
        <WhyUs />
        <JourneyCarousel />
        <Fleet group={group} setGroup={setGroup} onRequest={requestFleet} />
        <FleetStats />
        <FleetFinder onPick={setGroup} />
        <Coverage />
        <Clients />
        <CTASection />
        <ContactSection prefillMessage={prefill} />
      </main>
      <Footer />
      {/* Mobile sticky CTA - REMOVED */}
    </div>
  );
}
