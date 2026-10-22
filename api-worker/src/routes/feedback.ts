import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok } from "../http";
import { requirePermission } from "../authMiddleware";
import { parsePagination, pageMeta } from "../pagination";

export function registerFeedbackRoutes(router: Router) {
  router.get("/api/feedback", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "feedback.view");
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);

    // Client accounts and Viewers with a linked customer_id only see feedback
    // for AWB/resi belonging to their own customer (shipments.customer_id).
    // Superadmin/Admin/Driver/Mitra see all feedback globally.
    const custScope = actor.role === "Client" || (actor.role === "Viewer" && !!actor.customerId);
    const mitraScope = actor.role === "Mitra";
    const where = custScope
      ? "WHERE f.awb IN (SELECT awb FROM shipments WHERE customer_id = ?)"
      : mitraScope
        ? "WHERE f.awb IN (SELECT awb FROM shipments WHERE mitra_id = ?)"
        : "";
    const bind: unknown[] = custScope ? [actor.customerId] : mitraScope ? [actor.mitraId] : [];

    const total = await ctx.env.DB.prepare(
      `SELECT COUNT(*) as c FROM feedback f ${where}`,
    )
      .bind(...bind)
      .first<{ c: number }>();
    const rows = await ctx.env.DB.prepare(
      `SELECT f.* FROM feedback f ${where} ORDER BY f.submitted_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...bind, limit, offset)
      .all();

    // Summary (rating breakdown) for scoped users only reflects their own
    // data — global averages should not leak to customer-scoped roles.
    const summary = custScope || mitraScope
      ? await ctx.env.DB.prepare(
          `SELECT COUNT(*) as count, AVG(rating) as avg_rating,
            SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END) as r5,
            SUM(CASE WHEN rating=4 THEN 1 ELSE 0 END) as r4,
            SUM(CASE WHEN rating=3 THEN 1 ELSE 0 END) as r3,
            SUM(CASE WHEN rating=2 THEN 1 ELSE 0 END) as r2,
            SUM(CASE WHEN rating=1 THEN 1 ELSE 0 END) as r1
           FROM feedback f ${where}`,
        ).bind(...bind).first()
      : await ctx.env.DB.prepare(
          `SELECT COUNT(*) as count, AVG(rating) as avg_rating,
            SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END) as r5,
            SUM(CASE WHEN rating=4 THEN 1 ELSE 0 END) as r4,
            SUM(CASE WHEN rating=3 THEN 1 ELSE 0 END) as r3,
            SUM(CASE WHEN rating=2 THEN 1 ELSE 0 END) as r2,
            SUM(CASE WHEN rating=1 THEN 1 ELSE 0 END) as r1
           FROM feedback`,
        ).first();

    return ok({ items: rows.results, meta: pageMeta(page, limit, total?.c ?? 0), summary });
  });
}