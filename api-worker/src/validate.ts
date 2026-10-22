import { Errors } from "./http";

export async function parseJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw Errors.badRequest("Body request harus JSON yang valid.");
  }
}

export function reqString(body: Record<string, unknown>, field: string, opts: { min?: number; max?: number } = {}): string {
  const v = body[field];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw Errors.badRequest(`Field "${field}" wajib diisi.`);
  }
  const trimmed = v.trim();
  if (opts.min && trimmed.length < opts.min) {
    throw Errors.badRequest(`Field "${field}" minimal ${opts.min} karakter.`);
  }
  if (opts.max && trimmed.length > opts.max) {
    throw Errors.badRequest(`Field "${field}" maksimal ${opts.max} karakter.`);
  }
  return trimmed;
}

export function optString(body: Record<string, unknown>, field: string): string | undefined {
  const v = body[field];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw Errors.badRequest(`Field "${field}" harus berupa teks.`);
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function reqEnum<T extends string>(body: Record<string, unknown>, field: string, allowed: readonly T[]): T {
  const v = body[field];
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    throw Errors.badRequest(`Field "${field}" harus salah satu dari: ${allowed.join(", ")}.`);
  }
  return v as T;
}

export function reqNumber(body: Record<string, unknown>, field: string, opts: { min?: number; max?: number } = {}): number {
  const v = body[field];
  const n = typeof v === "number" ? v : Number(v);
  if (typeof v === "undefined" || v === null || v === "" || !Number.isFinite(n)) {
    throw Errors.badRequest(`Field "${field}" harus berupa angka.`);
  }
  if (opts.min !== undefined && n < opts.min) throw Errors.badRequest(`Field "${field}" minimal ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw Errors.badRequest(`Field "${field}" maksimal ${opts.max}.`);
  return n;
}

export function reqEmail(body: Record<string, unknown>, field: string): string {
  const v = reqString(body, field);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw Errors.badRequest(`Field "${field}" harus berupa email yang valid.`);
  }
  return v.toLowerCase();
}

export function optNumber(body: Record<string, unknown>, field: string, opts: { min?: number; max?: number } = {}): number | undefined {
  const v = body[field];
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw Errors.badRequest(`Field "${field}" harus berupa angka.`);
  if (!Number.isInteger(n)) throw Errors.badRequest(`Field "${field}" harus berupa angka bulat.`);
  if (opts.min !== undefined && n < opts.min) throw Errors.badRequest(`Field "${field}" minimal ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw Errors.badRequest(`Field "${field}" maksimal ${opts.max}.`);
  return n;
}

export function optBool(body: Record<string, unknown>, field: string): boolean | undefined {
  const v = body[field];
  if (typeof v === "undefined") return undefined;
  if (typeof v !== "boolean") throw Errors.badRequest(`Field "${field}" harus true/false.`);
  return v;
}
