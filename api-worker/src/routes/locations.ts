import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, optBool } from "../validate";
import { newId } from "../crypto";
import { requirePermission } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta, likeTerm, orderBy } from "../pagination";

const JENIS = ["Gudang", "Hub", "Transit", "Cabang", "Tujuan"] as const;
type Jenis = (typeof JENIS)[number];
const DEFAULT_JENIS: Jenis = "Transit";
const BULK_MAX_ROWS = 2000;
const BULK_CHUNK = 50;

/** Trim + collapse inner whitespace, so "Aceh  Barat " and "Aceh Barat" are one value. */
function clean(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

/** A Nama Area may repeat across different Jenis Titik (e.g. "Semarang Barat" as
 * both Tujuan and Transit), but the same Nama Area + Jenis Titik may only exist
 * once (case-insensitive). Returns the Kota / Kabupaten already using that pair,
 * or null when it is free. */
async function findAreaOwner(db: D1Database, area: string, jenis: string, exceptId = ""): Promise<string | null> {
  if (!area) return null;
  const row = await db
    .prepare(`SELECT nama_kota FROM locations WHERE nama_area = ? COLLATE NOCASE AND jenis = ? AND id != ? LIMIT 1`)
    .bind(area, jenis, exceptId)
    .first<{ nama_kota: string }>();
  return row ? row.nama_kota : null;
}

function areaTakenMessage(area: string, jenis: string, owner: string): string {
  return `Nama Area "${area}" dengan Jenis Titik ${jenis} sudah ada (dipakai oleh ${owner}). Duplikat tidak diperbolehkan.`;
}

const areaKey = (area: string, jenis: string) => `${area.toLowerCase()}\u0001${jenis}`;

function label(kota: string, provinsi: string, titik: string): string {
  return [provinsi || "-", kota, titik].filter(Boolean).join(" / ");
}

interface LocationInput {
  namaKota: string;
  provinsi: string;
  namaTitik: string;
  kodeKota: string;
  namaArea: string;
  jenis: Jenis;
  aktif: boolean;
}

/** Validates one location payload (used by single create and by every bulk
 * row) and returns either the cleaned values or the list of problems. Only
 * Kota / Kabupaten is mandatory; Provinsi, Nama Titik Transit (no longer in
 * the UI), Kode and Jenis are optional (Jenis defaults to Transit). */
function validateLocation(raw: Record<string, unknown>): { value?: LocationInput; errors: string[] } {
  const errors: string[] = [];
  const namaKota = clean(raw.namaKota);
  const provinsi = clean(raw.provinsi);
  const namaTitik = clean(raw.namaTitik);
  const kodeKota = clean(raw.kodeKota).toUpperCase();
  const namaArea = clean(raw.namaArea);
  const jenisRaw = clean(raw.jenis);

  if (!namaKota) errors.push("Kota / Kabupaten wajib diisi");
  else if (namaKota.length > 80) errors.push("Kota / Kabupaten maksimal 80 karakter");
  if (provinsi.length > 80) errors.push("Provinsi maksimal 80 karakter");
  if (namaTitik.length > 120) errors.push("Nama Titik Transit maksimal 120 karakter");
  if (kodeKota.length > 10) errors.push("Kode maksimal 10 karakter");
  if (namaArea.length > 120) errors.push("Nama Area maksimal 120 karakter");

  let jenis: Jenis = DEFAULT_JENIS;
  if (jenisRaw) {
    const match = JENIS.find((j) => j.toLowerCase() === jenisRaw.toLowerCase());
    if (!match) errors.push(`Jenis "${jenisRaw}" tidak valid (pilih: ${JENIS.join(", ")})`);
    else jenis = match;
  }
  const aktif = raw.aktif === undefined || raw.aktif === null ? true : Boolean(raw.aktif);

  if (errors.length > 0) return { errors };
  return { value: { namaKota, provinsi, namaTitik, kodeKota, namaArea, jenis, aktif }, errors };
}

function insertStatement(db: D1Database, v: LocationInput, actorId: string, now: string, id: string = newId()) {
  // provinsi is its own field now (NOT NULL in the schema, so "" when not given).
  return db
    .prepare(
      `INSERT INTO locations (id, nama_kota, nama_titik, kode_kota, nama_area, provinsi, jenis, aktif, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, v.namaKota, v.namaTitik || null, v.kodeKota, v.namaArea || null, v.provinsi, v.jenis, v.aktif ? 1 : 0, now, now, actorId, actorId);
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

export function registerLocationRoutes(router: Router) {
  router.get("/api/locations", async (ctx: Ctx) => {
    requirePermission(ctx, "locations.view");
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const where: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];
    if (url.searchParams.get("active") === "true") where.push("aktif = 1");
    const status = url.searchParams.get("status");
    if (status === "aktif") where.push("aktif = 1");
    else if (status === "nonaktif") where.push("aktif = 0");
    const jenis = url.searchParams.get("jenis");
    if (jenis) { where.push("jenis = ?"); params.push(jenis); }
    const q = url.searchParams.get("q")?.trim();
    if (q) {
      where.push("(nama_kota LIKE ? ESCAPE '\\' OR provinsi LIKE ? ESCAPE '\\' OR kode_kota LIKE ? ESCAPE '\\' OR nama_area LIKE ? ESCAPE '\\')");
      const like = likeTerm(q);
      params.push(like, like, like, like);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const order = orderBy(
      url,
      { nama_kota: "nama_kota COLLATE NOCASE", provinsi: "provinsi COLLATE NOCASE", jenis: "jenis", nama_area: "nama_area COLLATE NOCASE", aktif: "aktif" },
      "nama_kota COLLATE NOCASE ASC, id ASC",
    );
    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM locations ${whereSql}`).bind(...params).first<{ c: number }>();
    const rows = await ctx.env.DB.prepare(`SELECT * FROM locations ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset)
      .all();
    return ok({ items: rows.results, meta: pageMeta(page, limit, total?.c ?? 0) });
  });

  router.post("/api/locations", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "locations.manage");
    const body = await parseJsonBody(ctx.request);
    const { value, errors } = validateLocation(body);
    if (!value) throw Errors.badRequest(errors.join(". ") + ".");

    const areaOwner = await findAreaOwner(ctx.env.DB, value.namaArea, value.jenis);
    if (areaOwner) throw Errors.conflict(areaTakenMessage(value.namaArea, value.jenis, areaOwner));

    const id = newId();
    try {
      await insertStatement(ctx.env.DB, value, actor.id, new Date().toISOString(), id).run();
    } catch (err) {
      if (isUniqueViolation(err)) throw Errors.conflict("Data dengan Provinsi dan Kota / Kabupaten yang sama sudah ada.");
      throw err;
    }

    await writeAuditLog(ctx.env, actor, {
      action: "CREATE_LOCATION",
      actionLabel: "CREATE LOCATION",
      module: "Master Kota",
      description: `Titik lokasi "${label(value.namaKota, value.provinsi, value.namaTitik)}" ditambahkan.`,
    });

    return ok({ id }, {}, 201);
  });

  // Bulk import (Kota / Kabupaten [+ Provinsi, Kode, Jenis, Aktif]).
  // Every row is validated first; valid rows are inserted, invalid/duplicate
  // ones are reported back with their row number so the admin can fix just
  // those. Never replaces or deletes existing data.
  router.post("/api/locations/bulk", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "locations.manage");
    const body = await parseJsonBody(ctx.request);
    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) throw Errors.badRequest("Tidak ada baris data untuk diimport.");
    if (items.length > BULK_MAX_ROWS) throw Errors.badRequest(`Maksimal ${BULK_MAX_ROWS} baris per import.`);

    const existing = await ctx.env.DB.prepare(`SELECT nama_kota, provinsi, nama_titik, nama_area, jenis FROM locations`).all<{
      nama_kota: string;
      provinsi: string;
      nama_titik: string | null;
      nama_area: string | null;
      jenis: string;
    }>();
    // Nama Area + Jenis Titik must be unique: (area, jenis) -> Kota / Kabupaten using it.
    const seenArea = new Map<string, string>();
    for (const r of existing.results ?? []) if (r.nama_area) seenArea.set(areaKey(r.nama_area, r.jenis), r.nama_kota);
    type Failure = { row: number; kota: string; provinsi: string; titik: string; message: string };
    const failed: Failure[] = [];
    const valid: { row: number; value: LocationInput }[] = [];

    items.forEach((item, index) => {
      const obj = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const row = typeof obj.row === "number" && Number.isFinite(obj.row) ? obj.row : index + 2; // +2: header is row 1
      const { value, errors } = validateLocation(obj);
      if (!value) {
        failed.push({ row, kota: clean(obj.namaKota), provinsi: clean(obj.provinsi), titik: clean(obj.namaTitik), message: errors.join("; ") });
        return;
      }
      if (value.namaArea) {
        const owner = seenArea.get(areaKey(value.namaArea, value.jenis));
        if (owner) {
          failed.push({ row, kota: value.namaKota, provinsi: value.provinsi, titik: value.namaTitik, message: areaTakenMessage(value.namaArea, value.jenis, owner) });
          return;
        }
        seenArea.set(areaKey(value.namaArea, value.jenis), value.namaKota);
      }
      valid.push({ row, value });
    });

    const now = new Date().toISOString();
    let created = 0;
    for (let i = 0; i < valid.length; i += BULK_CHUNK) {
      const chunk = valid.slice(i, i + BULK_CHUNK);
      try {
        await ctx.env.DB.batch(chunk.map((c) => insertStatement(ctx.env.DB, c.value, actor.id, now)));
        created += chunk.length;
      } catch {
        // The chunk is atomic; if anything in it failed (e.g. a concurrent
        // insert tripped the unique index) retry row by row to isolate it.
        for (const c of chunk) {
          try {
            await insertStatement(ctx.env.DB, c.value, actor.id, now).run();
            created += 1;
          } catch (err) {
            failed.push({
              row: c.row,
              kota: c.value.namaKota,
              provinsi: c.value.provinsi,
              titik: c.value.namaTitik,
              message: isUniqueViolation(err) ? "Duplikat (sudah ada di master data)" : "Gagal menyimpan",
            });
          }
        }
      }
    }
    failed.sort((a, b) => a.row - b.row);

    await writeAuditLog(ctx.env, actor, {
      action: "IMPORT_LOCATION",
      actionLabel: "IMPORT LOCATION",
      module: "Master Kota",
      description: `Import Kota & Titik Transit: ${created} baris berhasil, ${failed.length} baris gagal dari ${items.length} baris.`,
    });

    return ok({ total: items.length, created, failed });
  });

  router.patch("/api/locations/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "locations.manage");
    const existing = await ctx.env.DB.prepare(
      `SELECT id, nama_kota, nama_titik, provinsi, nama_area FROM locations WHERE id = ? AND deleted_at IS NULL`,
    )
      .bind(params.id)
      .first<{ id: string; nama_kota: string; nama_titik: string | null; provinsi: string; nama_area: string | null }>();
    if (!existing) throw Errors.notFound("Lokasi tidak ditemukan.");

    const body = await parseJsonBody(ctx.request);
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

    const sets: string[] = [];
    const values: unknown[] = [];
    let kota = existing.nama_kota;
    let prov = existing.provinsi ?? "";
    let titik = existing.nama_titik;

    if (has("namaKota")) {
      const v = clean(body.namaKota);
      if (!v) throw Errors.badRequest("Kota / Kabupaten wajib diisi.");
      if (v.length > 80) throw Errors.badRequest("Kota / Kabupaten maksimal 80 karakter.");
      kota = v; sets.push("nama_kota = ?"); values.push(v);
    }
    if (has("provinsi")) {
      const v = clean(body.provinsi);
      if (v.length > 80) throw Errors.badRequest("Provinsi maksimal 80 karakter.");
      prov = v; sets.push("provinsi = ?"); values.push(v);
    }
    if (has("namaTitik")) {
      const v = clean(body.namaTitik);
      if (v.length > 120) throw Errors.badRequest("Nama Titik Transit maksimal 120 karakter.");
      titik = v || null; sets.push("nama_titik = ?"); values.push(v || null);
    }
    if (has("kodeKota")) {
      const v = clean(body.kodeKota).toUpperCase();
      if (v.length > 10) throw Errors.badRequest("Kode maksimal 10 karakter.");
      sets.push("kode_kota = ?"); values.push(v);
    }
    if (has("namaArea")) {
      const v = clean(body.namaArea);
      if (v.length > 120) throw Errors.badRequest("Nama Area maksimal 120 karakter.");
      sets.push("nama_area = ?"); values.push(v || null);
    }
    if (has("jenis") && clean(body.jenis)) {
      const match = JENIS.find((j) => j.toLowerCase() === clean(body.jenis).toLowerCase());
      if (!match) throw Errors.badRequest(`Jenis tidak valid (pilih: ${JENIS.join(", ")}).`);
      sets.push("jenis = ?"); values.push(match);
    }
    const aktif = optBool(body, "aktif");
    if (aktif !== undefined) { sets.push("aktif = ?"); values.push(aktif ? 1 : 0); }
    if (sets.length === 0) throw Errors.badRequest("Tidak ada perubahan yang dikirim.");

    sets.push("updated_at = ?", "updated_by = ?");
    values.push(new Date().toISOString(), actor.id, params.id);
    try {
      await ctx.env.DB.prepare(`UPDATE locations SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
    } catch (err) {
      if (isUniqueViolation(err)) throw Errors.conflict("Data dengan Provinsi dan Kota / Kabupaten yang sama sudah ada.");
      throw err;
    }

    await writeAuditLog(ctx.env, actor, {
      action: "UPDATE_LOCATION",
      actionLabel: "UPDATE LOCATION",
      module: "Master Kota",
      description: `Titik lokasi (${params.id}) diperbarui.`,
    });

    return ok({ updated: true });
  });
}
