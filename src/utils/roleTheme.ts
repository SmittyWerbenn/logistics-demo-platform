import type { UserRole } from "../types";

/**
 * Visual identity per role. The whole app shares one design system (GMS
 * Logistics navy + the same cards, tables, spacing and typography); a role
 * only changes the ACCENT - active menu, primary buttons, links/focus rings,
 * the header accent bar - through the `--color-accent-*` tokens (see
 * index.css, selected by `data-role-theme` on the layout root), plus the role
 * badge colour below. Status colours (Berangkat, Terkirim, Kendala...) are
 * deliberately not themed so they mean the same thing for everyone.
 *
 *   Superadmin  indigo   - most authoritative / elegant
 *   Admin       navy     - the GMS Logistics primary (default tokens)
 *   Client      sky      - a lighter shade derived from the primary
 *   Viewer      slate    - neutral and clean
 *   Driver      orange   - easy to spot for field operations
 *   Mitra       teal     - partner / business
 */
export const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  Superadmin: "bg-indigo-100 text-indigo-700",
  Admin: "bg-blue-100 text-blue-800",
  Client: "bg-sky-100 text-sky-700",
  Viewer: "bg-slate-200 text-slate-700",
  Driver: "bg-orange-100 text-orange-700",
  Mitra: "bg-teal-100 text-teal-700",
};

/** Solid accent used for the thin bar on top of the header. */
export const ROLE_BAR_CLASS: Record<UserRole, string> = {
  Superadmin: "border-t-indigo-700",
  Admin: "border-t-blue-700",
  Client: "border-t-sky-700",
  Viewer: "border-t-slate-700",
  Driver: "border-t-orange-700",
  Mitra: "border-t-teal-700",
};

/** Active sidebar item: the same navy as the primary buttons for every role
 * (the per-role accent lives in the header bar and badges only). */
export const ROLE_ACTIVE_CLASS: Record<UserRole, string> = {
  Superadmin: "bg-blue-900 text-white",
  Admin: "bg-blue-900 text-white",
  Client: "bg-blue-900 text-white",
  Viewer: "bg-blue-900 text-white",
  Driver: "bg-blue-900 text-white",
  Mitra: "bg-blue-900 text-white",
};
