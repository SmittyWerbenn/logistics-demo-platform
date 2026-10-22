import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody } from "../validate";
import { requirePermission } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta } from "../pagination";
import {
  ENTITIES,
  ENTITY_TYPES,
  RETENTION_DAYS,
  AUTO_PURGE_ENABLED,
  SHIPMENT_DELETE_BLOCKED,
  softDelete,
  restoreItem,
  type RecycleEntity,
  type BinRow,
  type ItemResult,
} from "../recycle";

const MAX_BULK = 200;

function readReason(body: Record<string, unknown>, field = "reason"): string {
  const raw = body[field];
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) throw Errors.badRequest("Alasan wajib diisi.");
  if (v.length > 500) throw Errors.badRequest("Alasan maksimal 500 karakter.");
  return v;
}

function readIds(body: Record<string, unknown>): string[] {
  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) throw Errors.badRequest("Pilih minimal satu data.");
  if (raw.length > MAX_BULK) throw Errors.badRequest(`Maksimal ${MAX_BULK} data per proses.`);
  const ids = raw.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return Array.from(new Set(ids));
}

function daysLeft(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

function toDto(r: BinRow & Record<string, unknown>) {
  return {
    id: r.id,
    entityType: r.entity_type,
    entityTypeLabel: ENTITIES[r.entity_type]?.title ?? r.entity_type,
    entityId: r.entity_id,
    label: r.label,
    sublabel: r.sublabel ?? "",
    status: r.status,
    deletedBy: r.deleted_by_name,
    deletedAt: r.deleted_at,
    deleteReason: r.delete_reason,
    expiresAt: r.expires_at,
    daysLeft: daysLeft(r.expires_at),
    purgeError: r.purge_error,
    autoPurgeEnabled: AUTO_PURGE_ENABLED,
    restoredBy: r.restored_by_name ?? null,
    restoredAt: r.restored_at ?? null,
    restoreReason: r.restore_reason ?? null,
    purgedBy: r.purged_by_name ?? null,
    purgedAt: r.purged_at ?? null,
    purgeReason: r.purge_reason ?? null,
  };
}

function summarize(results: ItemResult[]) {
  return {
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

/** Recycle Bin - Superadmin only (permission recycle.manage is granted to no other role). */
export function registerRecycleRoutes(router: Router) {
  // What still references a row, shown as a warning BEFORE it is moved to the bin (registered first so ":id" does not swallow it).
  router.get("/api/recycle/impact", async (ctx: Ctx) => {
    requirePermission(ctx, "recycle.manage");
    const url = new URL(ctx.request.url);
    const type = url.searchParams.get("entityType") as RecycleEntity;
    const id = url.searchParams.get("id") ?? "";
    if (!ENTITY_TYPES.includes(type) || !id) throw Errors.badRequest("Jenis data atau id tidak valid.");
    const def = ENTITIES[type];
    const row = await def.load(ctx.env, id);
    // Works both for a live row (warning before Hapus) and for one already in the bin (tracing what blocks/relates to it).
    if (!row) throw Errors.notFound("Data tidak ditemukan.");
    const rows = (await def.impact?.(ctx.env, row)) ?? [];
    return ok({ items: rows.filter((r) => r.count > 0), retentionDays: RETENTION_DAYS });
  });

  router.post("/api/recycle/delete", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "recycle.manage");
    const body = await parseJsonBody(ctx.request);
    const type = body.entityType as RecycleEntity;
    if (!ENTITY_TYPES.includes(type)) throw Errors.badRequest("Jenis data tidak didukung.");
    // Data Pengiriman can never be deleted (not even by Superadmin) - refused before anything is touched.
    if (type === "shipment") throw Errors.forbidden(SHIPMENT_DELETE_BLOCKED);
    const reason = readReason(body);
    const ids = readIds(body);
    const def = ENTITIES[type];

    const results: ItemResult[] = [];
    for (const id of ids) {
      const r = await softDelete(ctx.env, def, id, reason, { id: actor.id, nama: actor.nama });
      results.push({ id: r.id, ok: r.ok, message: r.message });
      if (r.ok && r.row) {
        await writeAuditLog(
          ctx.env,
          actor,
          {
            action: "RECYCLE_DELETE",
            actionLabel: "PINDAH KE RECYCLE BIN",
            module: "Recycle Bin",
            awb: def.awb?.(r.row),
            description: `${def.title} "${r.row.label}" (${id}) dipindahkan ke Recycle Bin. Alasan: ${reason}`,
          },
          ctx.request.headers.get("CF-Connecting-IP") ?? undefined,
        );
      }
    }
    const summary = summarize(results);
    if (ids.length === 1 && summary.failed === 1) {
      const msg = results[0].message ?? "Gagal menghapus data.";
      throw msg.startsWith("Data sudah") ? Errors.conflict(msg) : Errors.unprocessable(msg);
    }
    return ok(summary);
  });

  router.get("/api/recycle", async (ctx: Ctx) => {
    requirePermission(ctx, "recycle.manage");
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const where: string[] = [];
    const binds: unknown[] = [];
    const status = url.searchParams.get("status") ?? "IN_BIN";
    if (status !== "ALL") {
      where.push("status = ?");
      binds.push(status);
    }
    const type = url.searchParams.get("type");
    if (type) {
      where.push("entity_type = ?");
      binds.push(type);
    }
    const q = url.searchParams.get("q")?.trim();
    if (q) {
      const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      where.push(`(label LIKE ? ESCAPE '\\' OR entity_id LIKE ? ESCAPE '\\' OR sublabel LIKE ? ESCAPE '\\' OR delete_reason LIKE ? ESCAPE '\\')`);
      binds.push(like, like, like, like);
    }
    const by = url.searchParams.get("deletedBy")?.trim();
    if (by) {
      where.push("deleted_by_name = ?");
      binds.push(by);
    }
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from) {
      where.push("deleted_at >= ?");
      binds.push(`${from}T00:00:00.000Z`);
    }
    if (to) {
      where.push("deleted_at <= ?");
      binds.push(`${to}T23:59:59.999Z`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM recycle_bin ${whereSql}`).bind(...binds).first<{ c: number }>();
    const rows = await ctx.env.DB.prepare(
      `SELECT * FROM recycle_bin ${whereSql} ORDER BY deleted_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...binds, limit, offset)
      .all<BinRow & Record<string, unknown>>();
    const deleters = await ctx.env.DB.prepare(`SELECT DISTINCT deleted_by_name AS n FROM recycle_bin ORDER BY n`).all<{ n: string }>();
    return ok({
      items: (rows.results ?? []).map(toDto),
      meta: pageMeta(page, limit, total?.c ?? 0),
      retentionDays: RETENTION_DAYS,
      types: ENTITY_TYPES.map((t) => ({ value: t, label: ENTITIES[t].title })),
      deleters: (deleters.results ?? []).map((d) => d.n),
    });
  });

  router.get("/api/recycle/:id", async (ctx: Ctx, params) => {
    requirePermission(ctx, "recycle.manage");
    const row = await ctx.env.DB.prepare(`SELECT * FROM recycle_bin WHERE id = ?`)
      .bind(params.id)
      .first<BinRow & Record<string, unknown>>();
    if (!row) throw Errors.notFound("Data tidak ditemukan di Recycle Bin.");
    let snapshot: Record<string, unknown> | null = null;
    try {
      snapshot = row.snapshot ? JSON.parse(row.snapshot) : null;
    } catch {
      snapshot = null;
    }
    if (snapshot) {
      // Never expose credentials, even to a Superadmin looking at the bin.
      delete snapshot.password_hash;
    }
    return ok({ ...toDto(row), snapshot });
  });

  router.post("/api/recycle/restore", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "recycle.manage");
    const body = await parseJsonBody(ctx.request);
    const reason = readReason(body);
    const ids = readIds(body);
    const results: ItemResult[] = [];
    for (const id of ids) {
      const r = await restoreItem(ctx.env, id, reason, { id: actor.id, nama: actor.nama });
      results.push({ id: r.id, ok: r.ok, message: r.message });
      if (r.ok && r.bin && r.row) {
        const def = ENTITIES[r.bin.entity_type];
        await writeAuditLog(
          ctx.env,
          actor,
          {
            action: "RECYCLE_RESTORE",
            actionLabel: "PULIHKAN DARI RECYCLE BIN",
            module: "Recycle Bin",
            awb: def.awb?.(r.row),
            description: `${def.title} "${r.row.label}" (${r.bin.entity_id}) dipulihkan. Alasan: ${reason}`,
          },
          ctx.request.headers.get("CF-Connecting-IP") ?? undefined,
        );
      }
    }
    const summary = summarize(results);
    if (ids.length === 1 && summary.failed === 1) {
      const msg = results[0].message ?? "Gagal memulihkan data.";
      throw msg.includes("sudah tidak berada") ? Errors.conflict(msg) : Errors.unprocessable(msg);
    }
    return ok(summary);
  });

  // Manual permanent delete does not exist: rows leave the bin only through the nightly auto-purge after the
  // retention window. Kept as an explicit refusal (rather than a missing route) so a direct call gets a clear answer.
  router.post("/api/recycle/purge", async (ctx: Ctx) => {
    requirePermission(ctx, "recycle.manage");
    throw Errors.forbidden("Penghapusan permanen manual tidak tersedia. Penghapusan permanen otomatis juga sedang dinonaktifkan; data tetap tersimpan di Recycle Bin.");
  });
}
