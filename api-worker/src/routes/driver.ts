import { parsePagination, pageMeta, wantsPaging } from "../pagination";
import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, reqNumber } from "../validate";
import { newId } from "../crypto";
import { requireAuth } from "../authMiddleware";
import { writeAuditLog } from "../audit";

/** Resolves the drivers.id linked to the logged-in user, or throws 403 if
 * this account isn't a Driver or isn't linked to a driver record yet. */
async function requireDriverId(ctx: Ctx): Promise<string> {
  const user = requireAuth(ctx);
  if (user.role !== "Driver") throw Errors.forbidden("Halaman ini khusus untuk akun Driver.");
  const row = await ctx.env.DB.prepare(`SELECT id FROM drivers WHERE user_id = ?`).bind(user.id).first<{ id: string }>();
  if (!row) throw Errors.forbidden("Akun Driver ini belum dihubungkan ke data driver. Hubungi admin.");
  return row.id;
}

// Display name for a shipment's Client ID: the clients master table first,
// falling back to the first Client account with that ID for old data.
const CUSTOMER_NAME_SQL = `COALESCE(
        (SELECT c.nama FROM clients c WHERE c.customer_id = s.customer_id),
        (SELECT u.nama FROM users u
          WHERE u.role = 'Client' AND u.customer_id = s.customer_id
          ORDER BY u.created_at ASC LIMIT 1)) as customer_nama`;

function shipmentSummary(row: Record<string, unknown>) {
  return {
    awb: row.awb,
    status: row.status,
    tanggalDibuat: row.tanggal_dibuat,
    jamDibuat: row.jam_dibuat,
    pengirim: { nama: row.pengirim_nama },
    penerima: { nama: row.penerima_nama, telepon: row.penerima_telepon },
    alamatAsal: row.alamat_asal,
    kotaAsal: row.kota_asal,
    alamatTujuan: row.alamat_tujuan,
    kotaTujuan: row.kota_tujuan,
    deskripsiBarang: row.deskripsi_barang,
    layanan: row.layanan,
    beratKg: row.berat_kg,
    jumlahKoli: row.jumlah_koli,
    truckNomorUnit: row.truck_nomor_unit ?? null,
    estimasiTiba: row.estimasi_tiba ?? null,
    // customer_id is the free-text "Nomor Pelanggan" (e.g. "IDTMDI001")
    // entered when the order was created - it is NOT an internal DB id.
    customerId: row.customer_id ?? null,
    customerName: row.customer_nama ? String(row.customer_nama) : null,
  };
}

export function registerDriverRoutes(router: Router) {
  // Truck unit(s) assigned to this driver - normally just one, but the
  // data model allows more than one truck to point at the same driver, so
  // this returns all of them (oldest-assigned first) for the dashboard
  // header to list.
  router.get("/api/driver/trucks", async (ctx: Ctx) => {
    const driverId = await requireDriverId(ctx);
    const rows = await ctx.env.DB.prepare(
      `SELECT id, nomor_unit, jenis FROM trucks WHERE driver_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
    )
      .bind(driverId)
      .all();
    return ok({
      items: (rows.results ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        nomorUnit: r.nomor_unit,
        jenis: r.jenis,
      })),
    });
  });

  // Assigned shipments only - joined through drivers -> trucks -> shipments,
  // never a raw "all shipments" list like the admin endpoint.
  router.get("/api/driver/shipments", async (ctx: Ctx) => {
    const driverId = await requireDriverId(ctx);
    const url = new URL(ctx.request.url);
    // Page mode (history screen): status / created-date filters + LIMIT/OFFSET in SQL.
    // Without page/limit it returns the driver's whole list (the dashboard's status tabs need it).
    const paged = wantsPaging(url);
    const where = ["t.driver_id = ?", "s.status != 'Dibatalkan'", "s.status != 'Hold'", "s.deleted_at IS NULL"];
    const params: unknown[] = [driverId];
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (status) { where.push("s.status = ?"); params.push(status); }
    if (from) { where.push("s.tanggal_dibuat >= ?"); params.push(from); }
    if (to) { where.push("s.tanggal_dibuat <= ?"); params.push(to); }
    const { page, limit, offset } = parsePagination(url);
    const total = paged
      ? await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM shipments s JOIN trucks t ON t.id = s.truck_id WHERE ${where.join(" AND ")}`).bind(...params).first<{ c: number }>()
      : null;
    const rows = await ctx.env.DB.prepare(
      `SELECT s.*, ${CUSTOMER_NAME_SQL}, t.nomor_unit as truck_nomor_unit
       FROM shipments s
       JOIN trucks t ON t.id = s.truck_id
       WHERE ${where.join(" AND ")}
       ORDER BY ${paged ? "s.tanggal_dibuat DESC, s.jam_dibuat DESC, s.created_at DESC" : "s.created_at DESC"}${paged ? " LIMIT ? OFFSET ?" : ""}`,
    )
      .bind(...params, ...(paged ? [limit, offset] : []))
      .all();
    return ok({ items: (rows.results ?? []).map(shipmentSummary), ...(paged ? { meta: pageMeta(page, limit, total?.c ?? 0) } : {}) });
  });

  // Unassigned shipments (truck_id IS NULL) any driver may browse and
  // request to claim - excludes ones another driver already has a pending
  // claim on, but still shows the requesting driver's own pending claim.
  router.get("/api/driver/open-shipments", async (ctx: Ctx) => {
    const driverId = await requireDriverId(ctx);
    const rows = await ctx.env.DB.prepare(
      `SELECT s.*, ${CUSTOMER_NAME_SQL}
       FROM shipments s
       WHERE s.truck_id IS NULL AND s.deleted_at IS NULL
         AND s.status != 'Dibatalkan' AND s.status != 'Hold'
         AND (s.claim_status IS NULL OR s.claim_driver_id = ?)
       ORDER BY s.created_at ASC`,
    )
      .bind(driverId)
      .all();
    return ok({
      items: (rows.results ?? []).map((row) => ({
        ...shipmentSummary(row),
        claimStatus: row.claim_status ?? null,
        isMine: row.claim_driver_id === driverId,
      })),
    });
  });

  // Request to take an unassigned shipment - stays "pending" until an
  // admin confirms it (which actually assigns the truck) or rejects it.
  router.post("/api/driver/shipments/:awb/claim", async (ctx: Ctx, params) => {
    const actor = requireAuth(ctx);
    const driverId = await requireDriverId(ctx);
    const shipment = await ctx.env.DB.prepare(
      `SELECT truck_id, claim_status, claim_driver_id, status FROM shipments WHERE awb = ? AND deleted_at IS NULL`,
    )
      .bind(params.awb)
      .first<{ truck_id: string | null; claim_status: string | null; claim_driver_id: string | null; status: string }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (shipment.status === "Dibatalkan" || shipment.status === "Hold") throw Errors.notFound("AWB tidak ditemukan.");
    if (shipment.truck_id) throw Errors.conflict("Pengiriman ini sudah punya driver yang ditugaskan.");
    if (shipment.claim_status === "pending") {
      if (shipment.claim_driver_id === driverId) return ok({ claimed: true });
      throw Errors.conflict("Pengiriman ini sedang diklaim driver lain, menunggu konfirmasi admin.");
    }

    const now = new Date().toISOString();
    const result = await ctx.env.DB.prepare(
      `UPDATE shipments SET claim_status = 'pending', claim_driver_id = ?, claim_requested_at = ?
       WHERE awb = ? AND truck_id IS NULL AND claim_status IS NULL`,
    )
      .bind(driverId, now, params.awb)
      .run();
    if (!result.meta.changes) throw Errors.conflict("Pengiriman ini baru saja diambil driver lain.");

    await writeAuditLog(ctx.env, actor, {
      action: "CLAIM_SHIPMENT_REQUEST",
      actionLabel: "CLAIM SHIPMENT REQUEST",
      module: "Driver",
      awb: params.awb,
      description: `Driver ${actor.nama} mengajukan klaim pengiriman ini.`,
    });

    return ok({ claimed: true });
  });

  // Withdraw a still-pending claim request before admin acts on it.
  router.post("/api/driver/shipments/:awb/claim/cancel", async (ctx: Ctx, params) => {
    const actor = requireAuth(ctx);
    const driverId = await requireDriverId(ctx);
    const shipment = await ctx.env.DB.prepare(
      `SELECT claim_status, claim_driver_id FROM shipments WHERE awb = ? AND deleted_at IS NULL`,
    )
      .bind(params.awb)
      .first<{ claim_status: string | null; claim_driver_id: string | null }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (shipment.claim_status !== "pending" || shipment.claim_driver_id !== driverId) {
      throw Errors.badRequest("Tidak ada klaim aktif dari Anda untuk pengiriman ini.");
    }

    await ctx.env.DB.prepare(
      `UPDATE shipments SET claim_status = NULL, claim_driver_id = NULL, claim_requested_at = NULL WHERE awb = ?`,
    )
      .bind(params.awb)
      .run();

    await writeAuditLog(ctx.env, actor, {
      action: "CLAIM_SHIPMENT_CANCEL",
      actionLabel: "CLAIM SHIPMENT CANCEL",
      module: "Driver",
      awb: params.awb,
      description: `Driver ${actor.nama} membatalkan klaim pengiriman ini.`,
    });

    return ok({ cancelled: true });
  });

  router.get("/api/driver/shipments/:awb", async (ctx: Ctx, params) => {
    const driverId = await requireDriverId(ctx);
    const row = await ctx.env.DB.prepare(
      `SELECT s.*, t.nomor_unit as truck_nomor_unit, t.driver_id as truck_driver_id
       FROM shipments s LEFT JOIN trucks t ON t.id = s.truck_id
       WHERE s.awb = ? AND s.deleted_at IS NULL`,
    )
      .bind(params.awb)
      .first<Record<string, unknown>>();
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    if (row.status === "Dibatalkan" || row.status === "Hold") throw Errors.notFound("AWB tidak ditemukan.");
    if (row.truck_driver_id !== driverId) throw Errors.forbidden("Pengiriman ini bukan tugas Anda.");

    const timeline = await ctx.env.DB.prepare(
      `SELECT id, type, lokasi, tanggal, jam, keterangan, input_at
       FROM shipment_timeline_events WHERE awb = ? ORDER BY seq ASC`,
    )
      .bind(params.awb)
      .all();

    return ok({ shipment: shipmentSummary(row), timeline: timeline.results ?? [] });
  });

  // Manual, button-press position report - not polled/continuous.
  router.post("/api/driver/shipments/:awb/position", async (ctx: Ctx, params) => {
    const user = requireAuth(ctx);
    const driverId = await requireDriverId(ctx);
    const owns = await ctx.env.DB.prepare(
      `SELECT 1 FROM shipments s JOIN trucks t ON t.id = s.truck_id WHERE s.awb = ? AND t.driver_id = ? AND s.deleted_at IS NULL AND s.status != 'Hold'`,
    )
      .bind(params.awb, driverId)
      .first();
    if (!owns) throw Errors.forbidden("Pengiriman ini bukan tugas Anda.");

    const body = await parseJsonBody(ctx.request);
    const latitude = reqNumber(body, "latitude", { min: -90, max: 90 });
    const longitude = reqNumber(body, "longitude", { min: -180, max: 180 });
    const accuracyRaw = body.accuracy;
    const accuracy = typeof accuracyRaw === "number" && Number.isFinite(accuracyRaw) ? accuracyRaw : null;

    const id = newId();
    const now = new Date().toISOString();
    await ctx.env.DB.prepare(
      `INSERT INTO driver_position_reports (id, awb, driver_user_id, latitude, longitude, accuracy, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, params.awb, user.id, latitude, longitude, accuracy, now)
      .run();

    await writeAuditLog(ctx.env, user, {
      action: "DRIVER_POSITION_REPORT",
      actionLabel: "DRIVER POSITION REPORT",
      module: "Driver",
      awb: params.awb,
      description: `Driver melaporkan posisi (${latitude.toFixed(5)}, ${longitude.toFixed(5)}).`,
    });

    return ok({ id, createdAt: now }, {}, 201);
  });

  // Last reported position for a shipment, so a shipment detail page (or
  // future admin view) can show "last known location" without polling.
  router.get("/api/driver/shipments/:awb/position", async (ctx: Ctx, params) => {
    const driverId = await requireDriverId(ctx);
    const owns = await ctx.env.DB.prepare(
      `SELECT 1 FROM shipments s JOIN trucks t ON t.id = s.truck_id WHERE s.awb = ? AND t.driver_id = ? AND s.deleted_at IS NULL AND s.status != 'Hold'`,
    )
      .bind(params.awb, driverId)
      .first();
    if (!owns) throw Errors.forbidden("Pengiriman ini bukan tugas Anda.");

    const row = await ctx.env.DB.prepare(
      `SELECT latitude, longitude, accuracy, created_at FROM driver_position_reports
       WHERE awb = ? ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(params.awb)
      .first();
    return ok({ lastPosition: row ?? null });
  });
}
