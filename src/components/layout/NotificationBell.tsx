import { adminPath } from "../../utils/urls";
import { AlertTriangle, Bell, CheckCircle2, PackagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../../store/NotificationContext";
import type { NotificationTrigger } from "../../types";
import { formatTimestampWib } from "../../utils/format";

const TRIGGER_META: Record<NotificationTrigger, { icon: typeof Bell; style: string }> = {
  AWB_CREATED: { icon: PackagePlus, style: "bg-blue-100 text-blue-700" },
  KENDALA: { icon: AlertTriangle, style: "bg-red-100 text-red-700" },
  SELESAI: { icon: CheckCircle2, style: "bg-emerald-100 text-emerald-700" },
};

function formatTimestamp(iso: string): string {
  return formatTimestampWib(iso);
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const recent = notifications.slice(0, 5);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) markAllRead();
      return next;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        title="Notifikasi"
        aria-label="Notifikasi"
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifikasi</p>
            <span className="text-xs text-slate-400">{notifications.length} total</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent.map((n) => {
              const meta = TRIGGER_META[n.trigger];
              return (
                <Link
                  key={n.id}
                  to={adminPath(`/resi/${n.awb}/email`)}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 border-b border-slate-50 px-4 py-3 hover:bg-slate-50"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.style}`}>
                    <meta.icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900">{n.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">AWB {n.awb}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatTimestamp(n.createdAt)}</p>
                  </div>
                </Link>
              );
            })}
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-slate-400">Belum ada notifikasi.</p>
            )}
          </div>
          <Link
            to={adminPath("/notifikasi")}
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-blue-800 hover:bg-slate-50"
          >
            Lihat Semua Notifikasi
          </Link>
        </div>
      )}
    </div>
  );
}
