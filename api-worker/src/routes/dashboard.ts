import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok } from "../http";
import { requirePermission } from "../authMiddleware";

export function registerDashboardRoutes(router: Router) {
  router.get("/api/dashboard/stats", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "shipments.view");
    const url = new URL(ctx.request.url);
    const stagnantDays = Number(url.searchParams.get("stagnantDays") ?? "3") || 3;
    const stagnantCutoff = new Date(Date.now() - stagnantDays * 24 * 60 * 60 * 1000).toISOString();
    // Client's dashboard numbers must only reflect its own customer's
    // shipments - trucks/feedback stats stay global since those aren't
    // customer-scoped data. Mitra is scoped the same way, by mitra_id.
    // Dashboard feedback stats (avgRating) must also respect scoping:
    // Client/Viewer with customerId only sees ratings for their own AWBs.
    const custScope = actor.role === "Client" || (actor.role === "Viewer" && !!actor.customerId);
    const mitraScope = actor.role === "Mitra";
    const custWhere = custScope ? `AND customer_id = ?` : mitraScope ? `AND mitra_id = ?` : "";
    const custBind = (...extra: unknown[]) =>
      custScope ? [...extra, actor.customerId] : mitraScope ? [...extra, actor.mitraId] : extra;
    // Cancelled orders are internal-admin/owning-customer data only - never
    // counted or listed for Viewer/Driver/Mitra, even in aggregate stats.
    const hideCancelled = actor.role === "Viewer" || actor.role === "Driver" || actor.role === "Mitra";
    const cancelWhere = (hideCancelled ? `AND status != 'Dibatalkan'` : "") + (actor.role === "Driver" || actor.role === "Mitra" ? ` AND status != 'Hold'` : "");

    // Average rating: scoped for Client/Viewer/Mitra, global for others.
    const ratingWhere = custScope
      ? "WHERE f.awb IN (SELECT awb FROM shipments WHERE customer_id = ?)"
      : mitraScope
        ? "WHERE f.awb IN (SELECT awb FROM shipments WHERE mitra_id = ?)"
        : "";
    const ratingBind: unknown[] = custScope ? [actor.customerId] : mitraScope ? [actor.mitraId] : [];

    const [byStatus, total, stagnant, trucks, avgRating, recent] = await Promise.all([
      ctx.env.DB.prepare(`SELECT status, COUNT(*) as c FROM shipments WHERE deleted_at IS NULL ${custWhere} ${cancelWhere} GROUP BY status`)
        .bind(...custBind())
        .all<{ status: string; c: number }>(),
      ctx.env.DB.prepare(`SELECT COUNT(*) as c FROM shipments WHERE deleted_at IS NULL ${custWhere} ${cancelWhere}`)
        .bind(...custBind())
        .first<{ c: number }>(),
      ctx.env.DB.prepare(
        `SELECT COUNT(*) as c FROM shipments WHERE deleted_at IS NULL AND status NOT IN ('Selesai / Terkirim', 'Dibatalkan', 'Hold') AND updated_at < ? ${custWhere}`,
      )
        .bind(...custBind(stagnantCutoff))
        .first<{ c: number }>(),
      // A Client's fleet numbers cover only its own dedicated units; a Mitra gets no fleet numbers at all.
      mitraScope
        ? Promise.resolve({ results: [] as { status: string; c: number }[] })
        : custScope
        ? ctx.env.DB.prepare(
            `SELECT t.status, COUNT(*) as c FROM trucks t JOIN fleet_client_assignments a ON a.truck_id = t.id AND a.status = 'ACTIVE' AND a.customer_id = ?
             WHERE t.deleted_at IS NULL GROUP BY t.status`,
          ).bind(actor.customerId).all<{ status: string; c: number }>()
        : ctx.env.DB.prepare(`SELECT status, COUNT(*) as c FROM trucks WHERE deleted_at IS NULL GROUP BY status`).all<{ status: string; c: number }>(),
      ctx.env.DB.prepare(
        `SELECT AVG(f.rating) as avg FROM feedback f ${ratingWhere}`,
      )
        .bind(...ratingBind)
        .first<{ avg: number | null }>(),
      ctx.env.DB.prepare(
        `SELECT awb, status, kota_asal, kota_tujuan, tanggal_dibuat FROM shipments WHERE deleted_at IS NULL ${custWhere} ${cancelWhere} ORDER BY tanggal_dibuat DESC, jam_dibuat DESC LIMIT 5`,
      )
        .bind(...custBind())
        .all(),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus.results ?? []) statusCounts[row.status] = row.c;

    const truckCounts: Record<string, number> = {};
    for (const row of trucks.results ?? []) truckCounts[row.status] = row.c;
    const totalTrucks = Object.values(truckCounts).reduce((a, b) => a + b, 0);

    return ok({
      totalShipments: total?.c ?? 0,
      statusCounts,
      stagnantCount: stagnant?.c ?? 0,
      totalTrucks,
      truckOnTrip: truckCounts["On Trip"] ?? 0,
      avgRating: avgRating?.avg ?? null,
      recentShipments: recent.results,
    });
  });

  // Finance report: revenue, receivables (PAD) outstanding/aging, top customers & routes.
  // Ekspedisi data only; same permission as the Ekspedisi module.
  router.get("/api/dashboard/finance", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const url = new URL(ctx.request.url);
    const months = Math.min(12, Math.max(1, Number(url.searchParams.get("months") ?? "6") || 6));
    const todayStr = new Date().toISOString().slice(0, 10);
    const first = new Date();
    first.setUTCDate(1);
    first.setUTCMonth(first.getUTCMonth() - (months - 1));
    const fromDate = first.toISOString().slice(0, 10);

    const [orders, recv, topCust, topRoute] = await Promise.all([
      ctx.env.DB.prepare(`SELECT substr(order_date,1,7) AS ym, COUNT(*) AS n, COALESCE(SUM(total),0) AS rev FROM ep_orders WHERE status != 'Batal' AND order_date >= ? GROUP BY ym ORDER BY ym`)
        .bind(fromDate).all<{ ym: string; n: number; rev: number }>(),
      ctx.env.DB.prepare(`SELECT r.amount, r.due_date, r.status, r.paid_at FROM ep_receivables r JOIN ep_orders o ON o.id = r.order_id WHERE o.status != 'Batal'`)
        .all<{ amount: number; due_date: string | null; status: string; paid_at: string | null }>(),
      ctx.env.DB.prepare(
        `SELECT COALESCE(c.nama,'(tanpa customer)') AS nama, COUNT(*) AS n, COALESCE(SUM(o.total),0) AS rev
         FROM ep_orders o LEFT JOIN ep_customers c ON c.id = COALESCE(o.payer_id, o.sender_id)
         WHERE o.status != 'Batal' AND o.order_date >= ? GROUP BY nama ORDER BY rev DESC LIMIT 5`,
      ).bind(fromDate).all<{ nama: string; n: number; rev: number }>(),
      ctx.env.DB.prepare(
        `SELECT r.asal || ' → ' || r.tujuan AS rute, COUNT(*) AS n, COALESCE(SUM(o.total),0) AS rev
         FROM ep_orders o JOIN ep_routes r ON r.id = o.route_id
         WHERE o.status != 'Batal' AND o.order_date >= ? GROUP BY rute ORDER BY rev DESC LIMIT 5`,
      ).bind(fromDate).all<{ rute: string; n: number; rev: number }>(),
    ]);

    // Monthly trend, zero-filled for the requested window.
    const byMonth = new Map((orders.results ?? []).map((r) => [r.ym, r]));
    const paidByMonth = new Map<string, number>();
    const aging = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
    let outstanding = 0, overdue = 0, overdueCount = 0, openCount = 0, paidTotal = 0, billedNotPaid = 0, unbilled = 0;
    for (const r of recv.results ?? []) {
      if (r.status === "Lunas") {
        paidTotal += r.amount;
        const ym = (r.paid_at ?? "").slice(0, 7);
        if (ym) paidByMonth.set(ym, (paidByMonth.get(ym) ?? 0) + r.amount);
        continue;
      }
      outstanding += r.amount;
      openCount++;
      if (r.status === "Ditagih") billedNotPaid += r.amount; else unbilled += r.amount;
      const late = r.due_date && r.due_date < todayStr ? Math.floor((Date.parse(todayStr) - Date.parse(r.due_date)) / 86400000) : 0;
      if (late <= 0) aging.current += r.amount;
      else {
        overdue += r.amount;
        overdueCount++;
        if (late <= 30) aging.d1_30 += r.amount;
        else if (late <= 60) aging.d31_60 += r.amount;
        else aging.d60plus += r.amount;
      }
    }
    const trend: Array<{ month: string; orders: number; revenue: number; paid: number }> = [];
    const cur = new Date(fromDate + "T00:00:00Z");
    for (let i = 0; i < months; i++) {
      const ym = cur.toISOString().slice(0, 7);
      const o = byMonth.get(ym);
      trend.push({ month: ym, orders: o?.n ?? 0, revenue: o?.rev ?? 0, paid: paidByMonth.get(ym) ?? 0 });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    const revenueTotal = trend.reduce((a, t) => a + t.revenue, 0);
    const ordersTotal = trend.reduce((a, t) => a + t.orders, 0);
    const thisMonth = trend[trend.length - 1];
    const prevMonth = trend.length > 1 ? trend[trend.length - 2] : null;

    return ok({
      months,
      revenueTotal,
      ordersTotal,
      avgOrderValue: ordersTotal ? Math.round(revenueTotal / ordersTotal) : 0,
      revenueThisMonth: thisMonth?.revenue ?? 0,
      revenuePrevMonth: prevMonth?.revenue ?? 0,
      outstanding,
      overdue,
      overdueCount,
      openCount,
      paidTotal,
      unbilled,
      billedNotPaid,
      aging,
      trend,
      topCustomers: topCust.results ?? [],
      topRoutes: topRoute.results ?? [],
    });
  });
}
