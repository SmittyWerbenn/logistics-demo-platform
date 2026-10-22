import { Download, History, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { RefreshButton } from "../../components/RefreshButton";
import { Pagination } from "../../components/Pagination";
import { api } from "../../utils/apiClient";
import { useDebounced, usePagedList } from "../../utils/usePagedList";
import { roleLabel, type AuditAction, type AuditLogEntry, type UserRole } from "../../types";
import { exportAuditLogXlsx } from "../../utils/auditExport";
import { formatTimestampWib } from "../../utils/format";

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

function formatTimestamp(iso: string): string {
  return formatTimestampWib(iso);
}

const ACTION_STYLE: Record<AuditAction, string> = {
  CREATE_AWB: "bg-blue-100 text-blue-700",
  UPDATE_STATUS: "bg-sky-100 text-sky-700",
  UPDATE_TRUCK: "bg-violet-100 text-violet-700",
  TRANSFER_TRUCK: "bg-violet-100 text-violet-700",
  ADD_ISSUE: "bg-red-100 text-red-700",
  UPLOAD_POD: "bg-teal-100 text-teal-700",
  CLOSE_SHIPMENT: "bg-emerald-100 text-emerald-700",
  SEND_NOTIFICATION: "bg-amber-100 text-amber-700",
  CREATE_TRUCK: "bg-blue-100 text-blue-700",
  UPDATE_TRUCK_MASTER: "bg-violet-100 text-violet-700",
  CREATE_LOCATION: "bg-blue-100 text-blue-700",
  UPDATE_LOCATION: "bg-violet-100 text-violet-700",
  CREATE_USER: "bg-blue-100 text-blue-700",
  UPDATE_USER: "bg-violet-100 text-violet-700",
  UPDATE_SHIPMENT_INFO: "bg-sky-100 text-sky-700",
  UPDATE_POD_PHOTO: "bg-teal-100 text-teal-700",
  CANCEL_SHIPMENT: "bg-rose-100 text-rose-700",
  REROUTE_SHIPMENT: "bg-cyan-100 text-cyan-700",
  PULLBACK_SHIPMENT: "bg-orange-100 text-orange-700",
  REQUEST_ORDER_RECOVERY: "bg-amber-100 text-amber-700",
  APPROVE_ORDER_RECOVERY: "bg-emerald-100 text-emerald-700",
  REJECT_ORDER_RECOVERY: "bg-rose-100 text-rose-700",
  RECOVER_ORDER: "bg-emerald-100 text-emerald-700",
  LOGIN_SUCCESS: "bg-emerald-100 text-emerald-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  PASSWORD_CHANGED: "bg-amber-100 text-amber-700",
  FILE_UPLOADED: "bg-teal-100 text-teal-700",
  FILE_DELETED: "bg-red-100 text-red-700",
};

interface AuditRow {
  id: string;
  timestamp: string;
  user_name: string;
  role: UserRole;
  action: AuditAction;
  action_label: string;
  module: string;
  awb: string | null;
  description: string;
}

function toEntry(r: AuditRow): AuditLogEntry {
  return {
    id: r.id,
    timestamp: r.timestamp,
    userName: r.user_name,
    role: r.role,
    action: r.action,
    actionLabel: r.action_label,
    module: r.module,
    awb: r.awb ?? undefined,
    description: r.description,
  };
}

export default function AuditLogPage() {
  const [userFilter, setUserFilter] = useState("Semua");
  const [actionFilter, setActionFilter] = useState("Semua");
  const [moduleFilter, setModuleFilter] = useState("Semua");
  const [awbQuery, setAwbQuery] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debAwb = useDebounced(awbQuery.trim());
  const debSearch = useDebounced(search.trim());

  // Filter -> sort (newest first) -> LIMIT/OFFSET all happen in the API; the
  // date filter is WIB while the API compares UTC ISO timestamps.
  const list = usePagedList<AuditRow, AuditLogEntry>(
    "/api/audit-logs",
    {
      user: userFilter !== "Semua" ? userFilter : undefined,
      action: actionFilter !== "Semua" ? actionFilter : undefined,
      module: moduleFilter !== "Semua" ? moduleFilter : undefined,
      awbContains: debAwb || undefined,
      q: debSearch || undefined,
      from: dateFrom ? new Date(`${dateFrom}T00:00:00+07:00`).toISOString() : undefined,
      to: dateTo ? new Date(`${dateTo}T23:59:59.999+07:00`).toISOString() : undefined,
    },
    toEntry,
  );
  const filtered = list.items;

  const [facets, setFacets] = useState<{ users: string[]; actions: string[]; modules: string[] }>({ users: [], actions: [], modules: [] });
  useEffect(() => {
    api.get<typeof facets>("/api/audit-logs/facets").then(setFacets).catch(() => {});
  }, []);
  const { users, actions, modules } = facets;

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await list.reload();
    } finally {
      setRefreshing(false);
    }
  }

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  // Exports every entry matching the current filters (not just the page on screen).
  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    try {
      const { count, truncated } = await exportAuditLogXlsx({
        user: userFilter !== "Semua" ? userFilter : undefined,
        action: actionFilter !== "Semua" ? actionFilter : undefined,
        module: moduleFilter !== "Semua" ? moduleFilter : undefined,
        awbContains: awbQuery.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setExportMsg(`${count} baris diunduh${truncated ? " (dibatasi 20.000 baris pertama; persempit filter untuk sisanya)" : ""}.`);
    } catch {
      setExportMsg("Gagal mengunduh data audit. Coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-500">Riwayat siapa mengubah apa dan kapan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Unduh Data
          </button>
          <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
        </div>
      </div>
      {exportMsg && <p className="mt-2 text-xs text-slate-500">{exportMsg}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className={inputClass}>
          <option value="Semua">Semua User</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={inputClass}>
          <option value="Semua">Semua Action</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={inputClass}>
          <option value="Semua">Semua Module</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari deskripsi / user..."
          className={inputClass}
        />
        <input
          value={awbQuery}
          onChange={(e) => setAwbQuery(e.target.value)}
          placeholder="Cari AWB..."
          className={inputClass}
        />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          <span>-</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>
        {(userFilter !== "Semua" || actionFilter !== "Semua" || moduleFilter !== "Semua" || awbQuery || search || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setUserFilter("Semua");
              setActionFilter("Semua");
              setModuleFilter("Semua");
              setAwbQuery("");
              setSearch("");
              setDateFrom("");
              setDateTo("");
            }}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Reset
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {filtered.map((e) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <History size={13} />
                {formatTimestamp(e.timestamp)}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ACTION_STYLE[e.action] ?? "bg-slate-100 text-slate-600"}`}>
                {e.actionLabel}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-slate-800">{e.userName}</span>
              <span className="text-xs text-slate-400">({roleLabel(e.role)})</span>
              <span className="text-slate-300">-</span>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{e.module}</span>
              {e.awb && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{e.awb}</span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-slate-600">{e.description}</p>
          </div>
        ))}
        {list.loading && filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Memuat...</div>
        )}
        {list.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{list.error}</p>}
        {!list.loading && !list.error && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            Tidak ada data.
          </div>
        )}
      </div>

      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="log" />
    </AdminLayout>
  );
}
