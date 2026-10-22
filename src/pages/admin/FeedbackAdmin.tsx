import { adminPath } from "../../utils/urls";
import { MessageSquare, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "../../components/StatCard";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { RefreshButton } from "../../components/RefreshButton";
import { toFeedback, useFeedback, type FeedbackRow } from "../../store/FeedbackContext";
import { Pagination } from "../../components/Pagination";
import { usePagedList } from "../../utils/usePagedList";
import type { Feedback } from "../../types";
import { formatTanggalPendek, isoToWib } from "../../utils/format";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}
        />
      ))}
    </div>
  );
}

export default function FeedbackAdmin() {
  const { refresh: refreshShared } = useFeedback();
  const list = usePagedList<FeedbackRow, Feedback>("/api/feedback", {}, toFeedback);
  const refresh = async () => {
    await Promise.all([refreshShared(), list.reload()]);
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

  // Totals come from the API (over ALL feedback), not from the rows on this page.
  const sum = list.extra.summary as { count: number; avg_rating: number | null; r1: number; r2: number; r3: number; r4: number; r5: number } | undefined;
  const byStarCount: Record<number, number> = { 5: sum?.r5 ?? 0, 4: sum?.r4 ?? 0, 3: sum?.r3 ?? 0, 2: sum?.r2 ?? 0, 1: sum?.r1 ?? 0 };
  const summary = {
    total: sum?.count ?? 0,
    avg: sum?.avg_rating ?? 0,
    byStar: [5, 4, 3, 2, 1].map((star) => ({ star, count: byStarCount[star] })),
  };
  const sorted = list.items;

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Feedback Customer</h1>
          <p className="mt-1 text-sm text-slate-500">Ulasan customer setelah pengiriman selesai.</p>
        </div>
        <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
          <p className="text-sm font-medium text-slate-500">Average Rating</p>
          <div className="mt-2 flex items-end gap-2">
            <p className="text-3xl font-semibold text-slate-900">{summary.avg.toFixed(1)}</p>
            <StarRow rating={Math.round(summary.avg)} />
          </div>
          <p className="mt-1 text-xs text-slate-400">Dari {summary.total} feedback</p>
        </div>
        {summary.byStar.map(({ star, count }) => (
          <StatCard
            key={star}
            label={`${star} Star`}
            value={count}
            icon={Star}
            accent="bg-amber-100 text-amber-700"
          />
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">AWB</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Feedback</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link to={adminPath(`/resi/${f.awb}`)} className="font-mono font-medium text-blue-800 hover:underline">
                      {f.awb}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{f.customerName}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StarRow rating={f.rating} />
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    {f.comment ?? <span className="text-slate-300">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {formatTanggalPendek(isoToWib(f.submittedAt).tanggal)}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    <MessageSquare size={24} className="mx-auto mb-2 text-slate-300" />
                    {list.loading ? "Memuat..." : "Tidak ada data."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="feedback" />
    </AdminLayout>
  );
}
