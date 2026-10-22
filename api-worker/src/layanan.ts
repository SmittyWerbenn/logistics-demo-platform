import type { Env } from "./types";
import { Errors } from "./http";

/** Service every order falls back to when the requested layanan isn't an
 * active entry in Master Layanan. Must exist and be active there - the
 * Master Layanan routes refuse to delete/deactivate/rename it. */
export const FALLBACK_LAYANAN = "LTL";

/** Services the "Tambah Layanan" picker offers (the first five are seeded by
 * migration 0018; LTL/FTL are added by an admin). Used only to normalise the
 * casing of a typed name - any other name is a custom layanan. */
export const STANDARD_LAYANAN = ["LTL", "FTL", "LCL", "FCL", "Air Express", "Project Cargo", "Darat", "Express", "Kargo", "Regular", "Charter"] as const;

/** Default display order of Master Layanan: the standard services in
 * STANDARD_LAYANAN order, then any custom layanan alphabetically. */
export const LAYANAN_ORDER_SQL = `CASE l.nama COLLATE NOCASE ${STANDARD_LAYANAN.map((n, i) => `WHEN '${n}' THEN ${i}`).join(" ")} ELSE ${STANDARD_LAYANAN.length} END, l.nama COLLATE NOCASE ASC`;

export function canonicalLayananName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  return STANDARD_LAYANAN.find((s) => s.toLowerCase() === name.toLowerCase()) ?? name;
}

export function isFallbackLayanan(nama: string): boolean {
  return nama.trim().toLowerCase() === FALLBACK_LAYANAN.toLowerCase();
}

/** The stored (canonical-case) name of an ACTIVE layanan matching `raw`
 * case-insensitively, or null when it doesn't exist / is inactive. */
export async function findActiveLayanan(env: Env, raw: string | undefined | null): Promise<string | null> {
  const name = (raw ?? "").trim();
  if (!name) return null;
  const row = await env.DB.prepare(`SELECT nama FROM layanans WHERE nama = ? AND aktif = 1 AND deleted_at IS NULL`)
    .bind(name)
    .first<{ nama: string }>();
  return row?.nama ?? null;
}

/** Layanan to store on a NEW order. A valid, active layanan is used as-is;
 * anything else (unknown, inactive, missing) falls back to LTL so an order
 * is never rejected just because of its layanan. The one failure is LTL
 * itself not being configured/active - that is reported explicitly rather
 * than storing an unvalidated value. */
export async function resolveLayananForOrder(
  env: Env,
  requested: string | undefined | null,
): Promise<{ nama: string; fellBack: boolean }> {
  const direct = await findActiveLayanan(env, requested);
  if (direct) return { nama: direct, fellBack: false };

  const fallback = await findActiveLayanan(env, FALLBACK_LAYANAN);
  if (!fallback) {
    const asked = (requested ?? "").trim();
    throw Errors.unprocessable(
      `${asked ? `Layanan "${asked}" tidak tersedia, dan ` : ""}layanan fallback ${FALLBACK_LAYANAN} belum dikonfigurasi atau tidak aktif. ` +
        `Admin harus menambahkan/mengaktifkan ${FALLBACK_LAYANAN} di Master Layanan terlebih dahulu.`,
    );
  }
  return { nama: fallback, fellBack: true };
}
