import type { Ctx, AuthedUser } from "./types";
import { sha256Hex } from "./crypto";
import { Errors } from "./http";
import { hasPermission, type Permission } from "./rbac";

export async function loadUserFromRequest(ctx: Ctx): Promise<AuthedUser | null> {
  const authHeader = ctx.request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();

  const row = await ctx.env.DB.prepare(
    `SELECT u.id, u.nama, u.email, u.role, u.aktif, u.customer_id as customerId, u.mitra_id as mitraId
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.customer_id = u.customer_id AND (c.aktif = 0 OR c.deleted_at IS NOT NULL))
       AND NOT EXISTS (SELECT 1 FROM mitras m WHERE m.kode_mitra = u.mitra_id AND (m.aktif = 0 OR m.deleted_at IS NOT NULL))`,
  )
    .bind(tokenHash, now)
    .first<AuthedUser>();

  if (!row || row.aktif !== 1) return null;
  return row;
}

export function requireAuth(ctx: Ctx): AuthedUser {
  if (!ctx.user) throw Errors.unauthenticated();
  return ctx.user;
}

export function requirePermission(ctx: Ctx, permission: Permission): AuthedUser {
  const user = requireAuth(ctx);
  if (!hasPermission(user.role, permission)) throw Errors.forbidden();
  return user;
}
