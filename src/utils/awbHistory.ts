import type { Language } from "../data/translations";

export interface AwbHistoryEntry {
  awb: string;
  status: string;
  lastViewedAt: string; // ISO
}

const KEY = "gms-customer-awb-history";
const MAX_ENTRIES = 20;

export function getAwbHistory(): AwbHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AwbHistoryEntry[];
  } catch {
    // ignore corrupted storage
  }
  return [];
}

/** Records that the customer viewed this AWB just now - no sensitive data,
 * just the AWB number, its last-seen status, and a timestamp. */
export function recordAwbView(awb: string, status: string): AwbHistoryEntry[] {
  try {
    const history = getAwbHistory().filter((h) => h.awb !== awb);
    history.unshift({ awb, status, lastViewedAt: new Date().toISOString() });
    const trimmed = history.slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.error("[awbHistory] gagal menyimpan riwayat:", err);
    return getAwbHistory();
  }
}

export function removeAwbHistory(awb: string): AwbHistoryEntry[] {
  const history = getAwbHistory().filter((h) => h.awb !== awb);
  try {
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
  return history;
}

export function clearAwbHistory(): AwbHistoryEntry[] {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  return [];
}

export function formatRelativeView(iso: string, language: Language = "id"): string {
  const then = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.setHours(0, 0, 0, 0) - new Date(then).setHours(0, 0, 0, 0)) / 86400000);
  if (language === "en") {
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  }
  if (diffDays <= 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  return `${diffDays} hari lalu`;
}
