import type { Role } from "./types";

export type Permission =
  | "users.manage"
  | "shipments.view"
  | "shipments.create"
  | "shipments.update_info"
  | "shipments.hold"
  | "tracking.update"
  | "fleet.view"
  | "fleet.manage"
  | "fleet.assign"
  | "locations.view"
  | "locations.manage"
  | "feedback.view"
  | "notifications.view"
  | "audit.view"
  | "settings.view"
  | "settings.manage"
  | "files.upload"
  | "recovery.review"
  | "recycle.manage"
  | "client_logos.manage";

const ALL: Permission[] = [
  "users.manage",
  "shipments.view",
  "shipments.create",
  "shipments.update_info",
  "shipments.hold",
  "tracking.update",
  "fleet.view",
  "fleet.manage",
  "fleet.assign",
  "locations.view",
  "locations.manage",
  "feedback.view",
  "notifications.view",
  "audit.view",
  "settings.view",
  "settings.manage",
  "files.upload",
  "recovery.review",
  "recycle.manage",
  // Client logo management on the Company Profile is Superadmin-only.
  "client_logos.manage",
];

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  Superadmin: new Set(ALL),
  Admin: new Set([
    "users.manage",
    "shipments.view",
    "shipments.create",
    "shipments.update_info",
    "shipments.hold",
    "tracking.update",
    "fleet.view",
    "fleet.manage",
    "fleet.assign",
    "locations.view",
    "locations.manage",
    "feedback.view",
    "notifications.view",
    "audit.view",
    "settings.view",
    "settings.manage",
    "files.upload",
    "recovery.review",
  ]),
  Driver: new Set([
    "shipments.view",
    "tracking.update",
    "fleet.view",
    "locations.view",
    "feedback.view",
    "notifications.view",
    "files.upload",
  ]),
  Viewer: new Set([
    "shipments.view",
    "fleet.view",
    "locations.view",
    "feedback.view",
    "notifications.view",
    "settings.view",
  ]),
  // Customer-side portal account: same base as Viewer, plus creating
  // shipments - visibility is further narrowed to just its own
  // customer_id inside routes/shipments.ts (rbac alone can't express that
  // row-level scoping).
  "Client": new Set([
    "shipments.view",
    "shipments.create",
    "shipments.hold",
    "fleet.view",
    "locations.view",
    "feedback.view",
    "notifications.view",
    "settings.view",
  ]),
  // Partner agent account, logging in through the same admin dashboard as
  // everyone else (no separate portal) - base permissions mirror Driver,
  // visibility is further narrowed to just its own mitra_id inside
  // routes/shipments.ts (rbac alone can't express that row-level scoping).
  Mitra: new Set([
    "shipments.view",
    "tracking.update",
    "locations.view",
    "feedback.view",
    "notifications.view",
    "files.upload",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
