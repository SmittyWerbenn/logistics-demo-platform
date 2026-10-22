import { driverPath } from "../../utils/urls";
import { AlertTriangle, ArrowLeft, ArrowRight, Download, FileText, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DriverLayout } from "../../components/layout/DriverLayout";
import { RefreshButton } from "../../components/RefreshButton";
import { useAuth } from "../../store/AuthContext";
import { type DriverShipmentSummary } from "../../utils/driverApi";
import { Pagination } from "../../components/Pagination";
import { usePagedList } from "../../utils/usePagedList";
import { exportDriverShipmentsCsv } from "../../utils/exportCsv";
import { formatTanggalPanjang, todayISO } from "../../utils/format";
import { SHIPMENT_STATUS_OPTIONS } from "../../utils/status";

const KENDALA_STATUS = "Kendala";
const SELESAI_STATUS = "Selesai / Terkirim";

function statusStyle(status: string): string {
  if (status === KENDALA_STATUS) return "bg-red-50 text-red-700";
  if (status === SELESAI_STATUS) return "bg-emerald-50 text-emerald-700";
  return "bg-blue-50 text-blue-700";
}

/** "Eko Prasetyo" -> "data-kiriman-2026_09_28-eko-prasetyo.pdf" */
function buildExportFilename(driverNama: string, ext: string): string {
  const [y, m, d] = todayISO().split("-");
  const slug =
    driverNama
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "driver";
  return `data-kiriman-${y}_${m}_${d}-${slug}.${ext}`;
}

/** Full shipment history for the logged-in driver (not just the dashboard's
 * status-filtered tabs), with a date-created + status filter and Excel/PDF
 * export. PDF is a real generated file (jsPDF), not window.print() - avoids
 * the browser print dialog's own header/footer (URL, date, page number)
 * that can't be suppressed from the page itself. */
export default function DriverShipmentHistory() {
  const { profile } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Status / date range are applied by the API; only the visible page is loaded.
  const list = usePagedList<DriverShipmentSummary>("/api/driver/shipments", {
    status: statusFilter === "Semua" ? "" : statusFilter,
    from: dateFrom,
    to: dateTo,
  });
  const shipments = list.loading && list.items.length === 0 && !list.error ? null : list.items;
  const error = list.error;
  const fetchHistory = () => list.reload();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetchHistory();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      // Dynamically imported so jsPDF/jspdf-autotable (and its optional
      // html2canvas/dompurify deps) never bloat the main app bundle that
      // every visitor downloads - only loaded when this button is used.
      const { exportDriverShipmentsPdf } = await import("../../utils/exportPdf");
      exportDriverShipmentsPdf(
        await list.fetchAll(),
        { driverNama: profile?.nama ?? "-", dateFrom, dateTo, statusFilter },
        buildExportFilename(profile?.nama ?? "", "pdf"),
      );
    } finally {
      setPdfLoading(false);
    }
  }

  const filtered = list.items;

  return (
    <DriverLayout wide>
      <Link to={driverPath("/")} className="no-print mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900">
        <ArrowLeft size={15} /> Kembali
      </Link>

      <div className="no-print mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Data Pengiriman</h1>
          <p className="text-xs text-slate-400">Seluruh pengiriman yang pernah ditugaskan ke Anda.</p>
        </div>
        <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
      </div>

      <div className="no-print mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="Semua">Semua Status</option>
          {SHIPMENT_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(dateFrom || dateTo || statusFilter !== "Semua") && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setStatusFilter("Semua");
            }}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            <X size={14} /> Reset
          </button>
        )}
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={() => void list.fetchAll().then((all) => exportDriverShipmentsCsv(all, buildExportFilename(profile?.nama ?? "", "csv")))}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-blue-900 bg-white px-3.5 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50"
          >
            <Download size={15} /> Unduh Excel
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            <FileText size={15} /> {pdfLoading ? "Menyiapkan..." : "Unduh PDF"}
          </button>
        </div>
      </div>

      {error && (
        <div className="no-print mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {shipments === null && !error && (
        <div className="no-print flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
        </div>
      )}

      {shipments !== null && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
          Tidak ada data.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[720px] table-auto text-left text-sm print:min-w-0 print:w-full print:text-[10px]">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 print:bg-white">
                <tr>
                  <th className="px-4 py-3 font-medium print:px-1.5 print:py-1">AWB</th>
                  <th className="px-4 py-3 font-medium print:px-1.5 print:py-1">Tanggal</th>
                  <th className="px-4 py-3 font-medium print:px-1.5 print:py-1">Rute</th>
                  <th className="px-4 py-3 font-medium print:px-1.5 print:py-1">Status</th>
                  <th className="px-4 py-3 font-medium print:px-1.5 print:py-1">Estimasi Tiba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.awb} className="print:break-inside-avoid">
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-slate-900 print:whitespace-normal print:break-words print:px-1.5 print:py-1">{s.awb}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 print:whitespace-normal print:px-1.5 print:py-1">
                      {formatTanggalPanjang(s.tanggalDibuat)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 print:whitespace-normal print:break-words print:px-1.5 print:py-1">
                      <span className="flex items-center gap-1.5 print:flex-wrap">
                        {s.kotaAsal} <ArrowRight size={12} className="text-slate-300 print:hidden" /> {s.kotaTujuan}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 print:whitespace-normal print:px-1.5 print:py-1">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle(s.status)} print:rounded-none print:bg-transparent print:px-0 print:py-0 print:text-slate-700`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 print:whitespace-normal print:px-1.5 print:py-1">
                      {s.estimasiTiba ? formatTanggalPanjang(s.estimasiTiba) : "Belum tersedia"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="no-print">
        <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="pengiriman" />
      </div>
    </DriverLayout>
  );
}
