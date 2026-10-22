import { api } from "./apiClient";
import { formatTimestampWib } from "./format";
import { downloadXlsx } from "./xlsx";

export interface AuditExportFilters {
  user?: string;
  action?: string;
  module?: string;
  awbContains?: string;
  /** Local (WIB) calendar dates, yyyy-mm-dd. */
  dateFrom?: string;
  dateTo?: string;
}

interface Row {
  timestamp: string;
  user_name: string;
  role: string;
  action_label: string;
  action: string;
  module: string;
  awb: string | null;
  description: string;
  ip: string | null;
}

const PAGE = 100;
const MAX_PAGES = 200; // 20.000 rows per download

/** Downloads the audit log as .xlsx for audit purposes. Unlike the on-screen list
 * (latest 100 entries), this pages through the API so the file holds EVERY entry
 * that matches the filters, oldest first. */
export async function exportAuditLogXlsx(filters: AuditExportFilters): Promise<{ count: number; truncated: boolean }> {
  const base = new URLSearchParams();
  if (filters.user) base.set("user", filters.user);
  if (filters.action) base.set("action", filters.action);
  if (filters.module) base.set("module", filters.module);
  if (filters.awbContains) base.set("awbContains", filters.awbContains);
  // The list's date filter is WIB; the API compares UTC ISO timestamps.
  if (filters.dateFrom) base.set("from", new Date(`${filters.dateFrom}T00:00:00+07:00`).toISOString());
  if (filters.dateTo) base.set("to", new Date(`${filters.dateTo}T23:59:59.999+07:00`).toISOString());

  const all: Row[] = [];
  let totalPages = 1;
  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const q = new URLSearchParams(base);
    q.set("limit", String(PAGE));
    q.set("page", String(page));
    const res = await api.get<{ items: Row[]; meta: { totalPages: number } }>(`/api/audit-logs?${q.toString()}`);
    all.push(...res.items);
    totalPages = res.meta.totalPages;
  }
  all.reverse(); // API is newest-first; an audit trail reads oldest-first

  const today = new Date().toISOString().slice(0, 10);
  await downloadXlsx(
    `audit-log-${today}.xlsx`,
    ["Waktu (WIB)", "User", "Role", "Aksi", "Kode Aksi", "Modul", "AWB", "Deskripsi", "IP"],
    all.map((r) => [formatTimestampWib(r.timestamp), r.user_name, r.role, r.action_label, r.action, r.module, r.awb ?? "-", r.description, r.ip ?? "-"]),
    [20, 22, 12, 24, 26, 18, 14, 70, 16],
  );
  return { count: all.length, truncated: totalPages > MAX_PAGES };
}
