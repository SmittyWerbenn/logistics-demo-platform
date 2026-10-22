import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors, HttpError } from "../http";
import { parseJsonBody, reqString, reqEmail, optString } from "../validate";
import { hashPassword, verifyPassword, randomToken, sha256Hex, newId } from "../crypto";
import { requireAuth } from "../authMiddleware";
import { writeAuditLog } from "../audit";

const MAX_LOGIN_ATTEMPTS_PER_WINDOW = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const loginAttempts = new Map<string, number[]>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const attempts = (loginAttempts.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  if (attempts.length >= MAX_LOGIN_ATTEMPTS_PER_WINDOW) {
    throw Errors.rateLimited("Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.");
  }
  attempts.push(now);
  loginAttempts.set(key, attempts);
}

export function registerAuthRoutes(router: Router) {
  router.post("/api/auth/login", async (ctx) => {
    const body = await parseJsonBody(ctx.request);
    const email = reqEmail(body, "email");
    const password = reqString(body, "password");
    const ip = ctx.request.headers.get("CF-Connecting-IP") ?? "unknown";
    checkRateLimit(`${ip}:${email}`);

    const user = await ctx.env.DB.prepare(
      `SELECT id, nama, email, password_hash, role, aktif, customer_id, mitra_id FROM users WHERE email = ? AND deleted_at IS NULL`,
    )
      .bind(email)
      .first<{
        id: string;
        nama: string;
        email: string;
        password_hash: string;
        role: string;
        aktif: number;
        customer_id: string | null;
        mitra_id: string | null;
      }>();

    const validPassword = user ? await verifyPassword(password, user.password_hash) : false;
    // Accounts of a deactivated Client/Mitra are frozen: no login until reactivated.
    const clientFrozen = user?.customer_id
      ? !!(await ctx.env.DB.prepare(`SELECT 1 FROM clients WHERE customer_id = ? AND (aktif = 0 OR deleted_at IS NOT NULL)`).bind(user.customer_id).first())
      : false;
    const mitraFrozen = user?.mitra_id
      ? !!(await ctx.env.DB.prepare(`SELECT 1 FROM mitras WHERE kode_mitra = ? AND (aktif = 0 OR deleted_at IS NOT NULL)`).bind(user.mitra_id).first())
      : false;
    if (user && validPassword && user.aktif === 1 && (clientFrozen || mitraFrozen)) {
      await writeAuditLog(ctx.env, null, {
        action: "LOGIN_FAILED",
        actionLabel: "LOGIN FAILED",
        module: "Auth",
        description: clientFrozen
          ? `Login ditolak untuk ${email}: Client ${user.customer_id} nonaktif.`
          : `Login ditolak untuk ${email}: Mitra ${user.mitra_id} nonaktif.`,
      }, ip);
      throw Errors.forbidden(
        clientFrozen ? "Akun Client Anda dinonaktifkan. Hubungi admin GMS." : "Akun Mitra Anda dinonaktifkan. Hubungi admin GMS.",
      );
    }
    if (!user) {
      await writeAuditLog(ctx.env, null, {
        action: "LOGIN_FAILED",
        actionLabel: "LOGIN FAILED",
        module: "Auth",
        description: `Percobaan login gagal untuk ${email}: email tidak terdaftar.`,
      }, ip);
      throw new HttpError(401, "EMAIL_NOT_REGISTERED", "Email tidak terdaftar.");
    }
    if (!user || !validPassword || user.aktif !== 1) {
      await writeAuditLog(ctx.env, null, {
        action: "LOGIN_FAILED",
        actionLabel: "LOGIN FAILED",
        module: "Auth",
        description: `Percobaan login gagal untuk ${email}.`,
      }, ip);
      // Same message for every failure. Only the error code differs, so the
      // login pages know whether to offer "Hubungi Admin" after repeated
      // wrong passwords: not for Admin/Superadmin, Driver portal only for
      // Driver accounts, admin portal for everyone else (Client/Viewer/
      // unknown email).
      const group = user?.role === "Admin" || user?.role === "Superadmin" ? "STAFF" : user?.role === "Driver" ? "DRIVER" : "OTHER";
      throw new HttpError(401, `BAD_CREDENTIALS_${group}`, "Email atau password salah.");
    }

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const ttlHours = Number(ctx.env.SESSION_TTL_HOURS) || 24;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    await ctx.env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId(), user.id, tokenHash, now.toISOString(), expiresAt.toISOString(), ctx.request.headers.get("User-Agent") ?? "", ip)
      .run();

    await ctx.env.DB.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).bind(now.toISOString(), user.id).run();

    await writeAuditLog(
      ctx.env,
      { id: user.id, nama: user.nama, email: user.email, role: user.role as any, aktif: 1, customerId: user.customer_id, mitraId: user.mitra_id },
      { action: "LOGIN_SUCCESS", actionLabel: "LOGIN SUCCESS", module: "Auth", description: `${user.nama} berhasil login.` },
      ip,
    );

    return ok({
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, nama: user.nama, email: user.email, role: user.role, customerId: user.customer_id, mitraId: user.mitra_id },
    });
  });

  router.post("/api/auth/logout", async (ctx: Ctx) => {
    requireAuth(ctx);
    const authHeader = ctx.request.headers.get("Authorization");
    const token = authHeader?.slice("Bearer ".length).trim();
    if (token) {
      const tokenHash = await sha256Hex(token);
      await ctx.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`)
        .bind(new Date().toISOString(), tokenHash)
        .run();
    }
    return ok({ loggedOut: true });
  });

  router.get("/api/auth/me", async (ctx: Ctx) => {
    const user = requireAuth(ctx);
    const row = await ctx.env.DB.prepare(
      `SELECT id, nama, email, role, aktif, foto_file_id, last_login_at, customer_id, mitra_id FROM users WHERE id = ?`,
    )
      .bind(user.id)
      .first();
    if (!row) throw Errors.notFound();
    return ok(row);
  });

  router.patch("/api/auth/me", async (ctx: Ctx) => {
    const user = requireAuth(ctx);
    const body = await parseJsonBody(ctx.request);
    const nama = reqString(body, "nama", { max: 100 });
    const email = reqEmail(body, "email");
    const fotoFileId = optString(body, "fotoFileId");

    const existing = await ctx.env.DB.prepare(`SELECT id FROM users WHERE email = ? AND id != ?`)
      .bind(email, user.id)
      .first();
    if (existing) throw Errors.conflict("Email sudah dipakai user lain.");

    await ctx.env.DB.prepare(
      `UPDATE users SET nama = ?, email = ?, foto_file_id = COALESCE(?, foto_file_id), updated_at = ?, updated_by = ? WHERE id = ?`,
    )
      .bind(nama, email, fotoFileId ?? null, new Date().toISOString(), user.id, user.id)
      .run();

    await writeAuditLog(ctx.env, user, {
      action: "UPDATE_USER",
      actionLabel: "UPDATE PROFILE",
      module: "Auth",
      description: `${user.nama} memperbarui profil sendiri.`,
    });

    return ok({ updated: true });
  });

  router.post("/api/auth/change-password", async (ctx: Ctx) => {
    const user = requireAuth(ctx);
    const body = await parseJsonBody(ctx.request);
    const currentPassword = reqString(body, "currentPassword");
    const newPassword = reqString(body, "newPassword", { min: 8 });

    const row = await ctx.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?`).bind(user.id).first<{
      password_hash: string;
    }>();
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      throw Errors.unauthenticated("Password saat ini salah.");
    }

    const newHash = await hashPassword(newPassword);
    await ctx.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
      .bind(newHash, new Date().toISOString(), user.id)
      .run();

    // Password changed: revoke every other active session for this user.
    await ctx.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
      .bind(new Date().toISOString(), user.id)
      .run();

    await writeAuditLog(ctx.env, user, {
      action: "PASSWORD_CHANGED",
      actionLabel: "PASSWORD CHANGED",
      module: "Auth",
      description: `${user.nama} mengganti password sendiri.`,
    });

    return ok({ changed: true });
  });
}
