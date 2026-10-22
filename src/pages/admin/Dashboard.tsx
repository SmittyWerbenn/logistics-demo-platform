import { adminPath } from "../../utils/urls";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  MessageSquare,
  Package,
  PackagePlus,
  Route,
  Star,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { RefreshButton } from "../../components/RefreshButton";
import { StagnantShipmentsCard } from "../../components/StagnantShipmentsCard";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../store/AuthContext";
import { useFeedback } from "../../store/FeedbackContext";
import { useNotifications } from "../../store/NotificationContext";
import { useSettings } from "../../store/SettingsContext";
import { fetchShipmentsPage, useShipments } from "../../store/ShipmentContext";
import type { Shipment, ShipmentStatus } from "../../types";
import { api } from "../../utils/apiClient";
import { formatTanggalPendek } from "../../utils/format";
import { getStagnantShipments, type StagnantInfo } from "../../utils/stagnant";

interface DashboardStats {
  totalShipments: number;
  statusCounts: Record<string, number>;
  stagnantCount: number;
  totalTrucks: number;
  truckOnTrip: number;
  avgRating: number | null;
}

export default function Dashboard() {
  const { shipments, refresh: refreshShipments } = useShipments();
  const [stagnantRows, setStagnantRows] = useState<Shipment[]>([]);
  const { profile } = useAuth();
  const canCreateShipment =
    profile?.role === "Superadmin" || profile?.role === "Admin" || profile?.role === "Client";
  const { notifications, refresh: refreshNotifications } = useNotifications();
  const { feedback, refresh: refreshFeedback } = useFeedback();
  const { settings } = useSettings();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function fetchStats() {
    return api
      .get<DashboardStats>(`/api/dashboard/stats?stagnantDays=${settings.stagnantThresholdDays}`)
      .then(setStats)
      .catch(() => setStats(null));
  }

  // Stagnant card: the 10 oldest-idle orders, filtered by the API (not carved out of a fetched list).
  function fetchStagnant() {
    return fetchShipmentsPage({ macet: settings.stagnantThresholdDays, limit: 10 })
      .then(setStagnantRows)
      .catch(() => setStagnantRows([]));
  }

  useEffect(() => {
    void refreshShipments({ limit: 5 });
    fetchStagnant();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.stagnantThresholdDays]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([fetchStats(), fetchStagnant(), refreshShipments({ limit: 5 }), refreshNotifications(), refreshFeedback()]);
    } finally {
      setRefreshing(false);
    }
  }

  const total = stats?.totalShipments ?? 0;
  const dalamPerjalanan = stats?.statusCounts["Dalam Perjalanan"] ?? 0;
  const transit = stats?.statusCounts["Transit"] ?? 0;
  const selesai = stats?.statusCounts["Selesai / Terkirim"] ?? 0;
  const bermasalah = stats?.statusCounts["Kendala"] ?? 0;
  const truckOnTrip = stats?.truckOnTrip ?? 0;
  const totalTrucks = stats?.totalTrucks ?? 0;
  const avgRating = stats?.avgRating ?? 0;
  const stagnantCount = stats?.stagnantCount ?? 0;

  const stagnant: StagnantInfo[] = useMemo(
    () => getStagnantShipments(stagnantRows, settings.stagnantThresholdDays),
    [stagnantRows, settings.stagnantThresholdDays],
  );

  const recent = [...shipments]
    .sort((a, b) => (a.tanggalDibuat + a.jamDibuat < b.tanggalDibuat + b.jamDibuat ? 1 : -1))
    .slice(0, 5);

  const recentNotifications = notifications.slice(0, 4);
  const recentFeedback = [...feedback].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).slice(0, 4);

  const statusBreakdown = stats?.statusCounts ?? {};

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ringkasan operasional pengiriman PT Gangsar Mitra Suatama.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
          {canCreateShipment && (
            <Link
              to={adminPath("/pengiriman/baru")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800"
            >
              <PackagePlus size={17} />
              Buat Pengiriman
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Pengiriman"
          value={total}
          icon={Package}
          accent="bg-blue-100 text-blue-700"
          to={adminPath("/pengiriman")}
        />
        <StatCard
          label="Dalam Perjalanan"
          value={dalamPerjalanan}
          icon={Truck}
          accent="bg-sky-100 text-sky-700"
          to={adminPath(`/pengiriman?status=${encodeURIComponent("Dalam Perjalanan")}`)}
        />
        <StatCard
          label="Transit"
          value={transit}
          icon={Route}
          accent="bg-amber-100 text-amber-700"
          to={adminPath(`/pengiriman?status=${encodeURIComponent("Transit")}`)}
        />
        <StatCard
          label="Selesai"
          value={selesai}
          icon={CheckCircle2}
          accent="bg-emerald-100 text-emerald-700"
          to={adminPath(`/pengiriman?status=${encodeURIComponent("Selesai / Terkirim")}`)}
        />
        <StatCard
          label="Kendala"
          value={bermasalah}
          icon={AlertTriangle}
          accent="bg-red-100 text-red-700"
          to={adminPath(`/pengiriman?status=${encodeURIComponent("Kendala")}`)}
        />
        <StatCard
          label="AWB Macet"
          value={stagnantCount}
          icon={AlertTriangle}
          accent="bg-red-100 text-red-700"
          to={adminPath("/pengiriman?macet=1")}
        />
        {profile?.role !== "Mitra" && (
          <>
        <StatCard
          label="Total Armada"
          value={totalTrucks}
          icon={Truck}
          accent="bg-violet-100 text-violet-700"
          to={adminPath("/armada")}
        />
        <StatCard
          label="Truck On Trip"
          value={truckOnTrip}
          icon={Truck}
          accent="bg-sky-100 text-sky-700"
          to={adminPath(`/armada?status=${encodeURIComponent("On Trip")}`)}
        />
          </>
        )}
        {profile?.role !== "Mitra" && (
          <StatCard
            label="Avg. Customer Rating"
            value={avgRating.toFixed(1)}
            icon={Star}
            accent="bg-amber-100 text-amber-700"
            to={adminPath("/feedback")}
          />
        )}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Pengiriman Terbaru (AWB)</h2>
            <Link
              to={adminPath("/pengiriman")}
              className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
            >
              Lihat semua <ArrowRight size={13} />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {recent.map((s) => (
              <li key={s.awb}>
                <Link
                  to={adminPath(`/resi/${s.awb}`)}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-slate-900">{s.awb}</p>
                    <p className="truncate text-xs text-slate-500">
                      {s.kotaAsal} → {s.kotaTujuan} · {s.penerima.nama}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {formatTanggalPendek(s.tanggalDibuat)}
                    </span>
                    <StatusBadge status={s.status} size="sm" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Status Pengiriman</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <li key={status}>
                <Link
                  to={adminPath(`/pengiriman?status=${encodeURIComponent(status)}`)}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                >
                  <StatusBadge status={status as ShipmentStatus} size="sm" />
                  <span className="text-sm font-semibold text-slate-700">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <StagnantShipmentsCard items={stagnant} />

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Bell size={16} className="text-blue-800" />
            <h2 className="text-sm font-semibold text-slate-800">Notifikasi Terbaru</h2>
          </div>
          {recentNotifications.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada notifikasi.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentNotifications.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{n.subject}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{n.awb}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 px-5 py-3">
            <Link to={adminPath("/notifikasi")} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
              Lihat semua <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {profile?.role !== "Mitra" && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <MessageSquare size={16} className="text-blue-800" />
              <h2 className="text-sm font-semibold text-slate-800">Feedback Terbaru</h2>
            </div>
            {recentFeedback.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada feedback.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentFeedback.map((f) => (
                  <li key={f.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{f.customerName}</p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={12}
                            className={n <= f.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}
                          />
                        ))}
                      </div>
                    </div>
                    {f.comment && <p className="mt-0.5 truncate text-xs text-slate-500">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 px-5 py-3">
              <Link to={adminPath("/feedback")} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
                Lihat semua <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
