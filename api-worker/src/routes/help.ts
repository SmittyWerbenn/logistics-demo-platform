import type { Router } from "../router";
import type { Ctx, Role } from "../types";
import { ok, Errors, HttpError } from "../http";
import { parseJsonBody } from "../validate";
import { requireAuth } from "../authMiddleware";
import {
  HELP_TARGET_LABEL,
  helpTargetForRole,
  isHelpTopic,
  loadHelpNumber,
  lupaPasswordTarget,
  type HelpTarget,
} from "../help";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

/** Small in-memory limiter for the public lookup (per client IP). */
function checkRateLimit(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) throw Errors.rateLimited("Terlalu banyak permintaan. Coba lagi dalam beberapa menit.");
  recent.push(now);
  hits.set(key, recent);
}

async function answer(ctx: Ctx, target: HelpTarget) {
  const number = await loadHelpNumber(ctx.env.DB, target);
  return ok({ target, targetLabel: HELP_TARGET_LABEL[target], configured: number !== null, number });
}

export function registerHelpRoutes(router: Router) {
  // "Lupa Password" from the login pages. Nobody is signed in yet, so the
  // destination is chosen from the role of the account behind the typed email.
  // Only the destination number is returned - nothing about the account itself.
  router.post("/api/public/help-whatsapp", async (ctx: Ctx) => {
    checkRateLimit(ctx.request.headers.get("CF-Connecting-IP") ?? "unknown");
    const body = await parseJsonBody(ctx.request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) throw Errors.badRequest("Email wajib diisi.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Errors.badRequest("Format email tidak valid.");
    const user = await ctx.env.DB.prepare(`SELECT role FROM users WHERE email = ? COLLATE NOCASE AND deleted_at IS NULL`)
      .bind(email)
      .first<{ role: Role }>();
    // Unknown email: stop here - no WhatsApp number is handed out.
    if (!user) throw new HttpError(404, "EMAIL_NOT_REGISTERED", "Email tidak terdaftar");
    return answer(ctx, lupaPasswordTarget(user.role));
  });

  // For a signed-in user (e.g. Driver -> "Hubungi Kendala"): the destination
  // comes from the caller's own role, never from the request.
  router.get("/api/help-whatsapp", async (ctx: Ctx) => {
    const actor = requireAuth(ctx);
    const topic = new URL(ctx.request.url).searchParams.get("topic");
    if (!isHelpTopic(topic)) throw Errors.badRequest("Jenis bantuan tidak dikenal.");
    const target = helpTargetForRole(topic, actor.role);
    if (!target) throw Errors.forbidden("Bantuan ini tidak tersedia untuk role Anda.");
    return answer(ctx, target);
  });
}
