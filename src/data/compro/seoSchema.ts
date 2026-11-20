import { SITE_URL } from "./config";
import { services } from "./servicesData";

/** Organization schema for the homepage - every field is either a fixed,
 * real fact (name/legal name/url/logo) or passed in from the live contact
 * settings, never invented. */
export function buildOrganizationSchema(opts: { description: string; telephone: string; email: string; address: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "GMS Logistics",
    legalName: "PT Gangsar Mitra Suatama",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    image: `${SITE_URL}/favicon.png`,
    description: opts.description,
    telephone: opts.telephone,
    email: opts.email,
    address: { "@type": "PostalAddress", streetAddress: opts.address, addressCountry: "ID" },
    areaServed: "ID",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: opts.telephone,
      email: opts.email,
      contactType: "customer service",
      areaServed: "ID",
    },
    // Real service lineup from the Layanan section's own data - not invented.
    makesOffer: services.map((s) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: s.fullName.id,
        description: s.description.id,
      },
    })),
  };
}

export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "GMS Logistics",
    url: SITE_URL,
    inLanguage: "id-ID",
  };
}
