/**
 * Canonical public-facing URLs for the GMS Logistics apps.
 *
 * The three portals are served from three origins now:
 *   - public site / tracking / cek ongkir  -> https://gms-logistics.id
 *   - admin dashboard                      -> https://admin.gms-logistics.id
 *   - driver portal                        -> https://driver.gms-logistics.id
 *
 * The API and email Workers keep their own (workers.dev) URLs, configured in
 * apiClient.ts / sendEmail.ts - those are intentionally NOT here and must not
 * be pointed at these app domains.
 */

const env = import.meta.env;
const basePath = (env.BASE_URL ?? "/").replace(/\/$/, "");
const origin = typeof window !== "undefined" ? window.location.origin + basePath : `http://localhost:5184${basePath}`;

export const PUBLIC_BASE_URL = (env.VITE_PUBLIC_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? origin;
export const ADMIN_BASE_URL = (env.VITE_ADMIN_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? `${origin}/admin`;
export const DRIVER_BASE_URL = (env.VITE_DRIVER_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? `${origin}/driver`;

/** Public tracking page for a shipment (used in QR codes, resi, and emails). */
export function trackingUrl(awb: string): string {
  return `${PUBLIC_BASE_URL}/tracking/${awb}`;
}

/** Admin detail page for a shipment (used in admin-notification emails). */
export function adminResiUrl(awb: string): string {
  return `${ADMIN_BASE_URL}/resi/${awb}`;
}

/** Which portal the current hostname serves. Null for localhost and any
 * legacy/preview host (temp-gms.frel.cloud, *.github.io) - those keep the
 * pre-migration behaviour so local dev and the transition window still work. */
export type Portal = "public" | "admin" | "driver" | null;

export function detectPortal(): Portal {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host === "admin.gms-logistics.id") return "admin";
  if (host === "driver.gms-logistics.id") return "driver";
  if (host === "gms-logistics.id" || host === "www.gms-logistics.id") return "public";
  return null;
}

/**
 * In-app route paths for a portal. On the portal's own subdomain the routes
 * live at the root (e.g. https://admin.gms-logistics.id/pengiriman), while on
 * localhost and legacy hosts they stay namespaced (/admin/pengiriman) so they
 * don't collide with the public routes in the single shared bundle.
 */
export function adminPath(path: string): string {
  return detectPortal() === "admin" ? path : `/admin${path}`;
}

export function driverPath(path: string): string {
  return detectPortal() === "driver" ? path : `/driver${path}`;
}
