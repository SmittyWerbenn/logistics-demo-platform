import type { Router } from "../router";
import type { AuthedUser, Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, reqString, optBool } from "../validate";
import { newId } from "../crypto";
import { requireAuth, requirePermission } from "../authMiddleware";
import { hasPermission } from "../rbac";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta, likeTerm, orderBy, wantsPaging } from "../pagination";
import { FALLBACK_LAYANAN, LAYANAN_ORDER_SQL, STANDARD_LAYANAN, canonicalLayananName, isFallbackLayanan } from "../layanan";

const FALLBACK_PROTECTED =
  `${FALLBACK_LAYANAN} adalah layanan fallback order dan tidak bisa dinonaktifkan, dihapus, atau diganti namanya.`;

const DESKRIPSI_MAX = 300;

/** Optional description: trimmed, empty -> null, capped at DESKRIPSI_MAX. */
function readDeskripsi(body: Record<string, unknown>): string | null {
  const raw = body.deskripsi;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw Errors.badRequest("Deskripsi harus berupa teks.");
  const v = raw.trim();
  if (v.length > DESKRIPSI_MAX) throw Errors.badRequest(`Deskripsi maksimal ${DESKRIPSI_MAX} karakter.`);
  return v || null;
}

/** Master Layanan MANAGE access: roles holding `settings.manage` -
 * Superadmin + Admin (GMS-Admin) only, same gate as Master Mitra / Clients. */
function requireLayananManage(ctx: Ctx) {
  return requirePermission(ctx, "settings.manage");
}

/** Master Layanan VIEW access (untuk "lihat juga yang Nonaktif"): role dengan
 * permission `settings.view` - Superadmin, Admin (GMS-Admin), Viewer, dan
 * Client (Admin Client), sama seperti Rate Publish. Role lain (Driver, Mitra)
 * tetap boleh membaca daftar (order form butuh dropdown-nya, lihat GET di
 * bawah) tapi hanya menerima entri yang AKTIF. */
function canViewAllLayanan(actor: AuthedUser): boolean {
  return hasPermission(actor.role, "settings.view");
}
async function fallbackReady(ctx: Ctx): Promise<boolean> {
  const r = await ctx.env.DB.prepare(`SELECT 1 AS x FROM layanans WHERE deleted_at IS NULL AND aktif = 1 AND nama = ? COLLATE NOCASE`)
    .bind(FALLBACK_LAYANAN)
    .first();
  return !!r;
}

export function registerLayananRoutes(router: Router) {
  router.get("/api/layanan", async (ctx: Ctx) => {
    const actor = requireAuth(ctx);
    const canViewAll = canViewAllLayanan(actor);
    const onlyActive = !canViewAll || new URL(ctx.request.url).searchParams.get("active") === "true";

    const url = new URL(ctx.request.url);
    const paged = wantsPaging(url);
    const where: string[] = ["l.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (onlyActive) where.push("l.aktif = 1");
    const status = url.searchParams.get("status");
    if (status === "aktif") where.push("l.aktif = 1");
    else if (status === "nonaktif") where.push("l.aktif = 0");
    const q = url.searchParams.get("q")?.trim();
    if (q) {
      where.push("(l.nama LIKE ? ESCAPE '\\' OR l.deskripsi LIKE ? ESCAPE '\\')");
      params.push(likeTerm(q), likeTerm(q));
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const order = orderBy(url, { nama: "l.nama COLLATE NOCASE", aktif: "l.aktif", jumlah_order: "jumlah_order" }, LAYANAN_ORDER_SQL);
    const { page, limit, offset } = parsePagination(url);
    const total = paged ? await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM layanans l ${whereSql}`).bind(...params).first<{ c: number }>() : null;
    const rows = await ctx.env.DB.prepare(
      `SELECT l.id, l.nama, l.deskripsi, l.aktif, l.created_at,
              (SELECT COUNT(*) FROM shipments s WHERE s.layanan = l.nama COLLATE NOCASE) AS jumlah_order
       FROM layanans l ${whereSql}
       ORDER BY ${order}${paged ? " LIMIT ? OFFSET ?" : ""}`,
    )
      .bind(...params, ...(paged ? [limit, offset] : []))
      .all<{ id: string; nama: string; deskripsi: string | null; aktif: number; created_at: string; jumlah_order: number }>();
    const items = (rows.results ?? []).map((r) => ({
      id: r.id,
      nama: r.nama,
      deskripsi: r.deskripsi ?? null,
      aktif: r.aktif === 1,
      jumlahOrder: r.jumlah_order,
      fallback: isFallbackLayanan(r.nama),
      createdAt: r.created_at,
    }));

    return ok({
      items,
      ...(paged ? { meta: pageMeta(page, limit, total?.c ?? 0) } : {}),
      standard: STANDARD_LAYANAN,
      // Lets the admin UI warn when order fallback can't work.
      fallback: {
        nama: FALLBACK_LAYANAN,
        ready: paged ? await fallbackReady(ctx) : items.some((i) => i.fallback && i.aktif),
      },
    });
  });

  router.post("/api/layanan", async (ctx: Ctx) => {
    const actor = requireLayananManage(ctx);
    const body = await parseJsonBody(ctx.request);
    const nama = canonicalLayananName(reqString(body, "nama", { max: 50 }));
    if (!nama) throw Errors.badRequest("Nama layanan wajib diisi.");
    const deskripsi = readDeskripsi(body);

    const dupe = await ctx.env.DB.prepare(`SELECT nama FROM layanans WHERE nama = ?`).bind(nama).first<{ nama: string }>();
    if (dupe) throw Errors.conflict(`Layanan "${dupe.nama}" sudah ada di Master Layanan.`);

    const id = newId();
    const now = new Date().toISOString();
    await ctx.env.DB.prepare(
      `INSERT INTO layanans (id, nama, deskripsi, aktif, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
    )
      .bind(id, nama, deskripsi, now, actor.id, now, actor.id)
      .run();

    await writeAuditLog(ctx.env, actor, {
      action: "CREATE_LAYANAN",
      actionLabel: "CREATE LAYANAN",
      module: "Layanan",
      description: `Layanan "${nama}" ditambahkan.`,
    });

    return ok({ id, nama, deskripsi, aktif: true }, {}, 201);
  });

  router.patch("/api/layanan/:id", async (ctx: Ctx, params) => {
    const actor = requireLayananManage(ctx);
    const layanan = await ctx.env.DB.prepare(`SELECT id, nama, aktif, deskripsi FROM layanans WHERE id = ? AND deleted_at IS NULL`)
      .bind(params.id)
      .first<{ id: string; nama: string; aktif: number; deskripsi: string | null }>();
    if (!layanan) throw Errors.notFound("Layanan tidak ditemukan.");

    const body = await parseJsonBody(ctx.request);
    const protectedFallback = isFallbackLayanan(layanan.nama);
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    const sets: string[] = [];
    const values: unknown[] = [];
    let newName: string | null = null;

    if (body.nama !== undefined) {
      const nama = canonicalLayananName(reqString(body, "nama", { max: 50 }));
      if (!nama) throw Errors.badRequest("Nama layanan wajib diisi.");
      if (nama !== layanan.nama) {
        if (protectedFallback) throw Errors.conflict(FALLBACK_PROTECTED);
        const dupe = await ctx.env.DB.prepare(`SELECT 1 FROM layanans WHERE nama = ? AND id != ?`)
          .bind(nama, layanan.id)
          .first();
        if (dupe) throw Errors.conflict(`Layanan "${nama}" sudah ada di Master Layanan.`);
        newName = nama;
        sets.push("nama = ?");
        values.push(nama);
      }
    }

    // Description is editable for every layanan, including the protected LTL
    // (only its name/status are locked).
    let deskripsiChanged = false;
    if (Object.prototype.hasOwnProperty.call(body, "deskripsi")) {
      const deskripsi = readDeskripsi(body);
      if (deskripsi !== (layanan.deskripsi ?? null)) {
        deskripsiChanged = true;
        sets.push("deskripsi = ?");
        values.push(deskripsi);
      }
    }

    const aktif = optBool(body, "aktif");
    if (aktif !== undefined && (aktif ? 1 : 0) !== layanan.aktif) {
      if (!aktif && protectedFallback) throw Errors.conflict(FALLBACK_PROTECTED);
      sets.push("aktif = ?");
      values.push(aktif ? 1 : 0);
    }
    if (sets.length === 0) {
      if (body.nama === undefined && aktif === undefined && !Object.prototype.hasOwnProperty.call(body, "deskripsi")) {
        throw Errors.badRequest("Tidak ada perubahan yang dikirim.");
      }
      return ok({ updated: false });
    }

    sets.push("updated_at = ?", "updated_by = ?");
    values.push(now, actor.id, layanan.id);
    statements.push(ctx.env.DB.prepare(`UPDATE layanans SET ${sets.join(", ")} WHERE id = ?`).bind(...values));
    // Orders store the layanan by name, so a rename carries existing orders
    // along in the same atomic batch - no order is left pointing at a name
    // that no longer exists.
    if (newName) {
      statements.push(ctx.env.DB.prepare(`UPDATE shipments SET layanan = ? WHERE layanan = ? COLLATE NOCASE`).bind(newName, layanan.nama));
    }
    await ctx.env.DB.batch(statements);

    const toggled = aktif !== undefined && (aktif ? 1 : 0) !== layanan.aktif;
    await writeAuditLog(ctx.env, actor, {
      action: toggled && !newName ? (aktif ? "ACTIVATE_LAYANAN" : "DEACTIVATE_LAYANAN") : "UPDATE_LAYANAN",
      actionLabel: toggled && !newName ? (aktif ? "ACTIVATE LAYANAN" : "DEACTIVATE LAYANAN") : "UPDATE LAYANAN",
      module: "Layanan",
      description: newName
        ? `Layanan "${layanan.nama}" diganti namanya menjadi "${newName}".`
        : toggled
          ? `Layanan "${layanan.nama}" ${aktif ? "diaktifkan" : "dinonaktifkan"}.`
          : deskripsiChanged
            ? `Deskripsi layanan "${layanan.nama}" diperbarui.`
            : `Layanan "${layanan.nama}" diperbarui.`,
    });

    return ok({ updated: true });
  });
}
