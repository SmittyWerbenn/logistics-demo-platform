import type { Router } from "../router";
import { loadContactInfo } from "./settings";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, reqString, reqNumber, optString } from "../validate";
import { newId } from "../crypto";
import { presignGet } from "../storage";
import { likeTerm } from "../pagination";
import { maskSenderName } from "../mask";
import { TRACKING_CAPTCHA_ENABLED, clientIp, rateLimit, requirePass } from "../captcha";

const PUBLIC_ENTITY_TYPES = new Set([
  "shipment_photo",
  "shipment_surat_jalan",
  "timeline_photo",
  "pod_barang",
  "pod_surat_jalan",
]);

function shipmentSummary(row: Record<string, unknown>) {
  return {
    awb: row.awb,
    tanggalDibuat: row.tanggal_dibuat,
    status: row.status,
    // The sender name is masked HERE (never sent in full): the browser only receives first + last character.
    // The receiver name is shown in full.
    pengirim: { nama: maskSenderName(row.pengirim_nama) },
    penerima: { nama: row.penerima_nama },
    alamatTujuan: row.alamat_tujuan,
    kotaAsal: row.kota_asal,
    kotaTujuan: row.kota_tujuan,
    layanan: row.layanan,
    beratKg: row.berat_kg,
    jumlahKoli: row.jumlah_koli,
    deskripsiBarang: row.deskripsi_barang,
    truckNomorUnit: row.truck_nomor_unit ?? null,
    truckJenis: row.truck_jenis ?? null,
    truckDriverNama: row.truck_driver_nama ?? null,
    estimasiTiba: row.estimasi_tiba,
  };
}

export function registerPublicRoutes(router: Router) {
  // Public tracking lookup - no auth, but only ever returns fields already
  // shown on the public tracking page (never internal notes/pengirim contact).
  router.get("/api/public/shipments/:awb", async (ctx: Ctx, params) => {
    // Needs a human pass (issued after a solved CAPTCHA) + a per-IP cap, so the
    // AWB space can't be scraped by script. Direct links get the CAPTCHA gate in the UI.
    await rateLimit(ctx.env, `track:${clientIp(ctx)}`, 120, 10 * 60 * 1000);
    if (TRACKING_CAPTCHA_ENABLED) await requirePass(ctx.env, ctx.request.headers.get("X-Human-Pass"));
    const row = await ctx.env.DB.prepare(
      `SELECT s.*, t.nomor_unit as truck_nomor_unit, t.jenis as truck_jenis, d.nama as truck_driver_nama
       FROM shipments s LEFT JOIN trucks t ON t.id = s.truck_id LEFT JOIN drivers d ON d.id = t.driver_id
       WHERE s.awb = ? AND s.deleted_at IS NULL`,
    )
      .bind(params.awb)
      .first();
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");

    const timeline = await ctx.env.DB.prepare(
      `SELECT e.id, e.type, e.lokasi, e.tanggal, e.jam, e.keterangan, t.nomor_unit as truck_nomor_unit, d.nama as truck_driver_nama
       FROM shipment_timeline_events e
       LEFT JOIN trucks t ON t.id = e.truck_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       WHERE e.awb = ? ORDER BY e.seq ASC`,
    )
      .bind(params.awb)
      .all();

    const pod = await ctx.env.DB.prepare(
      `SELECT tanggal, jam, lokasi, nama_penerima, catatan FROM shipment_pod WHERE awb = ?`,
    )
      .bind(params.awb)
      .first<Record<string, unknown>>();

    const feedbackExists = await ctx.env.DB.prepare(`SELECT id FROM feedback WHERE awb = ?`).bind(params.awb).first();

    const files = await ctx.env.DB.prepare(
      `SELECT id, entity_type, entity_id FROM files WHERE (entity_type IN ('shipment_photo','shipment_surat_jalan','pod_barang','pod_surat_jalan') AND entity_id = ?)
         OR (entity_type = 'timeline_photo' AND entity_id IN (SELECT id FROM shipment_timeline_events WHERE awb = ?))
         ORDER BY created_at DESC`,
    )
      .bind(params.awb, params.awb)
      .all<{ id: string; entity_type: string; entity_id: string }>();

    return ok({
      shipment: shipmentSummary(row),
      timeline: timeline.results,
      pod: pod ?? null,
      files: files.results ?? [],
      hasFeedback: !!feedbackExists,
    });
  });

  // Nomor Bantuan (CS/admin contact) - configurable by Superadmin under
  // Pengaturan, but consumed by the public Contact page and the driver
  // portal's "Butuh Bantuan" links, neither of which has settings.view.
  // No auth - the number is meant to be publicly visible anyway.
  router.get("/api/public/settings", async (ctx: Ctx) => {
    // helpPhoneNumber (the WhatsApp number) is unchanged; the other fields are
    // the details shown on the public Contact page.
    return ok(await loadContactInfo(ctx.env.DB));
  });

  // Typeahead source for city / area inputs (no auth: Cek Ongkir is public).
  // Searches the DB per keystroke and returns at most `limit` (<= 50) distinct
  // names, instead of shipping the whole master list to the browser.
  router.get("/api/public/locations/suggest", async (ctx: Ctx) => {
    const url = new URL(ctx.request.url);
    const kind = url.searchParams.get("kind") === "area" ? "area" : "kota";
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const col = kind === "area" ? "nama_area" : "nama_kota";
    const where = [`aktif = 1`, `deleted_at IS NULL`, `${col} IS NOT NULL`, `TRIM(${col}) != ''`];
    const params: unknown[] = [];
    if (q) {
      where.push(`${col} LIKE ? ESCAPE '\\'`);
      params.push(likeTerm(q));
    }
    // Names that START with the text come first.
    const rows = await ctx.env.DB.prepare(
      `SELECT ${col} AS nama, MIN(provinsi) AS provinsi, MIN(jenis) AS jenis FROM locations
       WHERE ${where.join(" AND ")} GROUP BY ${col}
       ORDER BY (${col} LIKE ? ESCAPE '\\') DESC, ${col} COLLATE NOCASE LIMIT ?`,
    )
      .bind(...params, `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, limit)
      .all<{ nama: string; provinsi: string | null; jenis: string | null }>();
    return ok({ items: rows.results ?? [] });
  });

  // Canonical spelling of imported city names (case/space-insensitive), for the
  // bulk shipment import preview. Capped at 500 names per call.
  router.post("/api/public/locations/match-kota", async (ctx: Ctx) => {
    const body = (await parseJsonBody(ctx.request)) as { names?: unknown };
    const names = Array.isArray(body.names)
      ? Array.from(new Set(body.names.filter((n): n is string => typeof n === "string").map((n) => n.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))).slice(0, 500)
      : [];
    if (names.length === 0) return ok({ items: [] });
    const rows = await ctx.env.DB.prepare(
      `SELECT DISTINCT nama_kota FROM locations WHERE aktif = 1 AND deleted_at IS NULL AND LOWER(nama_kota) IN (${names.map(() => "?").join(",")})`,
    )
      .bind(...names)
      .all<{ nama_kota: string }>();
    return ok({ items: (rows.results ?? []).map((r) => r.nama_kota) });
  });

  router.post("/api/public/feedback", async (ctx: Ctx) => {
    const body = await parseJsonBody(ctx.request);
    const awb = reqString(body, "awb");
    const customerName = reqString(body, "customerName", { max: 100 });
    const rating = reqNumber(body, "rating", { min: 1, max: 5 });
    const comment = optString(body, "comment");

    const shipment = await ctx.env.DB.prepare(`SELECT status FROM shipments WHERE awb = ? AND deleted_at IS NULL`).bind(awb).first<{
      status: string;
    }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (shipment.status !== "Selesai / Terkirim") {
      throw Errors.unprocessable("Feedback hanya bisa diisi setelah pengiriman selesai.");
    }

    const existing = await ctx.env.DB.prepare(`SELECT id FROM feedback WHERE awb = ?`).bind(awb).first();
    if (existing) throw Errors.conflict("Feedback untuk AWB ini sudah pernah dikirim.");

    await ctx.env.DB.prepare(
      `INSERT INTO feedback (id, awb, customer_name, rating, comment, submitted_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId(), awb, customerName, Math.round(rating), comment ?? null, new Date().toISOString())
      .run();

    return ok({ submitted: true }, {}, 201);
  });

  router.get("/api/public/files/:id", async (ctx: Ctx, params) => {
    const row = await ctx.env.DB.prepare(`SELECT object_key, entity_type FROM files WHERE id = ?`)
      .bind(params.id)
      .first<{ object_key: string; entity_type: string }>();
    if (!row || !PUBLIC_ENTITY_TYPES.has(row.entity_type)) throw Errors.notFound("File tidak ditemukan.");
    const url = await presignGet(ctx.env, row.object_key);
    return ok({ url });
  });
}
