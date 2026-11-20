import { api, ApiError } from "./apiClient";

export interface CaptchaChallenge {
  id: string;
  /** SVG markup (vector paths only - the server never sends the answer). */
  image: string;
  expiresAt: number;
}

export function fetchCaptcha(): Promise<CaptchaChallenge> {
  return api.post<CaptchaChallenge>("/api/public/captcha", undefined, { auth: false });
}

/** Tracking CAPTCHA switched off for now (keep in sync with api-worker/src/captcha.ts). */
export const TRACKING_CAPTCHA_ENABLED = false;

const PASS_KEY = "gms-human-pass";

/** A human pass (issued after a solved CAPTCHA) lets the tracking lookup run for a while. */
export function getHumanPass(): string | null {
  try {
    const raw = sessionStorage.getItem(PASS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { pass: string; expiresAt: number };
    if (!v.pass || v.expiresAt <= Date.now() + 5_000) {
      sessionStorage.removeItem(PASS_KEY);
      return null;
    }
    return v.pass;
  } catch {
    return null;
  }
}

export function clearHumanPass(): void {
  try {
    sessionStorage.removeItem(PASS_KEY);
  } catch {
    /* ignore */
  }
}

/** Solves the tracking CAPTCHA on the server and keeps the resulting pass. */
export async function verifyTrackingCaptcha(captchaId: string, captchaCode: string): Promise<void> {
  const res = await api.post<{ pass: string; expiresAt: number }>("/api/public/tracking/verify", { captchaId, captchaCode }, { auth: false });
  try {
    sessionStorage.setItem(PASS_KEY, JSON.stringify(res));
  } catch {
    /* ignore */
  }
}

export type CaptchaFailure = "required" | "invalid" | "expired" | "tooMany" | "server" | "rateLimited" | null;

/** Maps an API error to a CAPTCHA failure kind (null = not a CAPTCHA problem). */
export function captchaFailureOf(err: unknown): CaptchaFailure {
  if (!(err instanceof ApiError)) return "server";
  switch (err.code) {
    case "CAPTCHA_REQUIRED": return "required";
    case "CAPTCHA_INVALID": return "invalid";
    case "CAPTCHA_EXPIRED": return "expired";
    case "CAPTCHA_TOO_MANY": return "tooMany";
    case "RATE_LIMITED": return "rateLimited";
    default: return err.status >= 500 || err.status === 0 ? "server" : null;
  }
}

export const CAPTCHA_MESSAGES: Record<Exclude<CaptchaFailure, null>, { id: string; en: string }> = {
  required: { id: "Silakan masukkan kode CAPTCHA.", en: "Please enter the CAPTCHA code." },
  invalid: { id: "Kode CAPTCHA tidak sesuai. Silakan coba lagi.", en: "The CAPTCHA code does not match. Please try again." },
  expired: { id: "Kode CAPTCHA telah kedaluwarsa. Silakan buat kode baru.", en: "The CAPTCHA code has expired. Please generate a new one." },
  tooMany: { id: "Percobaan terlalu banyak. Silakan buat kode CAPTCHA baru.", en: "Too many attempts. Please generate a new CAPTCHA code." },
  server: { id: "Verifikasi keamanan sedang mengalami gangguan. Silakan coba lagi.", en: "Security verification is temporarily unavailable. Please try again." },
  rateLimited: { id: "Terlalu banyak permintaan. Silakan coba lagi dalam beberapa menit.", en: "Too many requests. Please try again in a few minutes." },
};
