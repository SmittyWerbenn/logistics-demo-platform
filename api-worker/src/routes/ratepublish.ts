import type { Router } from "../router";
import type { AuthedUser, Ctx } from "../types";
import { ok, Errors, HttpError } from "../http";
import { parseJsonBody } from "../validate";
import { newId } from "../crypto";
import { requirePermission } from "../authMiddleware";

/** Rate Publish VIEW access: semua role dengan permission `settings.view`
 * (Superadmin, Admin/GMS-Admin, Viewer, Client/Admin Client). */
function requireRatePublishView(ctx: Ctx) {
  return requirePermission(ctx, "settings.view");
}

/** Rate Publish EXPORT access (unduh data, tidak mengubah apa pun): permission
 * `settings.manage` - Superadmin + Admin (GMS-Admin)/GMS-Admin. */
function requireRatePublishManage(ctx: Ctx) {
  return requirePermission(ctx, "settings.manage");
}

/** Rate Publish WRITE access (ubah Harga Publish + Bulk Update): Superadmin SAJA.
 * Admin (GMS-Admin) hanya melihat (settings.view) dan mengunduh data
 * (settings.manage/export) - nilai Rate Publish tidak bisa diubahnya. */
function requireRatePublishEdit(ctx: Ctx): AuthedUser {
  const actor = requireRatePublishManage(ctx);
  if (actor.role !== "Superadmin") {
    throw Errors.forbidden("Hanya Superadmin yang dapat mengubah Rate Publish.");
  }
  return actor;
}

/** Read and validate a reason string (same pattern as recycle.ts). */
function readReason(body: Record<string, unknown>, field = "reason"): string {
  const raw = body[field];
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) throw Errors.badRequest("Alasan wajib diisi.");
  if (v.length > 500) throw Errors.badRequest("Alasan maksimal 500 karakter.");
  return v;
}

import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta, likeTerm, orderBy } from "../pagination";

/**
 * Rate Publish maintenance (Portal Admin). The rate being edited is price_tariffs.tarif_per_kg - the SAME base
 * price per kg that Cek Ongkir reads (routes/ongkir.ts + pricing.ts). Nothing here computes a price: origin markup,
 * layanan multiplier, minimum kg, koli fee and rounding all stay in pricing.ts. Cek Ongkir queries the table on every
 * request (no cache), so an edit is live immediately. Shipments store no prices, so past orders are untouched.
 *
 * Access Control (berdasarkan permission RBAC existing):
 * - VIEW (settings.view):     Superadmin, Admin (GMS-Admin), Viewer, Client (Admin Client)
 * - EXPORT (settings.manage): Superadmin + Admin (GMS-Admin) - unduh data saja, tidak mengubah nilai
 * - WRITE/EDIT:               Superadmin SAJA (Admin/GMS-Admin, Viewer, Client tidak dapat mengubah)
 */
const MAX_RATE = 10_000_000;
const MAX_BULK_ROWS = 10000;
const ID_CHUNK = 4000; // ids per lookup query (passed as ONE json array: D1 allows only 100 bound parameters per statement).
const JSON_CHUNK = 1500; // rows per JSON-array statement (keeps each bound parameter well under the size limit)

/** "11000", "11.000", "Rp 11.000", "11,000", "11000.00" -> 11000. Anything else (negative, decimals, text) -> null. */
export function parseRate(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) && raw > 0 && raw <= MAX_RATE ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/^rp\.?\s*/i, "").replace(/\s+/g, "");
  if (!s) return null;
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else if (/^\d+[.,]0+$/.test(s)) s = s.replace(/[.,]0+$/, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= MAX_RATE ? n : null;
}

interface TariffRow {
  id: number;
  provinsi: string;
  kabupaten_kota: string;
  kecamatan: string;
  kategori_area: string;
  tarif_per_kg: number;
}

type RowStatus = "UPDATE" | "SAMA" | "ERROR";
interface RowResult {
  row: number | null;
  id: number | null;
  provinsi: string;
  kota: string;
  kecamatan: string;
  lama: number | null;
  baru: number | null;
  status: RowStatus;
  message: string;
}

const norm = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const fmt = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

async function loadTariffs(env: Ctx["env"], ids: number[]): Promise<Map<number, TariffRow>> {
  const map = new Map<number, TariffRow>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const part = ids.slice(i, i + ID_CHUNK);
    const r = await env.DB.prepare(
      `SELECT t.id, g.provinsi, g.kabupaten_kota, t.kecamatan, t.kategori_area, t.tarif_per_kg
       FROM price_tariffs t JOIN price_regions g ON g.id = t.region_id WHERE t.id IN (SELECT value FROM json_each(?)) AND t.deleted_at IS NULL`,
    )
      .bind(JSON.stringify(part))
      .all<TariffRow>();
    for (const x of r.results ?? []) map.set(x.id, x);
  }
  return map;
}

interface InRow {
  row?: unknown;
  id?: unknown;
  provinsi?: unknown;
  kota?: unknown;
  kecamatan?: unknown;
  baru?: unknown;
  /** The rate the admin saw (commit only): a rate that changed since is reported instead of overwritten. */
  lama?: unknown;
}

/** Validates every row against the CURRENT database. Matching is by the tariff ID only (never row position);
 * names, when supplied, must agree with the ID so a wrong ID can't silently hit another area. */
async function validateRows(env: Ctx["env"], input: unknown): Promise<RowResult[]> {
  if (!Array.isArray(input) || input.length === 0) throw Errors.badRequest("Tidak ada data untuk diproses.");
  if (input.length > MAX_BULK_ROWS) throw Errors.badRequest(`Maksimal ${MAX_BULK_ROWS} baris per proses. Pecah file menjadi beberapa bagian.`);
  const rows = input as InRow[];
  const parsedIds = rows.map((r) => {
    const n = typeof r.id === "number" ? r.id : Number(String(r.id ?? "").trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  const counts = new Map<number, number>();
  for (const id of parsedIds) if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  const found = await loadTariffs(env, Array.from(counts.keys()));

  return rows.map((r, i): RowResult => {
    const id = parsedIds[i];
    const rowNo = typeof r.row === "number" ? r.row : i + 1;
    const base = { row: rowNo, id, provinsi: String(r.provinsi ?? ""), kota: String(r.kota ?? ""), kecamatan: String(r.kecamatan ?? ""), lama: null as number | null, baru: null as number | null };
    const err = (message: string): RowResult => ({ ...base, status: "ERROR", message });
    if (id === null) return err("ID tidak valid atau kosong.");
    if ((counts.get(id) ?? 0) > 1) return err(`ID ${id} ditemukan lebih dari satu kali.`);
    const cur = found.get(id);
    if (!cur) return err("Data area tidak ditemukan.");
    const named = { ...base, provinsi: cur.provinsi, kota: cur.kabupaten_kota, kecamatan: cur.kecamatan, lama: cur.tarif_per_kg };
    const nameBad =
      (r.provinsi && norm(r.provinsi) !== norm(cur.provinsi)) ||
      (r.kota && norm(r.kota) !== norm(cur.kabupaten_kota)) ||
      (r.kecamatan && norm(r.kecamatan) !== norm(cur.kecamatan));
    if (nameBad) return { ...named, status: "ERROR", message: "Nama wilayah tidak cocok dengan ID (periksa kembali file)." };
    const baru = parseRate(r.baru);
    if (baru === null) return { ...named, status: "ERROR", message: `Rate tidak valid (harus angka bulat lebih dari 0, maksimal ${MAX_RATE.toLocaleString("id-ID")}).` };
    if (r.lama !== undefined && r.lama !== null && Number(r.lama) !== cur.tarif_per_kg) {
      return { ...named, baru, status: "ERROR", message: `Rate sudah berubah sejak preview (sekarang ${fmt(cur.tarif_per_kg)}). Muat ulang preview.` };
    }
    if (baru === cur.tarif_per_kg) return { ...named, baru, status: "SAMA", message: "Tidak berubah." };
    return { ...named, baru, status: "UPDATE", message: `${fmt(cur.tarif_per_kg)} → ${fmt(baru)}` };
  });
}

function summarize(results: RowResult[]) {
  return {
    total: results.length,
    update: results.filter((r) => r.status === "UPDATE").length,
    sama: results.filter((r) => r.status === "SAMA").length,
    error: results.filter((r) => r.status === "ERROR").length,
  };
}

const LIST_SELECT = `SELECT t.id, g.provinsi, g.pulau, g.jarak_jawa, g.kabupaten_kota, t.kecamatan, t.kategori_area, t.tarif_per_kg, t.lead_time, t.updated_at, t.updated_by_name
  FROM price_tariffs t JOIN price_regions g ON g.id = t.region_id`;

function listWhere(url: URL) {
  const where: string[] = ["t.deleted_at IS NULL"];
  const params: unknown[] = [];
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    where.push("(g.provinsi LIKE ? ESCAPE '\\' OR g.kabupaten_kota LIKE ? ESCAPE '\\' OR t.kecamatan LIKE ? ESCAPE '\\')");
    const like = likeTerm(q);
    params.push(like, like, like);
  }
  const provinsi = url.searchParams.get("provinsi");
  if (provinsi) { where.push("g.provinsi = ?"); params.push(provinsi); }
  const kota = url.searchParams.get("kota");
  if (kota) { where.push("g.kabupaten_kota = ?"); params.push(kota); }
  const kategori = url.searchParams.get("kategori");
  if (kategori) { where.push("t.kategori_area = ?"); params.push(kategori); }
  const pulau = url.searchParams.get("pulau");
  if (pulau) { where.push("g.pulau = ?"); params.push(pulau); }
  // jarak: SEDANG / JAUH, or "JAWA" for the Java regions (no distance class).
  const jarak = url.searchParams.get("jarak");
  if (jarak === "JAWA") where.push("g.jarak_jawa IS NULL");
  else if (jarak) { where.push("g.jarak_jawa = ?"); params.push(jarak); }
  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

const SORTS = {
  provinsi: "g.provinsi COLLATE NOCASE",
  pulau: "g.pulau COLLATE NOCASE",
  jarak: "g.jarak_jawa",
  kota: "g.kabupaten_kota COLLATE NOCASE",
  kecamatan: "t.kecamatan COLLATE NOCASE",
  tarif: "t.tarif_per_kg",
  updated: "t.updated_at",
};
const DEFAULT_SORT = "g.provinsi COLLATE NOCASE, g.kabupaten_kota COLLATE NOCASE, t.kecamatan COLLATE NOCASE";

function toDto(r: Record<string, unknown>) {
  return {
    id: r.id,
    provinsi: r.provinsi,
    pulau: r.pulau ?? null,
    jarakJawa: r.jarak_jawa ?? null,
    kabupatenKota: r.kabupaten_kota,
    kecamatan: r.kecamatan,
    kategoriArea: r.kategori_area,
    tarifPerKg: r.tarif_per_kg,
    leadTime: r.lead_time,
    updatedAt: r.updated_at ?? null,
    updatedBy: r.updated_by_name ?? null,
  };
}

export function registerRatePublishRoutes(router: Router) {
  router.get("/api/rate-publish", async (ctx: Ctx) => {
    requireRatePublishView(ctx);
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const { whereSql, params } = listWhere(url);
    const order = orderBy(url, SORTS, DEFAULT_SORT);
    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM price_tariffs t JOIN price_regions g ON g.id = t.region_id ${whereSql}`).bind(...params).first<{ c: number }>();
    const rows = await ctx.env.DB.prepare(`${LIST_SELECT} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();
    return ok({ items: (rows.results ?? []).map(toDto), meta: pageMeta(page, limit, total?.c ?? 0) });
  });

  router.get("/api/rate-publish/facets", async (ctx: Ctx) => {
    requireRatePublishView(ctx);
    const url = new URL(ctx.request.url);
    const provinsi = url.searchParams.get("provinsi");
    const [prov, kota, kat, pul] = await Promise.all([
      ctx.env.DB.prepare(`SELECT DISTINCT provinsi AS v FROM price_regions ORDER BY provinsi`).all<{ v: string }>(),
      provinsi
        ? ctx.env.DB.prepare(`SELECT kabupaten_kota AS v FROM price_regions WHERE provinsi = ? ORDER BY kabupaten_kota`).bind(provinsi).all<{ v: string }>()
        : Promise.resolve({ results: [] as { v: string }[] }),
      ctx.env.DB.prepare(`SELECT DISTINCT kategori_area AS v FROM price_tariffs WHERE deleted_at IS NULL ORDER BY kategori_area`).all<{ v: string }>(),
      ctx.env.DB.prepare(`SELECT DISTINCT pulau AS v FROM price_regions WHERE pulau IS NOT NULL ORDER BY pulau`).all<{ v: string }>(),
    ]);
    return ok({ provinsi: (prov.results ?? []).map((x) => x.v), kota: (kota.results ?? []).map((x) => x.v), kategori: (kat.results ?? []).map((x) => x.v), pulau: (pul.results ?? []).map((x) => x.v) });
  });

  // Data download for editing in Excel (same filters as the list; ID is the key the bulk update matches on).
  router.get("/api/rate-publish/export", async (ctx: Ctx) => {
    requireRatePublishManage(ctx);
    const url = new URL(ctx.request.url);
    const { whereSql, params } = listWhere(url);
    const rows = await ctx.env.DB.prepare(`${LIST_SELECT} ${whereSql} ORDER BY ${DEFAULT_SORT} LIMIT 20000`).bind(...params).all();
    return ok({ items: (rows.results ?? []).map(toDto) });
  });

  router.patch("/api/rate-publish/:id", async (ctx: Ctx, params) => {
    const actor = requireRatePublishEdit(ctx);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw Errors.notFound("Data area tidak ditemukan.");
    const body = await parseJsonBody(ctx.request);
    const baru = parseRate(body.tarifPerKg);
    if (baru === null) throw Errors.badRequest(`Rate Publish harus angka bulat lebih dari 0 (maksimal ${MAX_RATE.toLocaleString("id-ID")}).`);
    const cur = (await loadTariffs(ctx.env, [id])).get(id);
    if (!cur) throw Errors.notFound("Data area tidak ditemukan.");
    if (baru === cur.tarif_per_kg) throw Errors.badRequest("Rate Publish tidak berubah.");
    const now = new Date().toISOString();
    // Guarded by the old value: if someone changed it meanwhile this changes nothing instead of overwriting.
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(`UPDATE price_tariffs SET tarif_per_kg = ?, updated_at = ?, updated_by_name = ? WHERE id = ? AND tarif_per_kg = ?`).bind(baru, now, actor.nama, id, cur.tarif_per_kg),
      ctx.env.DB.prepare(
        `INSERT INTO price_tariff_history (id, tariff_id, old_tarif, new_tarif, source, batch_id, changed_at, changed_by_user_id, changed_by_name)
         SELECT ?, ?, ?, ?, 'EDIT', NULL, ?, ?, ? WHERE EXISTS (SELECT 1 FROM price_tariffs WHERE id = ? AND tarif_per_kg = ? AND updated_at = ?)`,
      ).bind(newId(), id, cur.tarif_per_kg, baru, now, actor.id, actor.nama, id, baru, now),
    ]);
    if ((results[0].meta.changes ?? 0) === 0) throw Errors.conflict("Rate Publish baru saja diubah pengguna lain. Muat ulang data.");
    await writeAuditLog(ctx.env, actor, {
      action: "UPDATE_RATE_PUBLISH",
      actionLabel: "UPDATE RATE PUBLISH",
      module: "Rate Publish",
      description: `Rate Publish ${cur.kecamatan}, ${cur.kabupaten_kota}, ${cur.provinsi} (ID ${id}): ${fmt(cur.tarif_per_kg)} -> ${fmt(baru)} per kg.`,
    });
    return ok({ id, tarifPerKg: baru, updatedAt: now });
  });

  // Step 1 of Bulk Update: validate + show what WOULD change. Writes nothing.
  router.post("/api/rate-publish/bulk/preview", async (ctx: Ctx) => {
    requireRatePublishEdit(ctx);
    const body = await parseJsonBody(ctx.request);
    const results = await validateRows(ctx.env, body.rows);
    return ok({ summary: summarize(results), rows: results });
  });

  // Step 2: re-validate against the live data and apply ALL changes in one transaction (or none).
  router.post("/api/rate-publish/bulk/commit", async (ctx: Ctx) => {
    const actor = requireRatePublishEdit(ctx);
    const body = await parseJsonBody(ctx.request);
    const results = await validateRows(ctx.env, body.rows);
    const summary = summarize(results);
    if (summary.error > 0) {
      throw new HttpError(422, "BULK_VALIDATION", `Masih ada ${summary.error} baris bermasalah. Tidak ada data yang diubah.`, { summary, rows: results as unknown as Record<string, unknown>[] } as unknown as Record<string, unknown>);
    }
    const changes = results.filter((r) => r.status === "UPDATE");
    if (changes.length === 0) throw Errors.badRequest("Tidak ada perubahan Rate Publish untuk disimpan.");

    const now = new Date().toISOString();
    const batchId = newId();
    const stmts: D1PreparedStatement[] = [];
    for (let i = 0; i < changes.length; i += JSON_CHUNK) {
      const json = JSON.stringify(changes.slice(i, i + JSON_CHUNK).map((c) => ({ id: c.id, o: c.lama, n: c.baru })));
      stmts.push(
        ctx.env.DB.prepare(
          `UPDATE price_tariffs
             SET tarif_per_kg = (SELECT CAST(json_extract(j.value, '$.n') AS INTEGER) FROM json_each(?1) j WHERE json_extract(j.value, '$.id') = price_tariffs.id),
                 updated_at = ?2, updated_by_name = ?3
           WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`,
        ).bind(json, now, actor.nama),
        ctx.env.DB.prepare(
          `INSERT INTO price_tariff_history (id, tariff_id, old_tarif, new_tarif, source, batch_id, changed_at, changed_by_user_id, changed_by_name)
           SELECT lower(hex(randomblob(16))), json_extract(j.value, '$.id'), json_extract(j.value, '$.o'), json_extract(j.value, '$.n'), 'BULK', ?2, ?3, ?4, ?5
           FROM json_each(?1) j`,
        ).bind(json, batchId, now, actor.id, actor.nama),
      );
    }
    await ctx.env.DB.batch(stmts); // one transaction: all statements apply or none

    const sample = changes.slice(0, 10).map((c) => `${c.kecamatan}, ${c.kota} (ID ${c.id}): ${fmt(c.lama ?? 0)} -> ${fmt(c.baru ?? 0)}`).join("; ");
    await writeAuditLog(ctx.env, actor, {
      action: "BULK_UPDATE_RATE_PUBLISH",
      actionLabel: "BULK UPDATE RATE PUBLISH",
      module: "Rate Publish",
      description: `Bulk update Rate Publish: ${summary.total} baris diproses, ${changes.length} diubah, ${summary.sama} tidak berubah, 0 gagal. Batch ${batchId}. Contoh: ${sample}${changes.length > 10 ? `; dan ${changes.length - 10} lainnya` : ""}`,
    });
    return ok({ batchId, changed: changes.length, unchanged: summary.sama });
  });

  // Permanent delete (bypass Recycle Bin) - SUPERADMIN ONLY.
  // Hanya tersedia untuk Rate Publish langsung dari tabel (bukan dari Recycle Bin).
  router.post("/api/rate-publish/:id/force-delete", async (ctx: Ctx, params) => {
    const actor = requireRatePublishEdit(ctx);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw Errors.notFound("Data area tidak ditemukan.");

    const body = await parseJsonBody(ctx.request);
    const reason = readReason(body);

    // Load data untuk konfirmasi dan audit (jika sudah di-soft-delete, tidak bisa ditemukan di list tapi masih ada di DB)
    const t = await ctx.env.DB.prepare(
      `SELECT t.*, g.provinsi, g.kabupaten_kota
       FROM price_tariffs t JOIN price_regions g ON g.id = t.region_id WHERE t.id = ?`,
    )
      .bind(id)
      .first<Record<string, unknown>>();
    if (!t) throw Errors.notFound("Data area tidak ditemukan.");

    const labelParts: string[] = [];
    if (t.kecamatan) labelParts.push(String(t.kecamatan));
    if (t.kabupaten_kota) labelParts.push(String(t.kabupaten_kota));
    if (t.provinsi) labelParts.push(String(t.provinsi));
    const label = labelParts.length > 0 ? labelParts.join(" · ") : `ID ${id}`;
    const tarifPerKg = typeof t.tarif_per_kg === "number" ? t.tarif_per_kg : null;

    // 1. Set NULL referensi di price_tariff_history agar history tetap ada sebagai audit trail
    await ctx.env.DB.prepare(`UPDATE price_tariff_history SET tariff_id = NULL WHERE tariff_id = ?`).bind(id).run();

    // 2. DELETE permanen row dari price_tariffs
    await ctx.env.DB.prepare(`DELETE FROM price_tariffs WHERE id = ?`).bind(id).run();

    // 3. Audit Log
    await writeAuditLog(ctx.env, actor, {
      action: "PERMANENT_DELETE_RATE_PUBLISH",
      actionLabel: "HAPUS PERMANEN RATE PUBLISH",
      module: "Rate Publish",
      description: `Rate Publish "${label}" (ID ${id}) dihapus permanen. Alasan: ${reason}. Rate sebelumnya: ${tarifPerKg !== null ? fmt(tarifPerKg) : "-"} / kg`,
    });

    return ok({ ok: true });
  });
}
