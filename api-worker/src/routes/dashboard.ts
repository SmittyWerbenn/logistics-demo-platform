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
}
