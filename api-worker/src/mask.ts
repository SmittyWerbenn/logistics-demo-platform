/** Privacy masking of the SENDER name on PUBLIC tracking: only the first and last character of the whole
 * name are shown, everything between (spaces included) becomes "*" - "PT Indo Jaya" -> "P**********a".
 * 1 character stays; 2 characters -> first + "*" so a short name is never shown in full.
 * Works on code points (non-ASCII safe). null/empty -> "" (callers show their own empty state).
 * The receiver name is intentionally NOT masked. */
export function maskSenderName(name: unknown): string {
  if (typeof name !== "string") return "";
  const c = Array.from(name.trim().replace(/\s+/g, " "));
  if (c.length === 0) return "";
  if (c.length === 1) return c[0];
  if (c.length === 2) return c[0] + "*";
  return c[0] + "*".repeat(c.length - 2) + c[c.length - 1];
}
