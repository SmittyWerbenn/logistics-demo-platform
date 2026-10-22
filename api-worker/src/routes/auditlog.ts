import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok } from "../http";
import { requirePermission } from "../authMiddleware";
import { parsePagination, pageMeta, likeTerm } from "../pagination";

export function registerAuditLogRoutes(router: Router) {
  router.get("/api/audit-logs", async (ctx: Ctx) => {
    requirePermission(ctx, "audit.view");
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const action = url.searchParams.get("action");
    const module = url.searchParams.get("module");
    const awb = url.searchParams.get("awb");
    const userName = url.searchParams.get("user");
    const awbContains = url.searchParams.get("awbContains")?.trim();
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: string[] = [];
    const params: unknown[] = [];
    if (action) { where.push("action = ?"); params.push(action); }
    if (module) { where.push("module = ?"); params.push(module); }
    if (awb) { where.push("awb = ?"); params.push(awb); }
    if (userName) { where.push("user_name LIKE ? ESCAPE '\\'"); params.push(likeTerm(userName)); }
    if (awbContains) { where.push("awb LIKE ? ESCAPE '\\'"); params.push(likeTerm(awbContains)); }
    const q = url.searchParams.get("q")?.trim();
    if (q) {
      where.push("(description LIKE ? ESCAPE '\\' OR user_name LIKE ? ESCAPE '\\' OR awb LIKE ? ESCAPE '\\' OR action_label LIKE ? ESCAPE '\\')");
      params.push(likeTerm(q), likeTerm(q), likeTerm(q), likeTerm(q));
    }
    // ISO timestamps (UTC) compare correctly as text.
    if (from) { where.push("timestamp >= ?"); params.push(from); }
    if (to) { where.push("timestamp <= ?"); params.push(to); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) as c FROM audit_log ${whereSql}`)
      .bind(...params)
      .first<{ c: number }>();
    const rows = await ctx.env.DB.prepare(
      `SELECT * FROM audit_log ${whereSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all();

    return ok({ items: rows.results, meta: pageMeta(page, limit, total?.c ?? 0) });
  });

  // Distinct values for the Audit Log filter dropdowns (users / actions / modules).
  router.get("/api/audit-logs/facets", async (ctx: Ctx) => {
    requirePermission(ctx, "audit.view");
    const [users, actions, modules] = await Promise.all([
      ctx.env.DB.prepare(`SELECT DISTINCT user_name AS v FROM audit_log WHERE user_name IS NOT NULL ORDER BY user_name COLLATE NOCASE`).all<{ v: string }>(),
      ctx.env.DB.prepare(`SELECT DISTINCT action AS v FROM audit_log ORDER BY action`).all<{ v: string }>(),
      ctx.env.DB.prepare(`SELECT DISTINCT module AS v FROM audit_log ORDER BY module`).all<{ v: string }>(),
    ]);
    const list = (r: { results?: { v: string }[] }) => (r.results ?? []).map((x) => x.v);
    return ok({ users: list(users), actions: list(actions), modules: list(modules) });
  });
}
