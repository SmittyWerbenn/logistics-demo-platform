import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, optString } from "../validate";
import { newId } from "../crypto";
import { requireAuth, requirePermission } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta } from "../pagination";
import { eventTypeToShipmentStatus, type TimelineEventType } from "../status";
import { wibNow } from "../wib";

const ALREADY_PROCESSED = "Request sudah diproses oleh user lain.";

interface RecoveryRow {
  id: string;
  awb: string;
  customer_id: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string | null;
  requested_by_name: string;
  requested_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  restored_status: string | null;
}

function toRequest(r: Record<string, unknown>) {
  return {
    id: r.id,
    awb: r.awb,
    customerId: r.customer_id ?? null,
    clientNama: r.client_nama ?? null,
    status: r.status,
    reason: r.reason ?? null,
    requestedBy: r.requested_by_name,
    requestedAt: r.requested_at,
    reviewedBy: r.reviewed_by_name ?? null,
    reviewedAt: r.reviewed_at ?? null,
    rejectionReason: r.rejection_reason ?? null,
    restoredStatus: r.restored_status ?? null,
    orderStatus: r.order_status ?? null,
    tanggalOrder: r.tanggal_dibuat ?? null,
    kotaAsal: r.kota_asal ?? null,
    kotaTujuan: r.kota_tujuan ?? null,
  };
}

const LIST_SELECT = `SELECT r.*, s.status AS order_status, s.tanggal_dibuat, s.kota_asal, s.kota_tujuan,
        c.nama AS client_nama
 FROM order_recovery_requests r
 JOIN shipments s ON s.awb = r.awb
 LEFT JOIN clients c ON c.customer_id = r.customer_id`;

/** Status an order goes back to: the one it had right before it was cancelled
 * (read from its timeline), or the normal initial status when unknown. */
async function statusBeforeCancel(db: D1Database, awb: string): Promise<{ status: string; type: TimelineEventType }> {
  const prev = await db
    .prepare(`SELECT type FROM shipment_timeline_events WHERE awb = ? AND type != 'Dibatalkan' ORDER BY seq DESC LIMIT 1`)
    .bind(awb)
    .first<{ type: TimelineEventType }>();
  const type: TimelineEventType = prev?.type ?? "Barang Diterima";
  return { status: eventTypeToShipmentStatus(type), type };
}

export function registerRecoveryRoutes(router: Router) {
  // Client Admin asks for a cancelled order to be restored. The order itself
  // is NOT touched: it stays "Dibatalkan" until GMS approves.
  router.post("/api/shipments/:awb/recovery-request", async (ctx: Ctx, params) => {
    const actor = requireAuth(ctx);
    if (actor.role !== "Client") throw Errors.forbidden("Hanya Client yang dapat mengajukan pemulihan order.");
    const shipment = await ctx.env.DB.prepare(`SELECT status, customer_id FROM shipments WHERE awb = ? AND deleted_at IS NULL`)
      .bind(params.awb)
      .first<{ status: string; customer_id: string | null }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    // Ownership first, so another client's order isn't even confirmed to exist.
    if (!actor.customerId || shipment.customer_id !== actor.customerId) throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
    if (shipment.status !== "Dibatalkan") throw Errors.unprocessable("Pemulihan hanya dapat diajukan untuk order yang berstatus Dibatalkan.");

    const pending = await ctx.env.DB.prepare(`SELECT id FROM order_recovery_requests WHERE awb = ? AND status = 'PENDING'`)
      .bind(params.awb)
      .first();
    if (pending) throw Errors.conflict("Request pemulihan sedang menunggu konfirmasi.");

    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const reason = optString(body, "alasan") ?? null;
    const id = newId();
    try {
      await ctx.env.DB.prepare(
        `INSERT INTO order_recovery_requests (id, awb, customer_id, status, reason, requested_by_user_id, requested_by_name, requested_at)
         VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
      )
        .bind(id, params.awb, shipment.customer_id, reason, actor.id, actor.nama, new Date().toISOString())
        .run();
    } catch (err) {
      // The partial unique index closed the race between two simultaneous requests.
      if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) throw Errors.conflict("Request pemulihan sedang menunggu konfirmasi.");
      throw err;
    }

    await writeAuditLog(ctx.env, actor, {
      action: "REQUEST_ORDER_RECOVERY",
      actionLabel: "REQUEST ORDER RECOVERY",
      module: "Shipment",
      awb: params.awb,
      description: reason ? `Request pemulihan order diajukan: ${reason}` : "Request pemulihan order diajukan.",
    });
    return ok({ id, status: "PENDING" }, {}, 201);
  });

  router.get("/api/recovery-requests", async (ctx: Ctx) => {
    requirePermission(ctx, "recovery.review");
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const where: string[] = [];
    const params: unknown[] = [];
    const status = url.searchParams.get("status");
    if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") { where.push("r.status = ?"); params.push(status); }
    const awb = url.searchParams.get("awb")?.trim();
    if (awb) { where.push("r.awb LIKE ?"); params.push(`%${awb}%`); }
    const client = url.searchParams.get("client")?.trim();
    if (client) { where.push("(r.customer_id LIKE ? OR c.nama LIKE ?)"); params.push(`%${client}%`, `%${client}%`); }
    const by = url.searchParams.get("requestedBy")?.trim();
    if (by) { where.push("r.requested_by_name LIKE ?"); params.push(`%${by}%`); }
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from) { where.push("r.requested_at >= ?"); params.push(`${from}T00:00:00`); }
    if (to) { where.push("r.requested_at < ?"); params.push(`${to}T23:59:59.999Z`); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const total = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS c FROM order_recovery_requests r LEFT JOIN clients c ON c.customer_id = r.customer_id ${whereSql}`,
    )
      .bind(...params)
      .first<{ c: number }>();
    // Waiting requests first (they need action), then newest first.
    const rows = await ctx.env.DB.prepare(
      `${LIST_SELECT} ${whereSql}
       ORDER BY CASE r.status WHEN 'PENDING' THEN 0 ELSE 1 END, r.requested_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all();
    const pendingCount = await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM order_recovery_requests WHERE status = 'PENDING'`).first<{ c: number }>();
    return ok({ items: (rows.results ?? []).map(toRequest), meta: pageMeta(page, limit, total?.c ?? 0), pendingCount: pendingCount?.c ?? 0 });
  });

  // Everything the reviewer needs before deciding: the request, the order and its history.
  router.get("/api/recovery-requests/:id", async (ctx: Ctx, params) => {
    requirePermission(ctx, "recovery.review");
    const r = await ctx.env.DB.prepare(`${LIST_SELECT} WHERE r.id = ?`).bind(params.id).first<Record<string, unknown>>();
    if (!r) throw Errors.notFound("Request tidak ditemukan.");
    const shipment = await ctx.env.DB.prepare(
      `SELECT awb, tanggal_dibuat, jam_dibuat, status, pengirim_nama, penerima_nama, alamat_asal, kota_asal, alamat_tujuan, kota_tujuan,
              deskripsi_barang, layanan, berat_kg, jumlah_koli
       FROM shipments WHERE awb = ? AND deleted_at IS NULL`,
    )
      .bind(r.awb)
      .first();
    const timeline = await ctx.env.DB.prepare(
      `SELECT seq, type, lokasi, tanggal, jam, keterangan, input_by_name FROM shipment_timeline_events WHERE awb = ? ORDER BY seq ASC`,
    )
      .bind(r.awb)
      .all();
    return ok({ request: toRequest(r), shipment, timeline: timeline.results ?? [] });
  });

  router.post("/api/recovery-requests/:id/approve", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "recovery.review");
    const req = await ctx.env.DB.prepare(`SELECT * FROM order_recovery_requests WHERE id = ?`).bind(params.id).first<RecoveryRow>();
    if (!req) throw Errors.notFound("Request tidak ditemukan.");
    if (req.status !== "PENDING") throw Errors.conflict(ALREADY_PROCESSED);

    // Re-check the order itself: it may have changed since the request was made.
    const shipment = await ctx.env.DB.prepare(`SELECT status, kota_asal FROM shipments WHERE awb = ? AND deleted_at IS NULL`)
      .bind(req.awb)
      .first<{ status: string; kota_asal: string }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (shipment.status !== "Dibatalkan") {
      throw Errors.unprocessable(`Order tidak dapat dipulihkan karena statusnya sudah ${shipment.status}, bukan Dibatalkan.`);
    }

    const target = await statusBeforeCancel(ctx.env.DB, req.awb);
    const nowIso = new Date().toISOString();

    // Claim the request atomically: only one reviewer can flip PENDING -> APPROVED.
    const claim = await ctx.env.DB.prepare(
      `UPDATE order_recovery_requests SET status = 'APPROVED', reviewed_by_user_id = ?, reviewed_by_name = ?, reviewed_at = ?, restored_status = ?
       WHERE id = ? AND status = 'PENDING'`,
    )
      .bind(actor.id, actor.nama, nowIso, target.status, params.id)
      .run();
    if ((claim.meta?.changes ?? 0) === 0) throw Errors.conflict(ALREADY_PROCESSED);

    const restored = await ctx.env.DB.prepare(
      `UPDATE shipments SET status = ?, updated_at = ?, updated_by = ? WHERE awb = ? AND status = 'Dibatalkan'`,
    )
      .bind(target.status, nowIso, actor.id, req.awb)
      .run();
    if ((restored.meta?.changes ?? 0) === 0) {
      // Lost a race with a status change: undo the claim so nothing is half-done.
      await ctx.env.DB.prepare(
        `UPDATE order_recovery_requests SET status = 'PENDING', reviewed_by_user_id = NULL, reviewed_by_name = NULL, reviewed_at = NULL, restored_status = NULL WHERE id = ?`,
      )
        .bind(params.id)
        .run();
      throw Errors.unprocessable("Order tidak dapat dipulihkan karena statusnya baru saja berubah.");
    }

    // Timeline entry so tracking history matches the restored status.
    const { tanggal, jam } = wibNow();
    const seqRow = await ctx.env.DB.prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM shipment_timeline_events WHERE awb = ?`)
      .bind(req.awb)
      .first<{ next: number }>();
    await ctx.env.DB.prepare(
      `INSERT INTO shipment_timeline_events (id, awb, seq, type, lokasi, tanggal, jam, keterangan, input_by_user_id, input_by_name, input_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId(), req.awb, seqRow?.next ?? 1, target.type, shipment.kota_asal, tanggal, jam, "Pesanan dipulihkan setelah request pemulihan disetujui.", actor.id, actor.nama, nowIso, nowIso)
      .run();

    await writeAuditLog(ctx.env, actor, {
      action: "APPROVE_ORDER_RECOVERY",
      actionLabel: "APPROVE ORDER RECOVERY",
      module: "Shipment",
      awb: req.awb,
      description: `Request pemulihan order disetujui; order dipulihkan ke status ${target.status}.`,
    });
    await writeAuditLog(ctx.env, actor, {
      action: "RECOVER_ORDER",
      actionLabel: "RECOVER ORDER",
      module: "Shipment",
      awb: req.awb,
      description: `Order dipulihkan dari Dibatalkan ke ${target.status}.`,
    });
    return ok({ approved: true, status: target.status });
  });

  router.post("/api/recovery-requests/:id/reject", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "recovery.review");
    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const alasan = (optString(body, "alasan") ?? "").trim();
    if (!alasan) throw Errors.badRequest("Alasan penolakan wajib diisi.");
    if (alasan.length > 500) throw Errors.badRequest("Alasan penolakan maksimal 500 karakter.");

    const req = await ctx.env.DB.prepare(`SELECT id, awb, status FROM order_recovery_requests WHERE id = ?`)
      .bind(params.id)
      .first<{ id: string; awb: string; status: string }>();
    if (!req) throw Errors.notFound("Request tidak ditemukan.");
    if (req.status !== "PENDING") throw Errors.conflict(ALREADY_PROCESSED);

    const res = await ctx.env.DB.prepare(
      `UPDATE order_recovery_requests SET status = 'REJECTED', rejection_reason = ?, reviewed_by_user_id = ?, reviewed_by_name = ?, reviewed_at = ?
       WHERE id = ? AND status = 'PENDING'`,
    )
      .bind(alasan, actor.id, actor.nama, new Date().toISOString(), params.id)
      .run();
    if ((res.meta?.changes ?? 0) === 0) throw Errors.conflict(ALREADY_PROCESSED);

    await writeAuditLog(ctx.env, actor, {
      action: "REJECT_ORDER_RECOVERY",
      actionLabel: "REJECT ORDER RECOVERY",
      module: "Shipment",
      awb: req.awb,
      description: `Request pemulihan order ditolak: ${alasan}`,
    });
    return ok({ rejected: true });
  });
}
