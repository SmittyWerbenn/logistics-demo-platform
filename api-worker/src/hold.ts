import type { AuthedUser, Env } from "./types";
import { creatorRoleOf, pickupEvidenceSql } from "./cancellation";

/** Hold = order/AWB stays valid but is parked: invisible to Driver/Mitra, no assignment,
 * no tracking updates. Not a cancellation. Only "Dalam Persiapan" (not yet picked up) can be held. */
export const HOLDABLE_STATUS = "Dalam Persiapan";
export const HOLD_STATUS = "Hold";
export const HOLD_PICKED_UP_MESSAGE = "Pengiriman tidak dapat di-Hold karena barang sudah dipickup.";

export interface HoldPolicy {
  canHold: boolean;
  canRelease: boolean;
  /** Why the actor cannot hold/release even though they own the order, when there is a user-facing reason. */
  blockedReason: string | null;
}

export interface HoldPolicyInput {
  status: string;
  customer_id: string | null;
  created_by: string | null;
  created_by_role: string | null;
  has_pickup: number | boolean;
  pending_cancel: boolean;
}

/** Hold/Release belong to the ORDER'S CREATOR - not to every high role. A Client acts for orders its
 * company (customer_id) created itself; staff (Admin/Superadmin) only for orders they created
 * personally. Backend source of truth; the UI only renders what this says. */
export function isHoldOwner(row: Pick<HoldPolicyInput, "customer_id" | "created_by" | "created_by_role">, actor: Pick<AuthedUser, "id" | "role" | "customerId">): boolean {
  if (actor.role === "Client") {
    return !!actor.customerId && row.customer_id === actor.customerId && creatorRoleOf(row) === "Client";
  }
  if (actor.role === "Admin" || actor.role === "Superadmin") return !!row.created_by && row.created_by === actor.id;
  return false;
}

export function holdPolicy(row: HoldPolicyInput, actor: Pick<AuthedUser, "id" | "role" | "customerId">): HoldPolicy {
  const none = (blockedReason: string | null): HoldPolicy => ({ canHold: false, canRelease: false, blockedReason });
  if (!isHoldOwner(row, actor)) return none(null);
  if (row.status === HOLD_STATUS) return { canHold: false, canRelease: true, blockedReason: null };
  if (row.status === "Dibatalkan") return none("Order yang sudah dibatalkan tidak dapat di-Hold.");
  if (row.status === "Selesai / Terkirim") return none("Order yang sudah Selesai/Terkirim tidak dapat di-Hold.");
  if (row.status !== HOLDABLE_STATUS || row.has_pickup) return none(HOLD_PICKED_UP_MESSAGE);
  if (row.pending_cancel) return none("Ada permintaan pembatalan yang menunggu keputusan; Hold tidak dapat dilakukan.");
  return { canHold: true, canRelease: false, blockedReason: null };
}

/** Everything the policy needs for one order, read fresh from the database. */
export async function loadHoldRow(env: Env, awb: string) {
  const r = await env.DB.prepare(
    `SELECT s.awb, s.status, s.customer_id, s.created_by, s.created_by_role, s.kota_asal,
            ${pickupEvidenceSql("s.awb")} AS has_pickup,
            EXISTS (SELECT 1 FROM cancellation_requests c WHERE c.awb = s.awb AND c.status = 'PENDING') AS pending_cancel_n
     FROM shipments s WHERE s.awb = ? AND s.deleted_at IS NULL`,
  )
    .bind(awb)
    .first<{ awb: string; status: string; customer_id: string | null; created_by: string | null; created_by_role: string | null; kota_asal: string; has_pickup: number; pending_cancel_n: number }>();
  return r ?? null;
}
