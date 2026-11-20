import type { Env, Ctx } from "./types";
import { Router } from "./router";
import { ok, errorResponse, Errors } from "./http";
import { loadUserFromRequest } from "./authMiddleware";
import { registerAuthRoutes } from "./routes/auth";
import { registerUserRoutes } from "./routes/users";
import { registerMitraRoutes } from "./routes/mitras";
import { registerLayananRoutes } from "./routes/layanan";
import { registerLocationRoutes } from "./routes/locations";
import { registerTruckRoutes } from "./routes/trucks";
import { registerShipmentRoutes } from "./routes/shipments";
import { registerFeedbackRoutes } from "./routes/feedback";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerAuditLogRoutes } from "./routes/auditlog";
import { registerSettingsRoutes } from "./routes/settings";
import { registerHelpRoutes } from "./routes/help";
import { registerFileRoutes } from "./routes/files";
import { registerPublicRoutes } from "./routes/public";
import { registerCaptchaRoutes } from "./routes/captcha";
import { purgeCaptchaData } from "./captcha";
import { registerOngkirRoutes } from "./routes/ongkir";
import { registerRecoveryRoutes } from "./routes/recovery";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerDriverRoutes } from "./routes/driver";
import { registerRecycleRoutes } from "./routes/recycle";
import { registerCancellationRoutes } from "./routes/cancellation";
import { registerHoldRoutes } from "./routes/hold";
import { registerRatePublishRoutes } from "./routes/ratepublish";
import { registerClientLogoRoutes } from "./routes/clientlogos";
import { registerDailyReportRoutes } from "./routes/dailyReport";
import { runDailyReport, type ReportSlot } from "./dailyReport";

const router = new Router();
registerAuthRoutes(router);
registerUserRoutes(router);
registerMitraRoutes(router);
registerLayananRoutes(router);
registerLocationRoutes(router);
registerTruckRoutes(router);
registerShipmentRoutes(router);
registerFeedbackRoutes(router);
registerNotificationRoutes(router);
registerAuditLogRoutes(router);
registerSettingsRoutes(router);
registerHelpRoutes(router);
registerFileRoutes(router);
registerPublicRoutes(router);
registerCaptchaRoutes(router);
registerOngkirRoutes(router);
registerRecoveryRoutes(router);
registerDashboardRoutes(router);
registerDriverRoutes(router);
registerRecycleRoutes(router);
registerCancellationRoutes(router);
registerHoldRoutes(router);
registerRatePublishRoutes(router);
registerClientLogoRoutes(router);
registerDailyReportRoutes(router);

router.get("/api/health", async () => ok({ status: "ok", time: new Date().toISOString() }));

function corsHeaders(origin: string | null, allowedOrigins: string[]): HeadersInit {
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID, X-Human-Pass",
    Vary: "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, allowedOrigins);
    const requestId = request.headers.get("X-Request-ID") || crypto.randomUUID();
    const startedAt = Date.now();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const ctx: Ctx = { env, request, user: null, requestId };

    try {
      ctx.user = await loadUserFromRequest(ctx);
      const response = await router.handle(ctx, url.pathname);
      const finalResponse = response ?? errorResponse(Errors.notFound("Endpoint tidak ditemukan."), requestId, cors);
      const headers = new Headers(finalResponse.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v as string);
      headers.set("X-Request-ID", requestId);

      console.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: url.pathname,
          status: response ? finalResponse.status : 404,
          durationMs: Date.now() - startedAt,
          userId: ctx.user?.id ?? null,
        }),
      );

      return new Response(finalResponse.body, { status: finalResponse.status, headers });
    } catch (err) {
      const resp = errorResponse(err, requestId, cors);
      const headers = new Headers(resp.headers);
      headers.set("X-Request-ID", requestId);
      console.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: url.pathname,
          status: resp.status,
          durationMs: Date.now() - startedAt,
          userId: ctx.user?.id ?? null,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return new Response(resp.body, { status: resp.status, headers });
    }
  },
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    // Captcha cleanup runs on the nightly 19:00 UTC cron (same as before).
    await purgeCaptchaData(env);

    // Daily shipment email reports at 11:00 and 17:00 WIB.
    // Cloudflare cron fires in UTC; event.cron identifies which schedule
    // triggered, so only one report runs per fire (no concurrent duplicates).
    if (env.DAILY_REPORT_ENABLED === "false") {
      console.log(JSON.stringify({ module: "DailyReport", event: "disabled", cron: event.cron }));
      return;
    }
    let slot: ReportSlot | null = null;
    if (event.cron === "0 4 * * *") slot = "11";
    else if (event.cron === "0 10 * * *") slot = "17";
    if (slot) {
      try {
        await runDailyReport(env, slot);
      } catch (err) {
        console.error(JSON.stringify({
          module: "DailyReport",
          event: "scheduled_error",
          cron: event.cron,
          slot,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }
  },
};
