import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody } from "../validate";
import { newId } from "../crypto";
import { CAPTCHA_TTL_MS, clientIp, createChallenge, issuePass, rateLimit, verifyCaptcha } from "../captcha";

const TEN_MIN = 10 * 60 * 1000;

function text(body: Record<string, unknown>, field: string, max: number, required: boolean): string {
  const v = body[field];
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    if (required) throw Errors.badRequest(`Field "${field}" wajib diisi.`);
    return "";
  }
  if (typeof v !== "string") throw Errors.badRequest(`Field "${field}" harus berupa teks.`);
  const t = v.trim();
  if (t.length > max) throw Errors.badRequest(`Field "${field}" maksimal ${max} karakter.`);
  return t;
}

export function registerCaptchaRoutes(router: Router) {
  // New challenge. Returns only an id + the image (vector paths) - never the answer.
  router.post("/api/public/captcha", async (ctx: Ctx) => {
    await rateLimit(ctx.env, `captcha:${clientIp(ctx)}`, 40, TEN_MIN);
    const c = await createChallenge(ctx.env);
    return ok({ id: c.id, image: c.image, expiresAt: c.expiresAt, ttlSeconds: CAPTCHA_TTL_MS / 1000 }, { "Cache-Control": "no-store" });
  });

  // Request Quotation: rate limit -> CAPTCHA -> input validation -> store.
  router.post("/api/public/quotation", async (ctx: Ctx) => {
    await rateLimit(ctx.env, `quotation:${clientIp(ctx)}`, 10, TEN_MIN);
    const body = await parseJsonBody(ctx.request);
    await verifyCaptcha(ctx.env, body.captchaId, body.captchaCode);

    const nama = text(body, "nama", 100, true);
    const perusahaan = text(body, "perusahaan", 100, false);
    const email = text(body, "email", 120, true);
    const telepon = text(body, "telepon", 30, true);
    const jenis = text(body, "jenisPengiriman", 100, true);
    const asal = text(body, "asal", 120, true);
    const tujuan = text(body, "tujuan", 120, true);
    const pesan = text(body, "pesan", 1000, false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Errors.badRequest("Format email tidak valid.");
    if (telepon.replace(/\D/g, "").length < 8) throw Errors.badRequest("Nomor HP tidak valid.");

    const id = newId();
    await ctx.env.DB.prepare(
      `INSERT INTO quotation_requests (id, nama, perusahaan, email, telepon, jenis_pengiriman, asal, tujuan, pesan, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, nama, perusahaan || null, email, telepon, jenis, asal, tujuan, pesan || null, clientIp(ctx), new Date().toISOString())
      .run();
    return ok({ id }, { "Cache-Control": "no-store" }, 201);
  });

  // Tracking: rate limit -> CAPTCHA -> human pass (needed by GET /api/public/shipments/:awb).
  router.post("/api/public/tracking/verify", async (ctx: Ctx) => {
    await rateLimit(ctx.env, `trackverify:${clientIp(ctx)}`, 30, TEN_MIN);
    const body = await parseJsonBody(ctx.request);
    await verifyCaptcha(ctx.env, body.captchaId, body.captchaCode);
    return ok(await issuePass(ctx.env), { "Cache-Control": "no-store" });
  });
}
