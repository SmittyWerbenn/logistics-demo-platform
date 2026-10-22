import type { Router } from "../router";
import type { AuthedUser, Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, reqString, reqEnum, optString } from "../validate";
import { newId } from "../crypto";
import { requirePermission } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta, likeTerm, orderBy, wantsPaging } from "../pagination";

/** Client-side accounts (Client, or a Viewer tied to a Client ID) only ever see their own ACTIVE dedicated units. */
export function isClientScoped(actor: Pick<AuthedUser, "role" | "customerId">): boolean {
  return actor.role === "Client" || (actor.role === "Viewer" && !!actor.customerId);
}

const ACTIVE_ASSIGN_JOIN = `LEFT JOIN fleet_client_assignments a ON a.truck_id = t.id AND a.status = 'ACTIVE'
       LEFT JOIN clients cl ON cl.customer_id = a.customer_id`;

const STATUS = ["Available", "On Trip", "Maintenance", "Inactive"] as const;

export function registerTruckRoutes(router: Router) {
  router.get("/api/trucks", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "fleet.view");
    const scoped = isClientScoped(actor);
    const url = new URL(ctx.request.url);
    const status = url.searchParams.get("status");
    const paged = wantsPaging(url);
    const where: string[] = ["t.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (status) { where.push("t.status = ?"); params.push(status); }
    // Backend is the source of truth: a Client only gets rows with an ACTIVE assignment to ITS OWN
    // Client ID (taken from the session, never from the request), filtered before search/sort/pagination.
    if (scoped) {
      where.push("a.customer_id = ?");
      params.push(actor.customerId);
    } else {
      const dedicated = url.searchParams.get("dedicated");
      if (dedicated === "assigned") where.push("a.id IS NOT NULL");
      else if (dedicated === "unassigned") where.push("a.id IS NULL");
      else if (dedicated) { where.push("a.customer_id = ?"); params.push(dedicated); }
    }
    const jenis = url.searchParams.get("jenis");
    if (jenis) { where.push("t.jenis = ?"); params.push(jenis); }
    const q = url.searchParams.get("q")?.trim();
    if (q) {
      const cols = ["t.nomor_unit", "t.jenis", "t.kapasitas", "d.nama", "d.telepon", "t.keterangan"];
      where.push(`(${cols.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(" OR ")})`);
      for (let i = 0; i < cols.length; i++) params.push(likeTerm(q));
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const order = orderBy(
      url,
      { nomor_unit: "t.nomor_unit", jenis: "t.jenis", status: "t.status", driver: "d.nama COLLATE NOCASE" },
      "t.nomor_unit ASC",
    );
    const { page, limit, offset } = parsePagination(url);
    const total = paged
      ? await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM trucks t LEFT JOIN drivers d ON d.id = t.driver_id ${ACTIVE_ASSIGN_JOIN} ${whereSql}`).bind(...params).first<{ c: number }>()
      : null;
    const rows = await ctx.env.DB.prepare(
      `SELECT t.*, d.nama as driver_nama, d.telepon as driver_telepon,
              a.customer_id as dedicated_customer_id, cl.nama as dedicated_customer_nama
       FROM trucks t
       LEFT JOIN drivers d ON d.id = t.driver_id ${ACTIVE_ASSIGN_JOIN} ${whereSql} ORDER BY ${order}${paged ? " LIMIT ? OFFSET ?" : ""}`,
    )
      .bind(...params, ...(paged ? [limit, offset] : []))
      .all();

    // Assignment internals are staff-only; a Client just sees its own units.
    const items = scoped
      ? (rows.results ?? []).map((r) => ({ ...r, dedicated_customer_id: null, dedicated_customer_nama: null }))
      : rows.results;
    return ok({ items, ...(paged ? { meta: pageMeta(page, limit, total?.c ?? 0) } : {}) });
  });

  // Distinct vehicle types for the Armada filter dropdown.
  router.get("/api/trucks/facets", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "fleet.view");
    const rows = isClientScoped(actor)
      ? await ctx.env.DB.prepare(
          `SELECT DISTINCT t.jenis FROM trucks t JOIN fleet_client_assignments a ON a.truck_id = t.id AND a.status = 'ACTIVE' AND a.customer_id = ?
           WHERE t.deleted_at IS NULL ORDER BY t.jenis COLLATE NOCASE`,
        ).bind(actor.customerId).all<{ jenis: string }>()
      : await ctx.env.DB.prepare(`SELECT DISTINCT jenis FROM trucks WHERE deleted_at IS NULL ORDER BY jenis COLLATE NOCASE`).all<{ jenis: string }>();
    return ok({ jenis: (rows.results ?? []).map((r) => r.jenis) });
  });

  router.post("/api/trucks", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "fleet.manage");
    const body = await parseJsonBody(ctx.request);
    const nomorUnit = reqString(body, "nomorUnit", { max: 20 });
    const jenis = reqString(body, "jenis", { max: 30 });
    const kapasitas = reqString(body, "kapasitas", { max: 30 });
    const driverNama = reqString(body, "driverNama", { max: 80 });
    const driverTelepon = reqString(body, "driverTelepon", { max: 30 });
    const status = reqEnum(body, "status", STATUS);
    const keterangan = optString(body, "keterangan");

    const dupe = await ctx.env.DB.prepare(`SELECT id FROM trucks WHERE nomor_unit = ?`).bind(nomorUnit).first();
    if (dupe) throw Errors.conflict("Nomor unit truck sudah terdaftar (termasuk data di Recycle Bin).");

    const now = new Date().toISOString();
    const driverId = newId();
    await ctx.env.DB.prepare(`INSERT INTO drivers (id, nama, telepon, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(driverId, driverNama, driverTelepon, now, now)
      .run();

    const truckId = newId();
    await ctx.env.DB.prepare(
      `INSERT INTO trucks (id, nomor_unit, jenis, kapasitas, driver_id, status, keterangan, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(truckId, nomorUnit, jenis, kapasitas, driverId, status, keterangan ?? null, now, now, actor.id, actor.id)
      .run();

    await writeAuditLog(ctx.env, actor, {
      action: "CREATE_TRUCK",
      actionLabel: "CREATE TRUCK",
      module: "Master Armada",
      description: `Truck "${nomorUnit}" ditambahkan.`,
    });

    return ok({ id: truckId }, {}, 201);
  });

  router.patch("/api/trucks/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "fleet.manage");
    const truck = await ctx.env.DB.prepare(`SELECT id, driver_id FROM trucks WHERE id = ? AND deleted_at IS NULL`).bind(params.id).first<{
      id: string;
      driver_id: string;
    }>();
    if (!truck) throw Errors.notFound("Truck tidak ditemukan.");

    const body = await parseJsonBody(ctx.request);
    const jenis = optString(body, "jenis");
    const kapasitas = optString(body, "kapasitas");
    const status = body.status !== undefined ? reqEnum(body, "status", STATUS) : undefined;
    const keterangan = optString(body, "keterangan");
    const driverNama = optString(body, "driverNama");
    const driverTelepon = optString(body, "driverTelepon");

    const now = new Date().toISOString();
    if (driverNama || driverTelepon) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (driverNama) { sets.push("nama = ?"); values.push(driverNama); }
      if (driverTelepon) { sets.push("telepon = ?"); values.push(driverTelepon); }
      sets.push("updated_at = ?");
      values.push(now, truck.driver_id);
      await ctx.env.DB.prepare(`UPDATE drivers SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    if (jenis) { sets.push("jenis = ?"); values.push(jenis); }
    if (kapasitas) { sets.push("kapasitas = ?"); values.push(kapasitas); }
    if (status) { sets.push("status = ?"); values.push(status); }
    if (keterangan !== undefined) { sets.push("keterangan = ?"); values.push(keterangan); }
    if (sets.length > 0) {
      sets.push("updated_at = ?", "updated_by = ?");
      values.push(now, actor.id, params.id);
      await ctx.env.DB.prepare(`UPDATE trucks SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
    }

    await writeAuditLog(ctx.env, actor, {
      action: "UPDATE_TRUCK_MASTER",
      actionLabel: "UPDATE TRUCK",
      module: "Master Armada",
      description: `Data truck (${params.id}) diperbarui.`,
    });

    return ok({ updated: true });
  });

  router.get("/api/trucks/:id/history", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "fleet.view");
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // Matches shipments currently assigned to this truck, plus ones that
    // used it at some earlier point in their timeline (e.g. before a
    // Transfer Unit moved them to a different truck).
    let matchClause = `s.deleted_at IS NULL AND (s.truck_id = ? OR EXISTS (SELECT 1 FROM shipment_timeline_events e WHERE e.awb = s.awb AND e.truck_id = ?))`;
    const params_: unknown[] = [params.id, params.id];
    if (isClientScoped(actor)) {
      // Only a unit dedicated to this Client, and only this Client's own shipments on it.
      const own = await ctx.env.DB.prepare(
        `SELECT 1 FROM fleet_client_assignments WHERE truck_id = ? AND customer_id = ? AND status = 'ACTIVE'`,
      ).bind(params.id, actor.customerId).first();
      if (!own) throw Errors.notFound("Truck tidak ditemukan.");
      matchClause += " AND s.customer_id = ?";
      params_.push(actor.customerId);
    }
    let dateClause = "";
    if (from) { dateClause += " AND s.tanggal_dibuat >= ?"; params_.push(from); }
    if (to) { dateClause += " AND s.tanggal_dibuat <= ?"; params_.push(to); }
    // state=berjalan: currently on this truck and not delivered; state=selesai: everything else.
    const state = url.searchParams.get("state");
    if (state === "berjalan") { dateClause += " AND s.truck_id = ? AND s.status != 'Selesai / Terkirim'"; params_.push(params.id); }
    else if (state === "selesai") { dateClause += " AND NOT (s.truck_id = ? AND s.status != 'Selesai / Terkirim')"; params_.push(params.id); }

    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) as c FROM shipments s WHERE ${matchClause}${dateClause}`)
      .bind(...params_)
      .first<{ c: number }>();
    const rows = await ctx.env.DB.prepare(
      `SELECT s.awb, s.status, s.kota_asal, s.kota_tujuan, s.tanggal_dibuat, s.truck_id FROM shipments s
       WHERE ${matchClause}${dateClause} ORDER BY s.tanggal_dibuat DESC, s.awb DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params_, limit, offset)
      .all();

    return ok({ items: rows.results, meta: pageMeta(page, limit, total?.c ?? 0) });
  });

  // ---- Armada Dedicated (GMS assigns a unit to exactly one Client) ----
  function readAlasan(body: Record<string, unknown>, label: string, required: boolean): string | null {
    const v = typeof body.alasan === "string" ? body.alasan.trim() : "";
    if (required && !v) throw Errors.badRequest(`${label} wajib diisi.`);
    if (v.length > 500) throw Errors.badRequest(`${label} maksimal 500 karakter.`);
    return v || null;
  }

  router.post("/api/trucks/:id/assign", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "fleet.assign");
    const body = await parseJsonBody(ctx.request);
    const customerId = reqString(body, "customerId", { max: 50 });
    const alasan = readAlasan(body, "Alasan", false);
    const truck = await ctx.env.DB.prepare(`SELECT id, nomor_unit, status FROM trucks WHERE id = ? AND deleted_at IS NULL`)
      .bind(params.id)
      .first<{ id: string; nomor_unit: string; status: string }>();
    if (!truck) throw Errors.notFound("Truck tidak ditemukan.");
    const client = await ctx.env.DB.prepare(`SELECT customer_id, nama, aktif FROM clients WHERE customer_id = ? AND deleted_at IS NULL`)
      .bind(customerId)
      .first<{ customer_id: string; nama: string; aktif: number }>();
    if (!client) throw Errors.badRequest("Client yang dipilih tidak ditemukan.");
    if (client.aktif !== 1) throw Errors.badRequest("Client yang dipilih nonaktif.");

    const current = await ctx.env.DB.prepare(
      `SELECT a.customer_id, c.nama FROM fleet_client_assignments a LEFT JOIN clients c ON c.customer_id = a.customer_id
       WHERE a.truck_id = ? AND a.status = 'ACTIVE'`,
    ).bind(params.id).first<{ customer_id: string; nama: string | null }>();
    if (current) {
      throw Errors.conflict(
        current.customer_id === customerId
          ? "Armada ini sudah didedikasikan untuk Client tersebut."
          : `Armada sedang didedikasikan untuk ${current.nama ?? current.customer_id}. Cabut assignment sebelumnya terlebih dahulu.`,
      );
    }
    try {
      await ctx.env.DB.prepare(
        `INSERT INTO fleet_client_assignments (id, truck_id, customer_id, status, assigned_by_user_id, assigned_by_name, assigned_by_role, assigned_at, assignment_reason)
         VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`,
      ).bind(newId(), params.id, customerId, actor.id, actor.nama, actor.role, new Date().toISOString(), alasan).run();
    } catch {
      // Lost a race with another assign: the partial unique index allows only one ACTIVE row per unit.
      throw Errors.conflict("Armada ini baru saja didedikasikan untuk Client lain.");
    }
    await writeAuditLog(ctx.env, actor, {
      action: "ASSIGN_FLEET",
      actionLabel: "ASSIGN FLEET",
      module: "Master Armada",
      description: `Armada ${truck.nomor_unit} didedikasikan untuk ${client.nama} (${client.customer_id}) oleh ${actor.nama} (${actor.role}).${alasan ? ` Alasan: ${alasan}` : ""}`,
    });
    return ok({ assigned: true }, {}, 201);
  });

  router.post("/api/trucks/:id/unassign", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "fleet.assign");
    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const alasan = readAlasan(body, "Alasan pencabutan", true);
    const cur = await ctx.env.DB.prepare(
      `SELECT a.id, a.customer_id, c.nama, t.nomor_unit FROM fleet_client_assignments a
       JOIN trucks t ON t.id = a.truck_id LEFT JOIN clients c ON c.customer_id = a.customer_id
       WHERE a.truck_id = ? AND a.status = 'ACTIVE'`,
    ).bind(params.id).first<{ id: string; customer_id: string; nama: string | null; nomor_unit: string }>();
    if (!cur) throw Errors.conflict("Armada ini tidak sedang didedikasikan untuk Client manapun.");
    const res = await ctx.env.DB.prepare(
      `UPDATE fleet_client_assignments SET status = 'INACTIVE', unassigned_by_user_id = ?, unassigned_by_name = ?, unassigned_by_role = ?, unassigned_at = ?, unassignment_reason = ?
       WHERE id = ? AND status = 'ACTIVE'`,
    ).bind(actor.id, actor.nama, actor.role, new Date().toISOString(), alasan, cur.id).run();
    if ((res.meta?.changes ?? 0) === 0) throw Errors.conflict("Assignment sudah dicabut.");
    await writeAuditLog(ctx.env, actor, {
      action: "UNASSIGN_FLEET",
      actionLabel: "UNASSIGN FLEET",
      module: "Master Armada",
      description: `Assignment armada ${cur.nomor_unit} dari ${cur.nama ?? cur.customer_id} (${cur.customer_id}) dicabut oleh ${actor.nama} (${actor.role}). Alasan: ${alasan}`,
    });
    return ok({ unassigned: true });
  });

  // Assignment history of one unit (staff only).
  router.get("/api/trucks/:id/assignments", async (ctx: Ctx, params) => {
    requirePermission(ctx, "fleet.assign");
    const rows = await ctx.env.DB.prepare(
      `SELECT a.id, a.customer_id as customerId, c.nama as customerNama, a.status, a.assigned_by_name as assignedBy, a.assigned_at as assignedAt,
              a.assignment_reason as assignmentReason, a.unassigned_by_name as unassignedBy, a.unassigned_at as unassignedAt, a.unassignment_reason as unassignmentReason
       FROM fleet_client_assignments a LEFT JOIN clients c ON c.customer_id = a.customer_id WHERE a.truck_id = ? ORDER BY a.assigned_at DESC`,
    ).bind(params.id).all();
    return ok({ items: rows.results ?? [] });
  });
}
