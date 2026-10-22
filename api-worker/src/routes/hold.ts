import type { Router } from "../router";
import type { Ctx } from "../types";
import { Errors, ok } from "../http";
import { parseJsonBody } from "../validate";
import { newId } from "../crypto";
import { requirePermission } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { pickupEvidenceSql } from "../cancellation";
import { HOLDABLE_STATUS, HOLD_PICKED_UP_MESSAGE, HOLD_STATUS, holdPolicy, isHoldOwner, loadHoldRow } from "../hold";

const ROLE_LABEL: Record<string, string> = { Superadmin: "Superadmin", Admin: "GMS-Admin", Client: "Client", Driver: "Driver", Viewer: "Viewer", Mitra: "Mitra" };

function readReason(body: Record<string, unknown>, label: string): string {
  const v = typeof body.alasan === "string" ? body.alasan.trim() : "";
  if (!v) throw Errors.badRequest(`${label} wajib diisi.`);
  if (v.length > 500) throw Errors.badRequest(`${label} maksimal 500 karakter.`);
  return v;
}

export function registerHoldRoutes(router: Router) {
  router.post("/api/shipments/:awb/hold", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "shipments.hold");
    const row = await loadHoldRow(ctx.env, params.awb);
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    // A Client never learns another company's order exists; staff only get 403 for orders they did not create.
    if (actor.role === "Client" && row.customer_id !== actor.customerId) throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
    if (!isHoldOwner(row, actor)) throw Errors.forbidden("Hold hanya dapat dilakukan oleh pembuat order.");
    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const alasan = readReason(body, "Alasan Hold");

    if (row.status === HOLD_STATUS) throw Errors.conflict("Pengiriman ini sudah berstatus Hold.");
    const policy = holdPolicy({ ...row, pending_cancel: row.pending_cancel_n > 0 }, actor);
    if (!policy.canHold) throw Errors.unprocessable(policy.blockedReason ?? "Pengiriman ini tidak dapat di-Hold.");

    const nowIso = new Date().toISOString();
    // One transaction: close a stale open hold (order was cancelled/recovered meanwhile), move to Hold only if it is
    // STILL unpicked, then log the episode only if the move happened. The partial unique index rejects a duplicate open hold.
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE shipment_holds SET released_at = ?, release_reason = 'Ditutup otomatis (status order berubah)'
         WHERE awb = ? AND released_at IS NULL AND (SELECT status FROM shipments WHERE awb = ?) != '${HOLD_STATUS}'`,
      ).bind(nowIso, params.awb, params.awb),
      ctx.env.DB.prepare(
        `UPDATE shipments SET status = '${HOLD_STATUS}', updated_at = ?, updated_by = ?
         WHERE awb = ? AND status = '${HOLDABLE_STATUS}' AND deleted_at IS NULL
           AND NOT ${pickupEvidenceSql("shipments.awb")}
           AND NOT EXISTS (SELECT 1 FROM cancellation_requests c WHERE c.awb = shipments.awb AND c.status = 'PENDING')`,
      ).bind(nowIso, actor.id, params.awb),
      ctx.env.DB.prepare(
        `INSERT INTO shipment_holds (id, awb, previous_status, hold_reason, hold_at, hold_by_user_id, hold_by_name, hold_by_role)
         SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM shipments WHERE awb = ? AND status = '${HOLD_STATUS}' AND updated_at = ? AND updated_by = ?)`,
      ).bind(newId(), params.awb, row.status, alasan, nowIso, actor.id, actor.nama, actor.role, params.awb, nowIso, actor.id),
    ]);
    if ((results[1].meta.changes ?? 0) === 0) {
      const fresh = await loadHoldRow(ctx.env, params.awb);
      if (fresh?.status === HOLD_STATUS) throw Errors.conflict("Pengiriman ini sudah berstatus Hold.");
      if (fresh && fresh.pending_cancel_n > 0) throw Errors.conflict("Ada permintaan pembatalan yang menunggu keputusan; Hold tidak dapat dilakukan.");
      throw Errors.unprocessable(HOLD_PICKED_UP_MESSAGE);
    }

    await writeAuditLog(ctx.env, actor, {
      action: "HOLD_SHIPMENT",
      actionLabel: "HOLD SHIPMENT",
      module: "Shipment",
      awb: params.awb,
      description: `Pengiriman di-Hold oleh ${actor.nama} (${ROLE_LABEL[actor.role]}). Status sebelumnya: ${row.status} -> Hold. Alasan: ${alasan}`,
    });
    return ok({ held: true });
  });

  router.post("/api/shipments/:awb/release-hold", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "shipments.hold");
    const row = await loadHoldRow(ctx.env, params.awb);
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    if (actor.role === "Client" && row.customer_id !== actor.customerId) throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
    if (!isHoldOwner(row, actor)) throw Errors.forbidden("Lepas Hold hanya dapat dilakukan oleh pembuat order.");
    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const alasan = readReason(body, "Keterangan Lepas Hold");
    if (row.status !== HOLD_STATUS) throw Errors.conflict("Pengiriman ini tidak sedang berstatus Hold.");

    const open = await ctx.env.DB.prepare(`SELECT id, previous_status FROM shipment_holds WHERE awb = ? AND released_at IS NULL`)
      .bind(params.awb)
      .first<{ id: string; previous_status: string }>();
    if (!open) throw Errors.conflict("Data Hold tidak ditemukan; hubungi admin.");

    const nowIso = new Date().toISOString();
    // Back to the status held FROM (never a hardcoded one). Both statements re-validate the live state: a second
    // simultaneous release (or a status change) finds no open Hold / no Hold status and changes nothing.
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE shipments SET status = ?, updated_at = ?, updated_by = ?
         WHERE awb = ? AND status = '${HOLD_STATUS}' AND deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM shipment_holds h WHERE h.id = ? AND h.released_at IS NULL)`,
      ).bind(open.previous_status, nowIso, actor.id, params.awb, open.id),
      ctx.env.DB.prepare(
        `UPDATE shipment_holds SET released_at = ?, released_by_user_id = ?, released_by_name = ?, released_by_role = ?, release_reason = ?
         WHERE id = ? AND released_at IS NULL AND (SELECT status FROM shipments WHERE awb = ?) = ?`,
      ).bind(nowIso, actor.id, actor.nama, actor.role, alasan, open.id, params.awb, open.previous_status),
    ]);
    if ((results[0].meta.changes ?? 0) === 0) throw Errors.conflict("Pengiriman ini sudah tidak berstatus Hold (mungkin baru saja dilepas).");

    await writeAuditLog(ctx.env, actor, {
      action: "RELEASE_HOLD",
      actionLabel: "RELEASE HOLD",
      module: "Shipment",
      awb: params.awb,
      description: `Hold dilepas oleh ${actor.nama} (${ROLE_LABEL[actor.role]}). Status: Hold -> ${open.previous_status}. Keterangan: ${alasan}`,
    });
    return ok({ released: true, status: open.previous_status });
  });
}
