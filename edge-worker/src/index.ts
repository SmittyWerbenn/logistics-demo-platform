/**
 * gms-edge - Cloudflare Worker that ties the three app origins together:
 *
 *   1. admin.gms-logistics.id  -> reverse-proxy to the public SPA on GitHub
 *      Pages (gms-logistics.id). The browser keeps the admin hostname, so the
 *      app's host-aware routing (src/utils/urls.ts detectPortal) shows the
 *      admin portal instead of the public site.
 *   2. driver.gms-logistics.id -> same, for the driver portal.
 *   3. temp-gms.frel.cloud     -> permanent redirects to the new structure
 *      (/admin* -> admin.gms-logistics.id, /driver* -> driver.gms-logistics.id,
 *      everything else -> gms-logistics.id with the path preserved).
 *
 * No state, no secrets. The API/email Workers keep their own workers.dev URLs
 * and are called directly by the browser, never through this proxy.
 */

const UPSTREAM = "https://gms-logistics.id";

function isLegacyHost(host: string): boolean {
  return host === "temp-gms.frel.cloud" || host === "www.temp-gms.frel.cloud";
}

function isPortalHost(host: string): boolean {
  return host === "admin.gms-logistics.id" || host === "driver.gms-logistics.id";
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname;

    // Legacy temporary domain -> permanent redirects to the new structure.
    // Portal prefixes are stripped: the subdomains now serve their portals at
    // the root (admin.gms-logistics.id/... instead of /admin/...).
    if (isLegacyHost(host)) {
      const path = url.pathname + url.search;
      let target: string;
      if (path.startsWith("/admin")) {
        target = `https://admin.gms-logistics.id${path.slice("/admin".length) || "/"}`;
      } else if (path.startsWith("/driver")) {
        target = `https://driver.gms-logistics.id${path.slice("/driver".length) || "/"}`;
      } else {
        target = `https://gms-logistics.id${path}`;
      }
      return Response.redirect(target, 301);
    }

    // Portal subdomains -> serve the same static SPA as the public site.
    if (isPortalHost(host)) {
      const upstream = `${UPSTREAM}${url.pathname}${url.search}`;
      const method = request.method === "HEAD" ? "HEAD" : "GET";
      let resp = await fetch(upstream, { method, redirect: "follow" });

      // SPA fallback: a non-asset 404 (e.g. a deep link such as
      // /admin/pengiriman) returns the app shell so react-router can render
      // the route client-side. Asset paths (with a file extension) are left
      // as real 404s so the index.html stale-asset reload guard still fires.
      if (resp.status === 404 && !/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
        resp = await fetch(`${UPSTREAM}/`, { method, redirect: "follow" });
      }
      return resp;
    }

    return new Response("Not found", { status: 404 });
  },
};
