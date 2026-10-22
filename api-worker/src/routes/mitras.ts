import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, reqString, optString, optBool } from "../validate";
import { requirePermission } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta, likeTerm, orderBy, wantsPaging } from "../pagination";

/** Master Mitra (partner agent) CRUD - Superadmin/Admin only, same gate as
 * Master Data Clients (/api/customers). Also doubles as the dropdown
 * source for Manajemen User (Tambah User > role Mitra) and the "teruskan
 * ke Mitra" picker on Shipment Detail, via ?active=true. */
export function registerMitraRoutes(router: Router) {
  router.get("/api/mitras", async (ctx: Ctx) => {
    requirePermission(ctx, "users.manage");
    const url = new URL(ctx.request.url);
    const onlyActive = url.searchParams.get("active") === "true";
    const paged = wantsPaging(url);
    const where: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];
    if (onlyActive) where.push("aktif = 1");
    const status = url.searchParams.get("status");
    if (status === "aktif") where.push("aktif = 1");
    else if (status === "nonaktif") where.push("aktif = 0");
    const q = url.searchParams.get("q")?.trim();
    if (q) {
      where.push("(kode_mitra LIKE ? ESCAPE '\\' OR nama LIKE ? ESCAPE '\\' OR pic LIKE ? ESCAPE '\\' OR telepon LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR area LIKE ? ESCAPE '\\')");
      const like = likeTerm(q);
      params.push(like, like, like, like, like, like);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const order = orderBy(url, { nama: "nama COLLATE NOCASE", kode_mitra: "kode_mitra", area: "area COLLATE NOCASE", aktif: "aktif" }, "nama COLLATE NOCASE ASC, kode_mitra ASC");
    const { page, limit, offset } = parsePagination(url);
    const total = paged ? await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM mitras ${whereSql}`).bind(...params).first<{ c: number }>() : null;
    const rows = await ctx.env.DB.prepare(`SELECT * FROM mitras ${whereSql} ORDER BY ${order}${paged ? " LIMIT ? OFFSET ?" : ""}`)
      .bind(...params, ...(paged ? [limit, offset] : []))
      .all<Record<string, unknown>>();
    return ok({
      items: (rows.results ?? []).map((r) => ({
        kodeMitra: r.kode_mitra,
        nama: r.nama,
        pic: r.pic,
        telepon: r.telepon,
        email: r.email,
        alamat: r.alamat,
        area: r.area,
        aktif: r.aktif === 1,
        createdAt: r.created_at,
      })),
      ...(paged ? { meta: pageMeta(page, limit, total?.c ?? 0) } : {}),
    });
  });

  router.post("/api/mitras", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "users.manage");
    const body = await parseJsonBody(ctx.request);
    const kodeMitra = reqString(body, "kodeMitra", { max: 50 }).trim().toUpperCase();
    const nama = reqString(body, "nama", { max: 100 }).trim();
    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(kodeMitra)) {
      throw Errors.badRequest("Kode Mitra hanya boleh berisi huruf, angka, titik, minus, dan garis bawah (tanpa spasi).");
    }
    const pic = optString(body, "pic")?.slice(0, 100) ?? null;
    const telepon = optString(body, "telepon")?.slice(0, 30) ?? null;
    const email = optString(body, "email")?.slice(0, 150) ?? null;
    const alamat = optString(body, "alamat")?.slice(0, 300) ?? null;
    const area = optString(body, "area")?.slice(0, 150) ?? null;

    const exists = await ctx.env.DB.prepare(`SELECT 1 FROM mitras WHERE kode_mitra = ?`).bind(kodeMitra).first();
    if (exists) throw Errors.conflict(`Kode Mitra "${kodeMitra}" sudah terdaftar.`);

    const now = new Date().toISOString();
    await ctx.env.DB.prepare(
      `INSERT INTO mitras (kode_mitra, nama, pic, telepon, email, alamat, area, aktif, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
      .bind(kodeMitra, nama, pic, telepon, email, alamat, area, now, actor.id, now, actor.id)
      .run();

    await writeAuditLog(ctx.env, actor, {
      action: "CREATE_MITRA",
      actionLabel: "CREATE MITRA",
      module: "Mitra",
      description: `Mitra "${nama}" (${kodeMitra}) ditambahkan.`,
    });

    return ok({ kodeMitra, nama, pic, telepon, email, alamat, area, aktif: true }, {}, 201);
  });

  router.patch("/api/mitras/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "users.manage");
    const mitra = await ctx.env.DB.prepare(`SELECT * FROM mitras WHERE kode_mitra = ? AND deleted_at IS NULL`)
      .bind(params.id)
      .first<Record<string, unknown>>();
    if (!mitra) throw Errors.notFound("Mitra tidak ditemukan.");

    const body = await parseJsonBody(ctx.request);
    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.nama !== undefined) {
      const nama = reqString(body, "nama", { max: 100 }).trim();
      if (!nama) throw Errors.badRequest("Nama Mitra wajib diisi.");
      sets.push("nama = ?"); values.push(nama);
    }
    for (const [field, column, max] of [
      ["pic", "pic", 100],
      ["telepon", "telepon", 30],
      ["email", "email", 150],
      ["alamat", "alamat", 300],
      ["area", "area", 150],
    ] as const) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const v = optString(body, field)?.slice(0, max) ?? null;
        sets.push(`${column} = ?`);
        values.push(v);
      }
    }
    const aktif = optBool(body, "aktif");
    if (aktif !== undefined) { sets.push("aktif = ?"); values.push(aktif ? 1 : 0); }
    if (sets.length === 0) throw Errors.badRequest("Tidak ada perubahan yang dikirim.");

    sets.push("updated_at = ?", "updated_by = ?");
    values.push(new Date().toISOString(), actor.id, mitra.kode_mitra);
    await ctx.env.DB.prepare(`UPDATE mitras SET ${sets.join(", ")} WHERE kode_mitra = ?`).bind(...values).run();

    // Deactivating a Mitra freezes every linked account - same behaviour
    // as deactivating a Client.
    if (aktif === false && mitra.aktif === 1) {
      await ctx.env.DB.prepare(
        `UPDATE sessions SET revoked_at = ? WHERE revoked_at IS NULL
         AND user_id IN (SELECT id FROM users WHERE mitra_id = ?)`,
      ).bind(new Date().toISOString(), mitra.kode_mitra).run();
    }

    const toggled = aktif !== undefined && (aktif ? 1 : 0) !== mitra.aktif;
    await writeAuditLog(ctx.env, actor, {
      action: toggled ? (aktif ? "ACTIVATE_MITRA" : "DEACTIVATE_MITRA") : "UPDATE_MITRA",
      actionLabel: toggled ? (aktif ? "ACTIVATE MITRA" : "DEACTIVATE MITRA") : "UPDATE MITRA",
      module: "Mitra",
      description: toggled
        ? `Mitra ${mitra.kode_mitra} ${aktif ? "diaktifkan" : "dinonaktifkan"}.`
        : `Data Mitra ${mitra.kode_mitra} diperbarui.`,
    });

    return ok({ updated: true });
  });
}
