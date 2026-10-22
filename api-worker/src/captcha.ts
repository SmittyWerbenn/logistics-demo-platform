import type { Ctx, Env } from "./types";
import { Errors, HttpError } from "./http";

/** Readable alphabet: no I/L/O/0/1/5/S/B/8. */
const CHARS = "ACDEFGHJKMNPQRTUVWXYZ234679";
const LENGTH = 6;
/** Tracking CAPTCHA switched off for now (flip to true to re-enable; keep in sync with src/utils/captchaApi.ts). */
export const TRACKING_CAPTCHA_ENABLED = false;
export const CAPTCHA_TTL_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const PASS_TTL_MS = 15 * 60 * 1000;
export const PASS_MAX_USES = 60;

// Hand-drawn stroke font (8 x 12 grid, y down). The CAPTCHA is drawn as vector
// PATHS - the SVG never contains the answer as text.
const GLYPHS: Record<string, string[]> = {
  A: ["0,12 4,0 8,12", "1.5,8 6.5,8"],
  C: ["8,2 6,0.5 2.5,0.5 0.5,3 0.5,9 2.5,11.5 6,11.5 8,10"],
  D: ["0,0 0,12", "0,0 4.5,0 7.5,3 8,6 7.5,9 4.5,12 0,12"],
  E: ["8,0 0,0 0,12 8,12", "0,6 6,6"],
  F: ["8,0 0,0 0,12", "0,6 6,6"],
  G: ["8,2 6,0.5 2.5,0.5 0.5,3 0.5,9 2.5,11.5 6,11.5 8,9.5 8,6.5 4.5,6.5"],
  H: ["0,0 0,12", "8,0 8,12", "0,6 8,6"],
  J: ["8,0 8,9 6.5,11.5 3,11.5 1,9.5"],
  K: ["0,0 0,12", "8,0 0,7", "2.5,5 8,12"],
  M: ["0,12 0,0 4,7 8,0 8,12"],
  N: ["0,12 0,0 8,12 8,0"],
  P: ["0,12 0,0 5.5,0 8,2 8,5 5.5,7 0,7"],
  Q: ["2.5,0.5 0.5,3 0.5,9 2.5,11.5 5.5,11.5 7.5,9 7.5,3 5.5,0.5 2.5,0.5", "5,9 8,12.5"],
  R: ["0,12 0,0 5.5,0 8,2 8,5 5.5,7 0,7", "4,7 8,12"],
  T: ["0,0 8,0", "4,0 4,12"],
  U: ["0,0 0,9 2,11.5 6,11.5 8,9 8,0"],
  V: ["0,0 4,12 8,0"],
  W: ["0,0 2,12 4,5 6,12 8,0"],
  X: ["0,0 8,12", "8,0 0,12"],
  Y: ["0,0 4,6 8,0", "4,6 4,12"],
  Z: ["0,0 8,0 0,12 8,12"],
  "2": ["0.5,3 2,1 5,0.5 7.5,2.5 7.5,5 0.5,12 8,12"],
  "3": ["0.5,1.5 7.5,1.5 4,5.5 6.5,6 8,8 7.5,10.5 5,12 2,12 0.5,10.5"],
  "4": ["6,12 6,0 0,8.5 8.5,8.5"],
  "6": ["7.5,1.5 5,0.5 2,1 0.5,4 0.5,9 2,11.5 5.5,11.5 7.5,9.5 7.5,7 5.5,5.5 2,5.5 0.5,7.5"],
  "7": ["0,0.5 8,0.5 3.5,12"],
  "9": ["7.5,4 5.5,6.5 2.5,6.5 0.5,4.5 0.5,2.5 2.5,0.5 5.5,0.5 7.5,2.5 7.5,8 6.5,10.5 4,12 1,11.5"],
};

function rand(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 0x100000000;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = (n: number) => Math.floor(rand() * n);

export function randomCode(): string {
  let s = "";
  for (let i = 0; i < LENGTH; i++) s += CHARS[pick(CHARS.length)];
  return s;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Light-noise SVG (vector paths, no text) for `code`. */
export function renderCaptchaSvg(code: string): string {
  const W = 240;
  const H = 80;
  const wave = between(1.6, 3);
  const freq = between(0.04, 0.07);
  const phase = rand() * Math.PI * 2;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fc"/><stop offset="1" stop-color="#eaf0f8"/></linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#g)"/>`,
  );
  // background noise: gold curves + dots
  for (let i = 0; i < 4; i++) {
    const y1 = between(8, H - 8);
    const y2 = between(8, H - 8);
    parts.push(
      `<path d="M0 ${r1(y1)} C ${r1(between(50, 90))} ${r1(between(0, H))}, ${r1(between(140, 190))} ${r1(between(0, H))}, ${W} ${r1(y2)}" fill="none" stroke="#d4a72c" stroke-opacity="0.45" stroke-width="1.4"/>`,
    );
  }
  for (let i = 0; i < 38; i++) {
    parts.push(`<circle cx="${r1(between(2, W - 2))}" cy="${r1(between(2, H - 2))}" r="${r1(between(0.7, 1.7))}" fill="${rand() > 0.5 ? "#d4a72c" : "#102f63"}" fill-opacity="0.35"/>`);
  }
  // characters
  const cell = (W - 24) / code.length;
  const scale = 3.3;
  for (let i = 0; i < code.length; i++) {
    const strokes = GLYPHS[code[i]];
    const sc = scale * between(0.92, 1.12);
    const rot = between(-0.26, 0.26);
    const cx = 12 + cell * i + cell / 2 + between(-2.5, 2.5);
    const cy = H / 2 + between(-5, 5);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const d: string[] = [];
    for (const s of strokes) {
      const pts = s.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
      // densify so the wave distortion bends straight segments too
      const dense: [number, number][] = [];
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k];
        const [x1, y1] = pts[k + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.6));
        for (let t = 0; t < steps; t++) dense.push([x0 + ((x1 - x0) * t) / steps, y0 + ((y1 - y0) * t) / steps]);
      }
      dense.push(pts[pts.length - 1]);
      d.push(
        dense
          .map(([gx, gy], k) => {
            const lx = (gx - 4) * sc + between(-0.1, 0.1);
            const ly = (gy - 6) * sc + between(-0.1, 0.1);
            const x = cx + lx * cos - ly * sin;
            let y = cy + lx * sin + ly * cos;
            y += wave * Math.sin(x * freq * 6 + phase);
            return `${k === 0 ? "M" : "L"}${r1(x)} ${r1(y)}`;
          })
          .join(""),
      );
    }
    parts.push(
      `<path d="${d.join("")}" fill="none" stroke="${i % 2 ? "#0b2553" : "#102f63"}" stroke-width="${r1(between(2.1, 2.6))}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  // strike-through lines on top (light)
  for (let i = 0; i < 2; i++) {
    parts.push(
      `<path d="M${r1(between(0, 20))} ${r1(between(15, 65))} Q ${r1(between(80, 160))} ${r1(between(0, H))} ${W} ${r1(between(15, 65))}" fill="none" stroke="#071b41" stroke-opacity="0.38" stroke-width="1.3"/>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

function clientIp(ctx: Ctx): string {
  return ctx.request.headers.get("CF-Connecting-IP") ?? "unknown";
}
export { clientIp };

/** Fixed-window counter in D1 (shared across isolates). Throws 429 over the limit. */
export async function rateLimit(env: Env, key: string, max: number, windowMs: number, message?: string): Promise<void> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count`,
  )
    .bind(key, windowStart)
    .first<{ count: number }>();
  if ((row?.count ?? 1) > max) throw Errors.rateLimited(message ?? "Terlalu banyak permintaan. Coba lagi dalam beberapa menit.");
}

export async function createChallenge(env: Env): Promise<{ id: string; image: string; expiresAt: number }> {
  if (rand() < 0.05) await purgeCaptchaData(env).catch(() => {});
  const code = randomCode();
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;
  await env.DB.prepare(`INSERT INTO captcha_challenges (id, code_hash, attempts, expires_at) VALUES (?, ?, 0, ?)`)
    .bind(id, await sha256Hex(`${id}:${code}`), expiresAt)
    .run();
  // The answer only ever exists here, as vector paths in the image.
  return { id, image: renderCaptchaSvg(code), expiresAt };
}

const captchaError = (status: number, code: string, message: string) => new HttpError(status, code, message);

/**
 * Verifies and CONSUMES a challenge: right code -> deleted (single use);
 * wrong code -> attempts+1, and after MAX_ATTEMPTS the challenge is deleted.
 */
export async function verifyCaptcha(env: Env, id: unknown, code: unknown): Promise<void> {
  if (typeof id !== "string" || id.length === 0 || typeof code !== "string" || code.trim().length === 0) {
    throw captchaError(422, "CAPTCHA_REQUIRED", "Silakan masukkan kode CAPTCHA.");
  }
  const clean = code.trim().toUpperCase().replace(/\s+/g, "");
  const now = Date.now();
  const row = await env.DB.prepare(`SELECT code_hash, attempts, expires_at FROM captcha_challenges WHERE id = ?`)
    .bind(id.slice(0, 64))
    .first<{ code_hash: string; attempts: number; expires_at: number }>();
  if (!row) throw captchaError(422, "CAPTCHA_EXPIRED", "Kode CAPTCHA telah kedaluwarsa. Silakan buat kode baru.");
  if (row.expires_at <= now) {
    await env.DB.prepare(`DELETE FROM captcha_challenges WHERE id = ?`).bind(id).run();
    throw captchaError(422, "CAPTCHA_EXPIRED", "Kode CAPTCHA telah kedaluwarsa. Silakan buat kode baru.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await env.DB.prepare(`DELETE FROM captcha_challenges WHERE id = ?`).bind(id).run();
    throw captchaError(422, "CAPTCHA_TOO_MANY", "Percobaan terlalu banyak. Silakan buat kode CAPTCHA baru.");
  }
  const hash = await sha256Hex(`${id}:${clean}`);
  if (hash === row.code_hash) {
    // Atomic claim: only one concurrent request can delete the row.
    const del = await env.DB.prepare(`DELETE FROM captcha_challenges WHERE id = ? AND code_hash = ? AND attempts < ?`)
      .bind(id, hash, MAX_ATTEMPTS)
      .run();
    if ((del.meta?.changes ?? 0) === 1) return;
    throw captchaError(422, "CAPTCHA_EXPIRED", "Kode CAPTCHA telah kedaluwarsa. Silakan buat kode baru.");
  }
  const upd = await env.DB.prepare(`UPDATE captcha_challenges SET attempts = attempts + 1 WHERE id = ? RETURNING attempts`)
    .bind(id)
    .first<{ attempts: number }>();
  if ((upd?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS) {
    await env.DB.prepare(`DELETE FROM captcha_challenges WHERE id = ?`).bind(id).run();
    throw captchaError(422, "CAPTCHA_TOO_MANY", "Percobaan terlalu banyak. Silakan buat kode CAPTCHA baru.");
  }
  throw captchaError(422, "CAPTCHA_INVALID", "Kode CAPTCHA tidak sesuai. Silakan coba lagi.");
}

/** Human pass issued after a solved CAPTCHA; only its hash is stored. */
export async function issuePass(env: Env): Promise<{ pass: string; expiresAt: number }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const pass = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = Date.now() + PASS_TTL_MS;
  await env.DB.prepare(`INSERT INTO human_passes (token_hash, uses, expires_at) VALUES (?, 0, ?)`)
    .bind(await sha256Hex(`pass:${pass}`), expiresAt)
    .run();
  return { pass, expiresAt };
}

/** Checks (and counts a use of) a pass. Throws 428 HUMAN_CHECK_REQUIRED if missing/expired/exhausted. */
export async function requirePass(env: Env, pass: string | null): Promise<void> {
  const fail = () => new HttpError(428, "HUMAN_CHECK_REQUIRED", "Verifikasi keamanan diperlukan untuk melihat data pengiriman.");
  if (!pass || !/^[0-9a-f]{48}$/.test(pass)) throw fail();
  const row = await env.DB.prepare(
    `UPDATE human_passes SET uses = uses + 1 WHERE token_hash = ? AND expires_at > ? AND uses < ? RETURNING uses`,
  )
    .bind(await sha256Hex(`pass:${pass}`), Date.now(), PASS_MAX_USES)
    .first<{ uses: number }>();
  if (!row) throw fail();
}

export async function purgeCaptchaData(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM captcha_challenges WHERE expires_at <= ?`).bind(now),
    env.DB.prepare(`DELETE FROM human_passes WHERE expires_at <= ?`).bind(now),
    env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).bind(now - 24 * 3600_000),
  ]);
}
