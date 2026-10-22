import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok } from "../http";
import { requirePermission } from "../authMiddleware";
import { parsePagination, pageMeta } from "../pagination";

export function registerNotificationRoutes(router: Router) {
  router.get("/api/notifications", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "notifications.view");
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);

    // Scoping rules (applied server-side, never from the client):
    //   Client / Viewer (with customerId) → only AWBs of their own customer
    //   Mitra → only AWBs assigned to that partner
    //   Superadmin / Admin / Driver → global feed (unchanged)
    const custScope = actor.role === "Client" || (actor.role === "Viewer" && !!actor.customerId);
    const mitraScope = actor.role === "Mitra";
    const where = custScope
      ? "WHERE n.awb IN (SELECT awb FROM shipments WHERE customer_id = ?)"
      : mitraScope
        ? "WHERE n.awb IN (SELECT awb FROM shipments WHERE mitra_id = ?)"
        : "";
    const bind: unknown[] = custScope ? [actor.customerId] : mitraScope ? [actor.mitraId] : [];

    const total = await ctx.env.DB.prepare(
      `SELECT COUNT(*) as c FROM notifications n ${where}`,
    )
      .bind(...bind)
      .first<{ c: number }>();
    const rows = await ctx.env.DB.prepare(
      `SELECT n.* FROM notifications n ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...bind, limit, offset)
      .all();

    return ok({ items: rows.results, meta: pageMeta(page, limit, total?.c ?? 0) });
  });

  // Marks every still-unread notification as read - fired when the admin
  // opens the notification bell/center, so the unread badge clears once
  // they've actually seen the list (shared read state, not per-user).
  // Scoped roles (Client/Viewer/Mitra) only mark notifications belonging
  // to their own scope — they must never touch other customers' data.
  router.post("/api/notifications/read-all", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "notifications.view");
    const custScope = actor.role === "Client" || (actor.role === "Viewer" && !!actor.customerId);
    const mitraScope = actor.role === "Mitra";
    const now = new Date().toISOString();

    if (custScope) {
      await ctx.env.DB.prepare(
        `UPDATE notifications SET is_read = 1, read_at = ?
         WHERE is_read = 0 AND awb IN (SELECT awb FROM shipments WHERE customer_id = ?)`,
      )
        .bind(now, actor.customerId)
        .run();
    } else if (mitraScope) {
      await ctx.env.DB.prepare(
        `UPDATE notifications SET is_read = 1, read_at = ?
         WHERE is_read = 0 AND awb IN (SELECT awb FROM shipments WHERE mitra_id = ?)`,
      )
        .bind(now, actor.mitraId)
        .run();
    } else {
      await ctx.env.DB.prepare(`UPDATE notifications SET is_read = 1, read_at = ? WHERE is_read = 0`)
        .bind(now)
        .run();
    }
    return ok({ updated: true });
  });
}