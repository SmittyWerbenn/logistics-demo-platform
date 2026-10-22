/**
 * Digits-only, country-code-first form wa.me links need ("62812..."), or null
 * when the input isn't a plausible Indonesian mobile number. Accepts
 * 08xxxxxxxxxx, +628xxxxxxxxxx, 628xxxxxxxxxx and 8xxxxxxxxxx, ignoring
 * spaces, dashes, dots and parentheses. Mirrors the API's normalizer.
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

/** wa.me link for an already-normalized number; never builds a link without one. */
export function whatsappUrl(number: string | null | undefined, message?: string): string | null {
  if (!number || !/^62\d{8,13}$/.test(number)) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
