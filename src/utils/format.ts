const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** tanggal: "2026-09-11" -> "11 September 2026" */
export function formatTanggalPanjang(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  if (!y || !m || !d) return tanggal;
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/** tanggal: "2026-09-11" -> "11 Sep 2026" */
export function formatTanggalPendek(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  if (!y || !m || !d) return tanggal;
  return `${d} ${BULAN[m - 1].slice(0, 3)} ${y}`;
}

export function formatJam(jam: string): string {
  return `${jam} WIB`;
}

export function formatTanggalJam(tanggal: string, jam: string): string {
  return `${formatTanggalPanjang(tanggal)} · ${formatJam(jam)}`;
}

// All dates/times in the app are Western Indonesia Time (WIB, UTC+7),
// regardless of the browser's timezone. Timestamps from the API are UTC ISO
// strings, so they are converted here before being shown as "... WIB".
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const WIB_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wibParts(d: Date): { tanggal: string; jam: string } {
  const p: Record<string, string> = {};
  for (const part of WIB_FORMAT.formatToParts(d)) p[part.type] = part.value;
  return { tanggal: `${p.year}-${p.month}-${p.day}`, jam: `${p.hour}:${p.minute}` };
}

/** A moment in WIB with seconds and weekday, for the live header clock. */
export function wibClock(d: Date = new Date()): { tanggal: string; jam: string; detik: string; hari: string } {
  const p: Record<string, string> = {};
  for (const part of WIB_FORMAT.formatToParts(d)) p[part.type] = part.value;
  const tanggal = `${p.year}-${p.month}-${p.day}`;
  const dow = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))).getUTCDay();
  return { tanggal, jam: `${p.hour}:${p.minute}`, detik: p.second, hari: HARI[dow] };
}

/** UTC ISO timestamp -> WIB { tanggal: "YYYY-MM-DD", jam: "HH:mm" }. */
export function isoToWib(iso: string): { tanggal: string; jam: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { tanggal: iso.slice(0, 10), jam: iso.slice(11, 16) };
  return wibParts(d);
}

/** UTC ISO timestamp -> "30 September 2026, 14:05 WIB". */
export function formatTimestampWib(iso: string): string {
  const { tanggal, jam } = isoToWib(iso);
  return `${formatTanggalPanjang(tanggal)}, ${jam} WIB`;
}

/** Today's date in WIB as YYYY-MM-DD. */
export function todayISO(): string {
  return wibParts(new Date()).tanggal;
}

/** Current time in WIB as HH:mm. */
export function nowHHMM(): string {
  return wibParts(new Date()).jam;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** deskripsiBarang embeds its koli count/weight for the auto-fill parser
 * (deriveBeratKg/deriveJumlahKoli in mockData.ts), e.g.
 * "Spare part mesin industri, 3 dus (total 85kg)". Wherever Berat/Koli
 * already have their own column (reports, exports), showing that clause
 * again in Keterangan is redundant - this strips it back down to
 * "Spare part mesin industri". Falls back to the original string if the
 * pattern isn't found (free text some shipments may not follow it). */
export function stripKeteranganMeta(deskripsiBarang: string): string {
  const stripped = deskripsiBarang.replace(
    /,\s*\d+\s*(?:dus|box|palet|item|unit|koli|drum)\s*\([^)]*\)\s*$/i,
    "",
  );
  return stripped.trim() || deskripsiBarang;
}
