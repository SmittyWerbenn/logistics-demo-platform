import { useCallback, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { api } from "../../../utils/apiClient";

export const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
export const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50";
export const btnGhost = "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export const rupiah = (n: number | null | undefined) => (n == null ? "-" : "Rp " + Math.round(n).toLocaleString("id-ID"));
export const dateId = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-");

export interface EpCustomer { id: string; nama: string; npwp: string | null; pic: string | null; telepon: string | null; email: string | null; alamat: string | null; paymentScheme: "PAD" | "TOP" | "CASH"; termDays: number | null; preferences: string | null; notes: string | null; aktif: boolean }
export interface EpRoute { id: string; asal: string; tujuan: string; publishRate: number | null; unit: string; transitDays: number | null; notes: string | null; aktif: boolean }
export interface EpPrice { id: string; routeId: string; route: string; senderId: string | null; senderNama: string | null; receiverId: string | null; receiverNama: string | null; payerId: string | null; payerNama: string | null; goodsType: string | null; minWeight: number | null; price: number; unit: string; notes: string | null; updatedAt: string; pendingCount: number }
export interface EpOrder { id: string; resi: string; orderDate: string; status: string; routeId: string | null; route: string | null; asal: string | null; tujuan: string | null; senderId: string | null; senderNama: string | null; senderAlamat: string | null; receiverId: string | null; receiverNama: string | null; receiverAlamat: string | null; payerId: string | null; payerNama: string | null; payerAlamat: string | null; payerScheme: string | null; goodsType: string | null; koli: number | null; weight: number | null; price: number | null; priceUnit: string | null; priceSource: string; total: number | null; internalNote: string | null }
export interface EpReceivable { id: string; orderId: string; resi: string; customerId: string | null; customerNama: string | null; invoiceNo: string | null; amount: number; dueDate: string | null; status: string; paidAt: string | null; overdue: boolean; daysOverdue: number }
export type EpSettings = Record<string, string>;

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try { setData(await api.get<T>(path)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={onClose}>
      <div className={`mt-10 w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-xl bg-white shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function PageHead({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "green" | "amber" | "red" | "blue" | "slate"; children: ReactNode }) {
  const c = { green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", red: "bg-red-100 text-red-700", blue: "bg-blue-100 text-blue-700", slate: "bg-slate-100 text-slate-600" }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

export const statusTone = (s: string) => (s === "Selesai" || s === "Lunas" ? "green" : s === "Batal" ? "red" : s === "Tiba" || s === "Ditagih" ? "blue" : s === "Baru" || s === "Belum Ditagih" ? "slate" : "amber") as "green" | "red" | "blue" | "slate" | "amber";

export const SOURCE_LABEL: Record<string, string> = { exact: "Harga khusus", route_sender: "Rute + pengirim", publish: "Harga publish", manual: "Manual" };

export const Table = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm">{children}</table></div>
);
export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => (
  <th className={`border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ${right ? "text-right" : ""}`}>{children}</th>
);
export const Td = ({ children, right, className = "" }: { children?: ReactNode; right?: boolean; className?: string }) => (
  <td className={`border-b border-slate-100 px-3 py-2 align-top text-slate-800 ${right ? "text-right" : ""} ${className}`}>{children}</td>
);
export const Empty = ({ cols, loading, error }: { cols: number; loading: boolean; error: string }) => (
  <tr><td colSpan={cols} className="px-3 py-8 text-center text-sm text-slate-500">{loading ? "Memuat..." : error || "Belum ada data."}</td></tr>
);
