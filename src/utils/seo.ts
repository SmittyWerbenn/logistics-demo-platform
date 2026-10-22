import { useEffect } from "react";
import { SITE_URL } from "../data/compro/config";
import { useLanguage } from "../store/LanguageContext";
import { detectPortal } from "./urls";

/** 256x256 brand mark - the only logo asset with a stable public URL (not
 * content-hashed by the build), so it's the only one safe to reference in
 * OG/Twitter meta before/without JS. */
const DEFAULT_OG_IMAGE = `${SITE_URL}/favicon.png`;

function setMetaByName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export interface SeoOptions {
  title: string;
  description: string;
  /** Path only (e.g. "/cek-ongkir") - the absolute canonical/OG URL is built
   * from SITE_URL + this, so it always self-canonicalizes to the primary
   * production domain regardless of which host actually served the page. */
  path: string;
  /** Defaults to "index,follow". Pass "noindex,follow" for pages with no
   * standalone SEO value (e.g. a per-AWB dynamic tracking result). */
  robots?: string;
  ogType?: string;
  ogImage?: string;
  /** One schema.org object, or several (e.g. Organization + WebSite). */
  jsonLd?: object | object[];
}

/** Sets title/meta/canonical/OG/Twitter/JSON-LD for the current page -
 * the SPA's only SEO mechanism (no server-side rendering), shared by every
 * public route so each gets a distinct, correct set of tags. Pages served
 * from the admin/driver subdomains are forced to noindex,nofollow
 * regardless of what's passed in, since nothing there should ever surface
 * in search results. */
export function useSeo(opts: SeoOptions) {
  const { language } = useLanguage();

  useEffect(() => {
    // Once any route has actually mounted via JS, the minimal static
    // Organization block from index.html (the pre-JS/no-JS fallback) is
    // superseded by this page's own tags below - remove it so a crawler
    // that DOES run JS never sees two Organization entries for the site.
    document.getElementById("seo-jsonld-static")?.remove();

    const canonicalUrl = `${SITE_URL}${opts.path}`;
    const portal = detectPortal();
    // null = localhost / legacy preview hosts mid-transition - treat as
    // public so authoring/preview still shows real tags.
    const isPublicPortal = portal === "public" || portal === null;
    const robots = isPublicPortal ? opts.robots ?? "index,follow" : "noindex,nofollow";

    document.title = opts.title;
    document.documentElement.lang = language;
    setMetaByName("description", opts.description);
    setMetaByName("robots", robots);
    setCanonical(canonicalUrl);
    setMetaByProperty("og:site_name", "GMS Logistics");
    setMetaByProperty("og:title", opts.title);
    setMetaByProperty("og:description", opts.description);
    setMetaByProperty("og:type", opts.ogType ?? "website");
    setMetaByProperty("og:url", canonicalUrl);
    setMetaByProperty("og:image", opts.ogImage ?? DEFAULT_OG_IMAGE);
    setMetaByProperty("og:locale", language === "id" ? "id_ID" : "en_US");
    setMetaByName("twitter:card", "summary_large_image");
    setMetaByName("twitter:title", opts.title);
    setMetaByName("twitter:description", opts.description);
    setMetaByName("twitter:image", opts.ogImage ?? DEFAULT_OG_IMAGE);

    const ids: string[] = [];
    if (opts.jsonLd) {
      const items = Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd];
      items.forEach((data, i) => {
        const id = `seo-jsonld-${i}`;
        document.getElementById(id)?.remove();
        const el = document.createElement("script");
        el.type = "application/ld+json";
        el.id = id;
        el.text = JSON.stringify(data);
        document.head.appendChild(el);
        ids.push(id);
      });
    }

    return () => {
      ids.forEach((id) => document.getElementById(id)?.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.title, opts.description, opts.path, opts.robots, opts.ogType, opts.ogImage, JSON.stringify(opts.jsonLd), language]);
}
