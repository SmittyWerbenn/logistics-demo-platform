import type { Role } from "./types";
import { Errors } from "./http";

/**
 * Single source of truth for "who does this person contact for help".
 *
 * The WhatsApp numbers themselves are never in code: they live in the
 * settings table and are edited under Pengaturan. WhatsApp CS is the existing
 * `help_phone_number` (used by the public Compro/Contact pages); the Admin and
 * Superadmin numbers are the two keys below.
 */

export type HelpTopic = "lupa_password" | "kendala";
export type HelpTarget = "admin" | "superadmin";

export const HELP_TARGET_LABEL: Record<HelpTarget, string> = {
  admin: "WhatsApp Admin",
  superadmin: "WhatsApp Superadmin",
};

export const HELP_SETTING_KEY: Record<HelpTarget, string> = {
  admin: "help_whatsapp_admin",
  superadmin: "help_whatsapp_superadmin",
};

/** role + topic -> number to contact. "Admin" is shown to users as GMS-Admin. */
const MAPPING: Record<HelpTopic, Partial<Record<Role, HelpTarget>>> = {
  lupa_password: {
    Driver: "admin",
    Client: "admin",
    Viewer: "admin",
    Mitra: "admin",
    Admin: "superadmin", // GMS-Admin
  },
  kendala: {
    Driver: "admin",
  },
};

export function isHelpTopic(v: unknown): v is HelpTopic {
  return v === "lupa_password" || v === "kendala";
}

/** Strict lookup: null when the mapping defines nothing for this role+topic. */
export function helpTargetForRole(topic: HelpTopic, role: Role): HelpTarget | null {
  return MAPPING[topic][role] ?? null;
}

/** Lupa Password happens before sign-in, so the role comes from the typed
 * email (the route rejects unregistered emails before calling this). A role
 * the mapping doesn't cover (e.g. Superadmin) gets the Admin number. */
export function lupaPasswordTarget(role: Role | null | undefined): HelpTarget {
  return (role && MAPPING.lupa_password[role]) || "admin";
}

/**
 * Digits-only, country-code-first form that wa.me links need ("62812..."), or
 * null when the input isn't a plausible Indonesian mobile number. Accepts
 * 08xxxxxxxxxx, +628xxxxxxxxxx, 628xxxxxxxxxx and 8xxxxxxxxxx, ignoring
 * spaces, dashes, dots and parentheses.
 */
export function normalizeWhatsApp(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^[+\d\s().-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("62")) {
    // already has the country code
  } else if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  } else {
    return null;
  }
  return /^62\d{8,13}$/.test(digits) ? digits : null;
}

/** For saving a number in Pengaturan: throws a clear 400 when it's not valid. */
export function requireValidWhatsApp(label: string, raw: string): void {
  if (normalizeWhatsApp(raw) === null) {
    throw Errors.badRequest(`${label} tidak valid. Gunakan format 08xxxxxxxxxx atau +628xxxxxxxxxx.`);
  }
}

/** The configured number for a target, normalized for wa.me; null when it has
 * not been set (or was saved in an unusable format). */
export async function loadHelpNumber(db: D1Database, target: HelpTarget): Promise<string | null> {
  const row = await db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .bind(HELP_SETTING_KEY[target])
    .first<{ value: string }>();
  return row?.value ? normalizeWhatsApp(row.value) : null;
}
