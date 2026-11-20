import { useState } from "react";
import { AdminLayout } from "../../../components/layout/AdminLayout";
import { api } from "../../../utils/apiClient";
import { Badge, btnGhost, dateId, Empty, inputClass, PageHead, rupiah, statusTone, Table, Td, Th, useApi, type EpReceivable } from "./common";

interface Resp { items: EpReceivable[]; summary: { outstanding: number; overdue: number; overdueCount: number; openCount: number } }

export default function EpReceivables() {
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useApi<Resp>(`/api/ep/receivables${status ? `?status=${status}` : ""}`);
  async function patch(r: EpReceivable, body: Record<string, unknown>) {
    try { await api.patch(`/api/ep/receivables/${r.id}`, body); await reload(); } catch (x) { alert(x instanceof Error ? x.message : "Gagal."); }
  }
  const s = data?.summary;
  const card = (l: string, v: string, tone = "text-slate-900") => <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{l}</div><div className={`text-xl font-bold ${tone}`}>{v}</div></div>;
  return (
    <AdminLayout>
      <PageHead title="Piutang (PAD / TOP)" desc="Tagihan yang belum dibayar, jatuh tempo, dan yang sudah lewat tempo." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {card("Total Outstanding", rupiah(s?.outstanding ?? 0))}
        {card("Overdue", rupiah(s?.overdue ?? 0), "text-red-600")}
        {card("Tagihan Terbuka", `${s?.openCount ?? 0} (${s?.overdueCount ?? 0} overdue)`)}
      </div>
      <select className={`${inputClass} mb-3 max-w-48`} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Semua</option><option>Belum Ditagih</option><option>Ditagih</option><option>Lunas</option><option>Overdue</option>
      </select>
      <Table>
        <thead><tr><Th>Resi</Th><Th>Customer</Th><Th>Invoice</Th><Th>Jatuh Tempo</Th><Th>Status</Th><Th right>Jumlah</Th><Th /></tr></thead>
        <tbody>
          {data?.items.map((r) => (
            <tr key={r.id}>
              <Td><b>{r.resi}</b></Td><Td>{r.customerNama}</Td><Td>{r.invoiceNo ?? "-"}</Td>
              <Td>{dateId(r.dueDate)}{r.overdue && <div className="text-xs text-red-600">{r.daysOverdue} hari lewat</div>}</Td>
              <Td><Badge tone={r.overdue ? "red" : statusTone(r.status)}>{r.overdue ? "Overdue" : r.status}</Badge></Td>
              <Td right>{rupiah(r.amount)}</Td>
              <Td right><div className="flex justify-end gap-1">
                {r.status === "Belum Ditagih" && <button className={btnGhost} onClick={() => { const n = prompt("No. invoice:", r.invoiceNo ?? ""); if (n !== null) void patch(r, { status: "Ditagih", invoiceNo: n }); }}>Tagih</button>}
                {r.status !== "Lunas" && <button className={btnGhost} onClick={() => patch(r, { status: "Lunas", paidAt: new Date().toISOString().slice(0, 10) })}>Lunas</button>}
              </div></Td>
            </tr>
          ))}
          {!data?.items.length && <Empty cols={7} loading={loading} error={error} />}
        </tbody>
      </Table>
    </AdminLayout>
  );
}
