// Western Indonesia Time (WIB, UTC+7). Dates/times stored for display
// (tanggal "YYYY-MM-DD", jam "HH:mm") are WIB wall-clock values; full
// timestamps (created_at, input_at, ...) stay UTC ISO strings.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Current WIB date and time as { tanggal: "YYYY-MM-DD", jam: "HH:mm" }. */
export function wibNow(now: Date = new Date()): { tanggal: string; jam: string } {
  const iso = new Date(now.getTime() + WIB_OFFSET_MS).toISOString();
  return { tanggal: iso.slice(0, 10), jam: iso.slice(11, 16) };
}
