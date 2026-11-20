import type { Env, AuthedUser } from "./types";

/** Orders can only be cancelled while the cargo has not been picked up. */
export const CANCELLABLE_STATUS = "Dalam Persiapan";
/** SQL predicate for "not picked up yet": normal preparation, or parked on Hold
 * (a Hold order is still unpicked, so it follows the same cancellation workflow). */
export const CANCELLABLE_STATUS_SQL = "status IN ('Dalam Persiapan','Hold')";
export const PICKED_UP_MESSAGE = "Order tidak dapat dibatalkan karena barang sudah dipickup.";

/** SQL: any operational trace that cargo has been collected, independent of
 * the headline status (a driver may have picked up before anyone updated it):
 * a tracking event beyond the creation event, a driver position report, or a POD. */
export function pickupEvidenceSql(awbExpr: string): string {
  return `(EXISTS (SELECT 1 FROM shipment_timeline_events pe WHERE pe.awb = ${awbExpr} AND pe.type NOT IN ('Barang Diterima','Dibatalkan'))
    OR EXISTS (SELECT 1 FROM driver_position_reports pr WHERE pr.awb = ${awbExpr})
    OR EXISTS (SELECT 1 FROM shipment_pod pp WHERE pp.awb = ${awbExpr}))`;
}

export type CreatorRole = "Client" | "Admin" | "Superadmin";

/** Creator role from the order row. Unknown creator (legacy row whose user is
 * gone) with a customer_id is treated as Client-owned: the strict path. */
export function creatorRoleOf(row: { created_by_role?: string | null; customer_id?: string | null }): CreatorRole {
  const r = row.created_by_role;
  if (r === "Client" || r === "Admin" || r === "Superadmin") return r;
  return row.customer_id ? "Client" : "Admin";
}

export interface CancelPolicy {
  /** Cancel the order right now (reason required). */
  canDirect: boolean;
  /** GMS staff may ask the Client to approve a cancellation. */
  canRequest: boolean;
  /** This Client user may approve/reject the pending request. */
  canDecide: boolean;
  /** Why none of the above applies, when there is a user-facing reason. */
  blockedReason: string | null;
}

export interface PolicyInput {
  status: string;
  customer_id: string | null;
  created_by_role: string | null;
  has_pickup: number | boolean;
  pending_request: boolean;
}

export function cancelPolicy(row: PolicyInput, actor: Pick<AuthedUser, "role" | "customerId">): CancelPolicy {
  const none = (blockedReason: string | null): CancelPolicy => ({ canDirect: false, canRequest: false, canDecide: false, blockedReason });
  const isClient = actor.role === "Client";
  const isStaff = actor.role === "Superadmin" || actor.role === "Admin";
  if (!isClient && !isStaff) return none(null);
  if (isClient && (!actor.customerId || row.customer_id !== actor.customerId)) return none(null);

  if (row.status === "Dibatalkan") return none("Order sudah dibatalkan.");
  if (row.status === "Selesai / Terkirim") return none("Order yang sudah Selesai/Terkirim tidak dapat dibatalkan.");

  const pickedUp = (row.status !== CANCELLABLE_STATUS && row.status !== "Hold") || !!row.has_pickup;
  const creator = creatorRoleOf(row);

  // A pending request stays visible to its decider even if cargo moved meanwhile:
  // approving will be refused by the server with the pickup message.
  if (isClient) {
    if (row.pending_request) return { canDirect: false, canRequest: false, canDecide: true, blockedReason: pickedUp ? PICKED_UP_MESSAGE : null };
    if (pickedUp) return none(PICKED_UP_MESSAGE);
    return { canDirect: true, canRequest: false, canDecide: false, blockedReason: null };
  }

  if (pickedUp) return none(PICKED_UP_MESSAGE);
  if (creator === "Client") {
    if (row.pending_request) return none("Permintaan pembatalan sedang menunggu konfirmasi Client.");
    return { canDirect: false, canRequest: true, canDecide: false, blockedReason: null };
  }
  return { canDirect: true, canRequest: false, canDecide: false, blockedReason: null };
}

/** Everything the policy needs for one order, read fresh from the database. */
export async function loadPolicyRow(env: Env, awb: string) {
  return env.DB.prepare(
    `SELECT s.awb, s.status, s.customer_id, s.kota_asal, s.created_by_role, s.created_by_name,
            ${pickupEvidenceSql("s.awb")} AS has_pickup,
            EXISTS (SELECT 1 FROM cancellation_requests c WHERE c.awb = s.awb AND c.status = 'PENDING') AS pending_request_n
     FROM shipments s WHERE s.awb = ? AND s.deleted_at IS NULL`,
  )
    .bind(awb)
    .first<{
      awb: string;
      status: string;
      customer_id: string | null;
      kota_asal: string;
      created_by_role: string | null;
      created_by_name: string | null;
      has_pickup: number;
      pending_request_n: number;
    }>();
}
