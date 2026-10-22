import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody } from "../validate";
import { newId } from "../crypto";
import { requireAuth } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta } from "../pagination";
import { wibNow } from "../wib";
import { CANCELLABLE_STATUS_SQL, PICKED_UP_MESSAGE, cancelPolicy, creatorRoleOf, loadPolicyRow, pickupEvidenceSql } from "../cancellation";

const ROLE_LABEL: Record<string, string> = { Superadmin: "Superadmin", Admin: "GMS-Admin", Client: "Client", Driver: "Driver", Viewer: "Viewer", Mitra: "Mitra" };

function readText(body: Record<string, unknown>, field: string, label: string): string {
  const raw = body[field];
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) throw Errors.badRequest(`${label} wajib diisi.`);
  if (v.length > 500) throw Errors.badRequest(`${label} maksimal 500 karakter.`);
  return v;
}

/** Timeline row that records the cancellation, written only if the order really ended up Dibatalkan in this same batch. */
function timelineInsert(ctx: Ctx, awb: string, kotaAsal: string, keterangan: string, actor: { id: string; nama: string }, nowIso: string) {
  const { tanggal, jam } = wibNow();
  return ctx.env.DB.prepare(
    `INSERT INTO shipment_timeline_events (id, awb, seq, type, lokasi, tanggal, jam, keterangan, input_by_user_id, input_by_name, input_at, created_at)
     SELECT ?, ?, COALESCE((SELECT MAX(seq) FROM shipment_timeline_events WHERE awb = ?), 0) + 1, 'Dibatalkan', ?, ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (SELECT 1 FROM shipments WHERE awb = ? AND status = 'Dibatalkan' AND updated_at = ?)`,
  ).bind(newId(), awb, awb, kotaAsal, tanggal, jam, keterangan, actor.id, actor.nama, nowIso, nowIso, awb, nowIso);
}

function requestDto(r: Record<string, unknown>) {
  return {
    id: r.id,
    awb: r.awb,
    status: r.status,
    orderStatusAtRequest: r.order_status_at_request,
    reason: r.reason,
    requestedBy: r.requested_by_name,
    requestedByRole: r.requested_by_role,
    requestedAt: r.requested_at,
    decidedBy: r.decided_by_name ?? null,
    decidedByRole: r.decided_by_role ?? null,
    decidedAt: r.decided_at ?? null,
    decisionReason: r.decision_reason ?? null,
  };
}

export function registerCancellationRoutes(router: Router) {
  // Direct cancellation. Who may do it depends on who CREATED the order, and the
  // cargo must not have been picked up (checked again inside the write itself).
  router.post("/api/shipments/:awb/cancel", async (ctx: Ctx, params) => {
    const actor = requireAuth(ctx);
    if (actor.role !== "Client" && actor.role !== "Superadmin" && actor.role !== "Admin") throw Errors.forbidden();
    const row = await loadPolicyRow(ctx.env, params.awb);
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    if (actor.role === "Client" && (!actor.customerId || row.customer_id !== actor.customerId)) {
      throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
    }
    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const alasan = readText(body, "alasan", "Alasan pembatalan");

    const policy = cancelPolicy({ ...row, pending_request: row.pending_request_n > 0 }, actor);
    if (!policy.canDirect) {
      if (policy.canRequest) {
        throw Errors.forbidden("Order ini dibuat oleh Client dan tidak dapat dibatalkan langsung. Gunakan Ajukan Pembatalan agar Client yang memutuskan.");
      }
      if (row.pending_request_n > 0 && actor.role === "Client") {
        throw Errors.conflict("Ada permintaan pembatalan yang menunggu keputusan Anda. Gunakan Terima atau Tolak.");
      }
      throw Errors.unprocessable(policy.blockedReason ?? "Order ini tidak dapat dibatalkan.");
    }

    const nowIso = new Date().toISOString();
    const keterangan = `Dibatalkan oleh ${actor.nama} (${ROLE_LABEL[actor.role]}): ${alasan}`;
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE shipments SET status = 'Dibatalkan', updated_at = ?, updated_by = ?
         WHERE awb = ? AND ${CANCELLABLE_STATUS_SQL} AND deleted_at IS NULL
           AND NOT ${pickupEvidenceSql("shipments.awb")}
           AND NOT EXISTS (SELECT 1 FROM cancellation_requests c WHERE c.awb = shipments.awb AND c.status = 'PENDING')`,
      ).bind(nowIso, actor.id, params.awb),
      timelineInsert(ctx, params.awb, row.kota_asal, keterangan, actor, nowIso),
    ]);
    if ((results[0].meta.changes ?? 0) === 0) {
      // Lost a race (cargo picked up / request filed / cancelled meanwhile): report the real state.
      const fresh = await loadPolicyRow(ctx.env, params.awb);
      if (fresh?.status === "Dibatalkan") throw Errors.conflict("Pengiriman ini sudah dibatalkan.");
      if (fresh && fresh.pending_request_n > 0) throw Errors.conflict("Permintaan pembatalan sedang menunggu konfirmasi Client.");
      throw Errors.unprocessable(PICKED_UP_MESSAGE);
    }

    await writeAuditLog(ctx.env, actor, {
      action: "CANCEL_SHIPMENT",
      actionLabel: "CANCEL SHIPMENT",
      module: "Shipment",
      awb: params.awb,
      description: `Pembatalan langsung oleh ${actor.nama} (${ROLE_LABEL[actor.role]}); order dibuat oleh ${row.created_by_name ?? "-"} (${ROLE_LABEL[creatorRoleOf(row)]}). Alasan: ${alasan}`,
    });
    return ok({ cancelled: true });
  });

  // GMS staff asks the Client to approve cancelling one of the Client's own orders.
  // The order is not touched here.
  router.post("/api/shipments/:awb/cancel-request", async (ctx: Ctx, params) => {
    const actor = requireAuth(ctx);
    if (actor.role !== "Superadmin" && actor.role !== "Admin") throw Errors.forbidden("Hanya Superadmin/GMS-Admin yang dapat mengajukan pembatalan.");
    const row = await loadPolicyRow(ctx.env, params.awb);
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const alasan = readText(body, "alasan", "Alasan pembatalan");

    const policy = cancelPolicy({ ...row, pending_request: row.pending_request_n > 0 }, actor);
    if (!policy.canRequest) {
      if (policy.canDirect) throw Errors.unprocessable("Order ini tidak dibuat oleh Client, gunakan Batalkan Order.");
      if (row.pending_request_n > 0) throw Errors.conflict("Permintaan pembatalan sedang menunggu konfirmasi Client.");
      throw Errors.unprocessable(policy.blockedReason ?? "Order ini tidak dapat dibatalkan.");
    }

    const id = newId();
    try {
      await ctx.env.DB.prepare(
        `INSERT INTO cancellation_requests (id, awb, customer_id, status, order_status_at_request, reason, requested_by_user_id, requested_by_name, requested_by_role, requested_at)
         VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, params.awb, row.customer_id, row.status, alasan, actor.id, actor.nama, actor.role, new Date().toISOString())
        .run();
    } catch (err) {
      if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
        throw Errors.conflict("Permintaan pembatalan sedang menunggu konfirmasi Client.");
      }
      throw err;
    }
    await writeAuditLog(ctx.env, actor, {
      action: "REQUEST_CANCELLATION",
      actionLabel: "REQUEST CANCELLATION",
      module: "Shipment",
      awb: params.awb,
      description: `${actor.nama} (${ROLE_LABEL[actor.role]}) mengajukan pembatalan order milik Client. Status order saat itu: ${row.status}. Alasan: ${alasan}`,
    });
    return ok({ id, status: "PENDING" }, {}, 201);
  });

  // The Client's decision. Reason is mandatory for both outcomes.
  router.post("/api/shipments/:awb/cancel-request/decision", async (ctx: Ctx, params) => {
    const actor = requireAuth(ctx);
    if (actor.role !== "Client") throw Errors.forbidden("Hanya Client pemilik order yang dapat memberi keputusan.");
    const row = await loadPolicyRow(ctx.env, params.awb);
    // Ownership first, so another Client's order isn't confirmed to exist.
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    if (!actor.customerId || row.customer_id !== actor.customerId) throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");

    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const decision = body.decision;
    if (decision !== "approve" && decision !== "reject") throw Errors.badRequest("Keputusan harus approve atau reject.");
    const keterangan = readText(body, "keterangan", "Keterangan");

    const req = await ctx.env.DB.prepare(`SELECT id, reason, requested_by_name FROM cancellation_requests WHERE awb = ? AND status = 'PENDING'`)
      .bind(params.awb)
      .first<{ id: string; reason: string; requested_by_name: string }>();
    if (!req) throw Errors.conflict("Tidak ada permintaan pembatalan yang menunggu keputusan (mungkin sudah diputuskan).");

    const nowIso = new Date().toISOString();
    if (decision === "reject") {
      const r = await ctx.env.DB.prepare(
        `UPDATE cancellation_requests SET status = 'REJECTED', decided_by_user_id = ?, decided_by_name = ?, decided_by_role = ?, decided_at = ?, decision_reason = ?
         WHERE id = ? AND status = 'PENDING'`,
      )
        .bind(actor.id, actor.nama, actor.role, nowIso, keterangan, req.id)
        .run();
      if ((r.meta.changes ?? 0) === 0) throw Errors.conflict("Permintaan ini sudah diputuskan.");
      await writeAuditLog(ctx.env, actor, {
        action: "REJECT_CANCELLATION",
        actionLabel: "REJECT CANCELLATION",
        module: "Shipment",
        awb: params.awb,
        description: `${actor.nama} (Client) menolak permintaan pembatalan dari ${req.requested_by_name}. Order tetap ${row.status}. Alasan: ${keterangan}`,
      });
      return ok({ status: "REJECTED" });
    }

    // Approve: request + order + timeline change together, and only if the cargo
    // still has not been picked up at this very moment.
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE cancellation_requests SET status = 'APPROVED', decided_by_user_id = ?, decided_by_name = ?, decided_by_role = ?, decided_at = ?, decision_reason = ?
         WHERE id = ? AND status = 'PENDING'
           AND EXISTS (SELECT 1 FROM shipments s WHERE s.awb = ? AND s.${CANCELLABLE_STATUS_SQL} AND s.deleted_at IS NULL AND NOT ${pickupEvidenceSql("s.awb")})`,
      ).bind(actor.id, actor.nama, actor.role, nowIso, keterangan, req.id, params.awb),
      ctx.env.DB.prepare(
        `UPDATE shipments SET status = 'Dibatalkan', updated_at = ?, updated_by = ?
         WHERE awb = ? AND ${CANCELLABLE_STATUS_SQL}
           AND EXISTS (SELECT 1 FROM cancellation_requests c WHERE c.id = ? AND c.status = 'APPROVED' AND c.decided_at = ?)`,
      ).bind(nowIso, actor.id, params.awb, req.id, nowIso),
      timelineInsert(
        ctx,
        params.awb,
        row.kota_asal,
        `Dibatalkan atas persetujuan Client (${actor.nama}). Diajukan oleh ${req.requested_by_name}: ${req.reason}. Keterangan Client: ${keterangan}`,
        actor,
        nowIso,
      ),
    ]);
    if ((results[0].meta.changes ?? 0) === 0) {
      const still = await ctx.env.DB.prepare(`SELECT 1 FROM cancellation_requests WHERE id = ? AND status = 'PENDING'`).bind(req.id).first();
      if (!still) throw Errors.conflict("Permintaan ini sudah diputuskan.");
      // Cargo moved after the request was filed: the request can no longer be honoured.
      await ctx.env.DB.prepare(
        `UPDATE cancellation_requests SET status = 'EXPIRED', decided_at = ?, decision_reason = ?, decided_by_name = 'System', decided_by_role = 'System'
         WHERE id = ? AND status = 'PENDING'`,
      )
        .bind(nowIso, "Barang sudah dipickup / status order berubah sebelum keputusan diberikan.", req.id)
        .run();
      await writeAuditLog(ctx.env, actor, {
        action: "CANCELLATION_EXPIRED",
        actionLabel: "CANCELLATION EXPIRED",
        module: "Shipment",
        awb: params.awb,
        description: `Persetujuan pembatalan oleh ${actor.nama} ditolak sistem: ${PICKED_UP_MESSAGE} Permintaan dari ${req.requested_by_name} dinyatakan kedaluwarsa.`,
      });
      throw Errors.unprocessable(`${PICKED_UP_MESSAGE} Permintaan pembatalan dinyatakan kedaluwarsa dan order tetap berjalan.`);
    }
    await writeAuditLog(ctx.env, actor, {
      action: "APPROVE_CANCELLATION",
      actionLabel: "APPROVE CANCELLATION",
      module: "Shipment",
      awb: params.awb,
      description: `${actor.nama} (Client) menyetujui pembatalan yang diajukan ${req.requested_by_name}; order Dibatalkan. Alasan Client: ${keterangan}`,
    });
    return ok({ status: "APPROVED", cancelled: true });
  });

  // Staff takes back their own pending request (e.g. filed by mistake).
  router.post("/api/shipments/:awb/cancel-request/withdraw", async (ctx: Ctx, params) => {
    const actor = requireAuth(ctx);
    if (actor.role !== "Superadmin" && actor.role !== "Admin") throw Errors.forbidden();
    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const note = typeof body.keterangan === "string" ? body.keterangan.trim().slice(0, 500) : "";
    const r = await ctx.env.DB.prepare(
      `UPDATE cancellation_requests SET status = 'WITHDRAWN', decided_by_user_id = ?, decided_by_name = ?, decided_by_role = ?, decided_at = ?, decision_reason = ?
       WHERE awb = ? AND status = 'PENDING'`,
    )
      .bind(actor.id, actor.nama, actor.role, new Date().toISOString(), note || null, params.awb)
      .run();
    if ((r.meta.changes ?? 0) === 0) throw Errors.conflict("Tidak ada permintaan pembatalan yang menunggu keputusan.");
    await writeAuditLog(ctx.env, actor, {
      action: "WITHDRAW_CANCELLATION",
      actionLabel: "WITHDRAW CANCELLATION",
      module: "Shipment",
      awb: params.awb,
      description: `${actor.nama} (${ROLE_LABEL[actor.role]}) menarik permintaan pembatalan.${note ? ` Keterangan: ${note}` : ""}`,
    });
    return ok({ status: "WITHDRAWN" });
  });

  // Requests list: a Client sees only its own customer's, GMS staff see all.
  router.get("/api/cancellation-requests", async (ctx: Ctx) => {
    const actor = requireAuth(ctx);
    if (actor.role !== "Client" && actor.role !== "Superadmin" && actor.role !== "Admin") throw Errors.forbidden();
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const where: string[] = ["s.deleted_at IS NULL"];
    const binds: unknown[] = [];
    if (actor.role === "Client") {
      if (!actor.customerId) throw Errors.forbidden();
      where.push("c.customer_id = ?");
      binds.push(actor.customerId);
    }
    const status = url.searchParams.get("status");
    if (status) {
      where.push("c.status = ?");
      binds.push(status);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) AS n FROM cancellation_requests c JOIN shipments s ON s.awb = c.awb ${whereSql}`)
      .bind(...binds)
      .first<{ n: number }>();
    const rows = await ctx.env.DB.prepare(
      `SELECT c.*, s.kota_asal, s.kota_tujuan, s.status AS order_status
       FROM cancellation_requests c JOIN shipments s ON s.awb = c.awb ${whereSql}
       ORDER BY c.requested_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...binds, limit, offset)
      .all<Record<string, unknown>>();
    return ok({
      items: (rows.results ?? []).map((r) => ({ ...requestDto(r), kotaAsal: r.kota_asal, kotaTujuan: r.kota_tujuan, orderStatus: r.order_status })),
      meta: pageMeta(page, limit, total?.n ?? 0),
    });
  });
}
