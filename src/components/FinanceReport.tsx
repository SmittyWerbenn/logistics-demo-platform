import { Download, Printer, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../utils/apiClient";
import { formatRupiah } from "../utils/ongkir";

interface Finance {
  months: number;
  revenueTotal: number;
  ordersTotal: number;
  avgOrderValue: number;
  revenueThisMonth: number;
  revenuePrevMonth: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  openCount: number;
  paidTotal: number;
  unbilled: number;
  billedNotPaid: number;
  aging: { current: number; d1_30: number; d31_60: number; d60plus: number };
  trend: Array<{ month: string; orders: number; revenue: number; paid: number }>;
  topCustomers: Array<{ nama: string; n: number; rev: number }>;
  topRoutes: Array<{ rute: string; n: number; rev: number }>;
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const monthLabel = (ym: string) => `${BULAN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

function Kpi({ label, value, hint, tone = "text-slate-900" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function FinanceReport() {
  const [d, setD] = useState<Finance | null>(null);
  const [months, setMonths] = useState(6);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .get<Finance>(`/api/dashboard/finance?months=${months}`)
      .then((r) => alive && (setD(r), setError("")))
      .catch(() => alive && setError("Gagal memuat laporan keuangan."));
    return () => {
      alive = false;
    };
  }, [months]);

  if (error) return <p className="mt-8 text-sm text-red-600">{error}</p>;
  if (!d) return null;

  const growth = d.revenuePrevMonth
    ? Math.round(((d.revenueThisMonth - d.revenuePrevMonth) / d.revenuePrevMonth) * 100)
    : null;
  const maxRev = Math.max(1, ...d.trend.map((t) => t.revenue));
  const agingRows: Array<[string, number, string]> = [
    ["Belum jatuh tempo", d.aging.current, "bg-emerald-500"],
    ["Telat 1–30 hari", d.aging.d1_30, "bg-amber-400"],
    ["Telat 31–60 hari", d.aging.d31_60, "bg-orange-500"],
    ["Telat > 60 hari", d.aging.d60plus, "bg-red-600"],
  ];
  const agingTotal = Math.max(1, agingRows.reduce((a, r) => a + r[1], 0));

  const exportCsv = () => {
    const lines = [
      "Bulan,Order,Pendapatan,Terbayar",
      ...d.trend.map((t) => `${t.month},${t.orders},${t.revenue},${t.paid}`),
      "",
      "Aging Piutang,Nominal",
      ...agingRows.map((r) => `${r[0]},${r[1]}`),
      "",
      "Top Customer,Order,Pendapatan",
      ...d.topCustomers.map((c) => `"${c.nama.replace(/"/g, '""')}",${c.n},${c.rev}`),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-8 print:mt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Wallet size={19} /> Laporan Keuangan
        </h2>
        <div className="flex items-center gap-2 print:hidden">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {[3, 6, 12].map((m) => (
              <option key={m} value={m}>{m} bulan terakhir</option>
            ))}
          </select>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            <Printer size={14} /> Cetak
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Pendapatan bulan ini"
          value={formatRupiah(d.revenueThisMonth)}
          hint={growth === null ? "—" : `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% vs bulan lalu`}
        />
        <Kpi label={`Total pendapatan (${d.months} bln)`} value={formatRupiah(d.revenueTotal)} hint={`${d.ordersTotal} order · rata-rata ${formatRupiah(d.avgOrderValue)}`} />
        <Kpi label="Piutang (PAD) berjalan" value={formatRupiah(d.outstanding)} hint={`${d.openCount} tagihan · belum ditagih ${formatRupiah(d.unbilled)}`} tone="text-amber-600" />
        <Kpi label="Piutang jatuh tempo" value={formatRupiah(d.overdue)} hint={`${d.overdueCount} tagihan telat`} tone={d.overdue ? "text-red-600" : "text-slate-900"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800">Tren pendapatan vs terbayar</h3>
          <div className="mt-4 flex h-48 items-end gap-3">
            {d.trend.map((t) => (
              <div key={t.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${monthLabel(t.month)}: ${formatRupiah(t.revenue)} (terbayar ${formatRupiah(t.paid)})`}>
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div className="w-1/2 rounded-t bg-blue-700" style={{ height: `${(t.revenue / maxRev) * 100}%` }} />
                  <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${(t.paid / maxRev) * 100}%` }} />
                </div>
                <span className="text-[11px] text-slate-500">{monthLabel(t.month)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blue-700" /> Pendapatan (order)</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Terbayar (Lunas)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Aging piutang</h3>
          <ul className="mt-4 space-y-3">
            {agingRows.map(([label, val, color]) => (
              <li key={label}>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{label}</span>
                  <span className="font-medium text-slate-900">{formatRupiah(val)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${color}`} style={{ width: `${(val / agingTotal) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Lunas: <b className="text-slate-800">{formatRupiah(d.paidTotal)}</b> · Ditagih: <b className="text-slate-800">{formatRupiah(d.billedNotPaid)}</b>
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[
          { title: "Top customer (pendapatan)", rows: d.topCustomers.map((c) => [c.nama, c.n, c.rev] as const) },
          { title: "Top rute (pendapatan)", rows: d.topRoutes.map((r) => [r.rute, r.n, r.rev] as const) },
        ].map((tbl) => (
          <div key={tbl.title} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <h3 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">{tbl.title}</h3>
            {tbl.rows.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">Belum ada data.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {tbl.rows.map(([name, n, rev]) => (
                    <tr key={name} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2 text-slate-700">{name}</td>
                      <td className="px-2 py-2 text-right text-xs text-slate-400">{n} order</td>
                      <td className="px-5 py-2 text-right font-medium text-slate-900">{formatRupiah(rev)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
