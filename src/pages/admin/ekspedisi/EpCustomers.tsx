import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, History } from "lucide-react";
import { AdminLayout } from "../../../components/layout/AdminLayout";
import { api } from "../../../utils/apiClient";
import { Badge, btnGhost, btnPrimary, dateId, Empty, Field, inputClass, Modal, PageHead, rupiah, statusTone, Table, Td, Th, useApi, type EpCustomer, type EpOrder, type EpPrice, type EpReceivable } from "./common";

const blank = { nama: "", npwp: "", pic: "", telepon: "", email: "", alamat: "", paymentScheme: "PAD", termDays: "30", preferences: "", notes: "" };

function History_({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = useApi<{ customer: EpCustomer; orders: EpOrder[]; prices: EpPrice[]; receivables: EpReceivable[] }>(`/api/ep/customers/${id}/history`);
  const [tab, setTab] = useState<"orders" | "prices" | "recv">("orders");
  return (
    <Modal title={`Riwayat — ${data?.customer.nama ?? "..."}`} onClose={onClose} wide>
      {loading || !data ? <p className="text-sm text-slate-500">Memuat...</p> : (
        <>
          {(data.customer.preferences || data.customer.notes) && (
            <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {data.customer.preferences && <p><b>Preferensi:</b> {data.customer.preferences}</p>}
              {data.customer.notes && <p><b>Catatan:</b> {data.customer.notes}</p>}
            </div>
          )}
          <div className="mb-3 flex gap-2">
            {([["orders", `Order (${data.orders.length})`], ["prices", `Harga (${data.prices.length})`], ["recv", `Piutang (${data.receivables.length})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>{l}</button>
            ))}
          </div>
          {tab === "orders" && <Table><thead><tr><Th>Resi</Th><Th>Tanggal</Th><Th>Rute</Th><Th>Status</Th><Th right>Total</Th></tr></thead><tbody>
            {data.orders.map((o) => <tr key={o.id}><Td>{o.resi}</Td><Td>{dateId(o.orderDate)}</Td><Td>{o.route}</Td><Td><Badge tone={statusTone(o.status)}>{o.status}</Badge></Td><Td right>{rupiah(o.total)}</Td></tr>)}
            {!data.orders.length && <Empty cols={5} loading={false} error="" />}</tbody></Table>}
          {tab === "prices" && <Table><thead><tr><Th>Rute</Th><Th>Pengirim</Th><Th>Penerima</Th><Th>Pembayar</Th><Th right>Harga</Th></tr></thead><tbody>
            {data.prices.map((p) => <tr key={p.id}><Td>{p.route}</Td><Td>{p.senderNama ?? "-"}</Td><Td>{p.receiverNama ?? "-"}</Td><Td>{p.payerNama ?? "-"}</Td><Td right>{rupiah(p.price)}/{p.unit}</Td></tr>)}
            {!data.prices.length && <Empty cols={5} loading={false} error="" />}</tbody></Table>}
          {tab === "recv" && <Table><thead><tr><Th>Resi</Th><Th>Invoice</Th><Th>Jatuh Tempo</Th><Th>Status</Th><Th right>Jumlah</Th></tr></thead><tbody>
            {data.receivables.map((r) => <tr key={r.id}><Td>{r.resi}</Td><Td>{r.invoiceNo ?? "-"}</Td><Td>{dateId(r.dueDate)}</Td><Td><Badge tone={r.overdue ? "red" : statusTone(r.status)}>{r.overdue ? "Overdue" : r.status}</Badge></Td><Td right>{rupiah(r.amount)}</Td></tr>)}
            {!data.receivables.length && <Empty cols={5} loading={false} error="" />}</tbody></Table>}
        </>
      )}
    </Modal>
  );
}

export default function EpCustomers() {
  const [q, setQ] = useState("");
  const { data, loading, error, reload } = useApi<{ items: EpCustomer[] }>(`/api/ep/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const edit = (c: EpCustomer) => setForm({ id: c.id, nama: c.nama, npwp: c.npwp ?? "", pic: c.pic ?? "", telepon: c.telepon ?? "", email: c.email ?? "", alamat: c.alamat ?? "", paymentScheme: c.paymentScheme, termDays: String(c.termDays ?? 0), preferences: c.preferences ?? "", notes: c.notes ?? "" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true); setErr("");
    const { id, termDays, ...rest } = form;
    const body = { ...rest, termDays: Number(termDays) || 0 };
    try {
      if (id) await api.patch(`/api/ep/customers/${id}`, body); else await api.post("/api/ep/customers", body);
      setForm(null); await reload();
    } catch (x) { setErr(x instanceof Error ? x.message : "Gagal menyimpan."); }
    finally { setSaving(false); }
  }
  async function remove(c: EpCustomer) {
    if (!confirm(`Hapus customer "${c.nama}"?`)) return;
    try { await api.del(`/api/ep/customers/${c.id}`); await reload(); } catch (x) { alert(x instanceof Error ? x.message : "Gagal menghapus."); }
  }

  return (
    <AdminLayout>
      <PageHead title="Master Customer" desc="Pengirim, penerima & pembayar — termasuk skema pembayaran dan preferensi yang selama ini hanya diingat admin."
        action={<button className={btnPrimary} onClick={() => setForm({ ...blank })}><Plus size={16} />Customer Baru</button>} />
      <input className={`${inputClass} mb-3 max-w-sm`} placeholder="Cari nama / PIC..." value={q} onChange={(e) => setQ(e.target.value)} />
      <Table>
        <thead><tr><Th>Nama</Th><Th>PIC / Kontak</Th><Th>Skema</Th><Th>Preferensi</Th><Th /></tr></thead>
        <tbody>
          {data?.items.map((c) => (
            <tr key={c.id}>
              <Td><b>{c.nama}</b><div className="text-xs text-slate-500">{c.alamat}</div></Td>
              <Td>{c.pic}<div className="text-xs text-slate-500">{c.telepon}</div></Td>
              <Td><Badge tone={c.paymentScheme === "PAD" ? "amber" : c.paymentScheme === "TOP" ? "blue" : "green"}>{c.paymentScheme}{c.paymentScheme !== "CASH" ? ` · ${c.termDays ?? 0}h` : ""}</Badge></Td>
              <Td className="max-w-xs text-xs text-slate-600">{c.preferences}</Td>
              <Td right>
                <div className="flex justify-end gap-1">
                  <button className={btnGhost} title="Riwayat" onClick={() => setHist(c.id)}><History size={14} /></button>
                  <button className={btnGhost} title="Ubah" onClick={() => edit(c)}><Pencil size={14} /></button>
                  <button className={btnGhost} title="Hapus" onClick={() => remove(c)}><Trash2 size={14} /></button>
                </div>
              </Td>
            </tr>
          ))}
          {!data?.items.length && <Empty cols={5} loading={loading} error={error} />}
        </tbody>
      </Table>

      {hist && <History_ id={hist} onClose={() => setHist(null)} />}
      {form && (
        <Modal title={form.id ? "Ubah Customer" : "Customer Baru"} onClose={() => setForm(null)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Nama *"><input required className={inputClass} value={form.nama} onChange={(e) => set("nama", e.target.value)} /></Field></div>
            <Field label="PIC"><input className={inputClass} value={form.pic} onChange={(e) => set("pic", e.target.value)} /></Field>
            <Field label="Telepon"><input className={inputClass} value={form.telepon} onChange={(e) => set("telepon", e.target.value)} /></Field>
            <Field label="Email"><input className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="NPWP"><input className={inputClass} value={form.npwp} onChange={(e) => set("npwp", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Alamat"><input className={inputClass} value={form.alamat} onChange={(e) => set("alamat", e.target.value)} /></Field></div>
            <Field label="Skema Pembayaran" hint="PAD = bayar setelah barang tiba, TOP = tempo, CASH = tunai">
              <select className={inputClass} value={form.paymentScheme} onChange={(e) => set("paymentScheme", e.target.value)}><option>PAD</option><option>TOP</option><option>CASH</option></select>
            </Field>
            <Field label="Tempo (hari)"><input type="number" min={0} className={inputClass} value={form.termDays} onChange={(e) => set("termDays", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Preferensi / aturan khusus" hint="Mis. 'kirim pagi, tagihan ke finance, wajib foto POD'"><textarea rows={2} className={inputClass} value={form.preferences} onChange={(e) => set("preferences", e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Catatan"><textarea rows={2} className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
            {err && <p className="sm:col-span-2 text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={btnGhost} onClick={() => setForm(null)}>Batal</button><button className={btnPrimary} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button></div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
