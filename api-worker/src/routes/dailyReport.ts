import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { requirePermission } from "../authMiddleware";
import { runDailyReport, pickSlot, type ReportSlot } from "../dailyReport";

/** Manual trigger for testing the daily report without waiting for the cron.
 * Superadmin only — the endpoint runs the same logic as the scheduler, but
 * supports an explicit slot / date / force flag so re-runs are safe. */
export function registerDailyReportRoutes(router: Router) {
  router.post("/api/admin/daily-report/run", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "recycle.manage"); // Superadmin-only permission
    const body = (await ctx.request.json().catch(() => ({}))) as { slot?: string; date?: string; force?: boolean };

    const slot: ReportSlot = pickSlot(body.slot);
    // Validate optional date override
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw Errors.badRequest("Format date harus YYYY-MM-DD.");
    }

    const result = await runDailyReport(ctx.env, slot, { date: body.date, force: body.force ?? false });

    // Audit the manual trigger (distinct from the per-recipient DAILY_REPORT_SENT
    // entries written inside runDailyReport).
    console.log(JSON.stringify({
      module: "DailyReport",
      event: "manual_trigger",
      triggeredBy: actor.email,
      slot: result.slot,
      date: result.date,
      sent: result.recipients.filter((r) => r.status === "sent").length,
      failed: result.recipients.filter((r) => r.status === "failed").length,
      skipped: result.recipients.filter((r) => r.status === "skipped").length,
    }));

    return ok(result);
  });
}
