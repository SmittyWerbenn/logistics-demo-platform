import { adminPath } from "../../utils/urls";
import { AlertTriangle, Bell, CheckCircle2, Mail, PackagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { RefreshButton } from "../../components/RefreshButton";
import { toItem, useNotifications, type NotificationRow } from "../../store/NotificationContext";
import { Pagination } from "../../components/Pagination";
import { usePagedList } from "../../utils/usePagedList";
import type { NotificationItem } from "../../types";
import type { NotificationTrigger } from "../../types";
import { formatTimestampWib } from "../../utils/format";

const TRIGGER_META: Record<NotificationTrigger, { icon: typeof Bell; style: string; label: string }> = {
  AWB_CREATED: { icon: PackagePlus, style: "bg-blue-100 text-blue-700", label: "Resi Diterbitkan" },
  KENDALA: { icon: AlertTriangle, style: "bg-red-100 text-red-700", label: "Kendala" },
  SELESAI: { icon: CheckCircle2, style: "bg-emerald-100 text-emerald-700", label: "Selesai" },
};

function formatTimestamp(iso: string): string {
  return formatTimestampWib(iso);
}

export default function NotificationCenter() {
  const { refresh: refreshBell, markAllRead } = useNotifications();
  const list = usePagedList<NotificationRow, NotificationItem>("/api/notifications", {}, toItem);
  const notifications = list.items;
  const refresh = async () => {
    await Promise.all([refreshBell(), list.reload()]);
  };
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notification Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Notifikasi customer yang dibuat sistem (resi terbit, kendala, dan pengiriman selesai).
          </p>
        </div>
        <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {notifications.map((n) => {
          const meta = TRIGGER_META[n.trigger];
          return (
            <div key={n.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.style}`}>
                <meta.icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{n.subject}</p>
                  <span className="text-xs text-slate-400">{formatTimestamp(n.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Kepada: <span className="font-medium text-slate-700">{n.toName}</span> ({n.toEmail}) - AWB{" "}
                  <span className="font-mono">{n.awb}</span>
                </p>
                <Link
                  to={adminPath(`/resi/${n.awb}/email`)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:underline"
                >
                  <Mail size={13} /> Buka Email Preview
                </Link>
              </div>
            </div>
          );
        })}
        {list.loading && notifications.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Memuat...</div>
        )}
        {!list.loading && notifications.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            Tidak ada data.
          </div>
        )}
      </div>

      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="notifikasi" />
    </AdminLayout>
  );
}
