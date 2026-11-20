import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "../../../components/layout/AdminLayout";
import { api } from "../../../utils/apiClient";
import { useAuth } from "../../../store/AuthContext";
import { Badge, btnGhost, btnPrimary, dateId, Empty, Field, inputClass, Modal, PageHead, rupiah, Table, Td, Th, useApi, type EpCustomer, type EpPrice, type EpRoute } from "./common";

interface LogItem { id: string; priceId: string; route: string; senderNama: string | null; oldPrice: number | null; newPrice: number; reason: string | null; status: string; requestedBy: string; requestedAt: string; decidedBy: string | null; decidedAt: string | null }
const blank = { routeId: "", senderId: "", receiverId: "", payerId: "", goodsType: "", minWeight: "", price: "", unit: "kg", notes: "", reason: "" };

export default function EpPrices() {
  const { profile } = useAuth();
  const isOwner = profile?.role === "Superadmin";
  const [tab, setTab] = useState<"prices" | "log">("prices");
  const prices = useApi<{ items: EpPrice[] }>("/api/ep/prices");
  const log = useApi<{ items: LogItem[] }>("/api/ep/price-log");
  const routes = useApi<{ items: EpRoute[] }>("/api/ep/routes");
  const custs = useApi<{ items: EpCustomer[] }>("/api/ep/customers");
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const set = (k: string, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const reloadAll = async () => { await Promise.all([prices.reload(), log.reload()]); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const { id, minWeight, price, ...rest } = form;
    const body = { ...rest, senderId: rest.senderId || null, receiverId: rest.receiverId || null, payerId: rest.payerId || null, goodsType: rest.goodsType || null, minWeight: minWeight === "" ? null : Number(minWeight), price: Number(price) };
    try {
      if (id) {
        const r = await api.patch<{ id: string; pending: boolean }>(`/api/ep/prices/${id}`, body);
        setInfo(r.pending ? "Perubahan harga menunggu persetujuan Owner." : "Harga diperbarui.");
      } else { await api.post("/api/ep/prices", body); setInfo("Harga ditambahkan."); }
      setForm(null); setErr(""); await reloadAll();
    } catch (x) { setErr(x instanceof Error ? x.message : "Gagal menyimpan."); }
  }
  async function decide(l: LogItem, approve: boolean) {
    try { await api.post(`/api/ep/price-log/${l.id}/decision`, { approve }); await reloadAll(); } catch (x) { alert(x instanceof Error ? x.message : "Gagal."); }
  }
  async function remove(p: EpPrice) {
    if (!confirm("Hapus harga ini?")) return;
    try { await api.del(`/api/ep/prices/${p.id}`); await reloadAll(); } catch (x) { alert(x instanceof Error ? x.message : "Gagal menghapus."); }
  }
  const sel = (k: "senderId" | "receiverId" | "payerId", label: string) => (
    <Field label={label}><select className={inputClass} value={form?.[k] ?? ""} onChange={(e) => set(k, e.target.value)}>
      <option value="">— Semua —</option>{custs.data?.items.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
    </select></Field>
  );
  const pending = log.data?.items.filter((l) => l.status === "pending").length ?? 0;

  return (
    <AdminLayout>
      <PageHead title="Master Harga" desc="Harga per rute + pengirim + penerima + pembayar. Urutan fallback: harga khusus → rute+pengirim → harga publish → manual."
        action={<button className={btnPrimary} onClick={() => setForm({ ...blank, routeId: routes.data?.items[0]?.id ?? "" })}><Plus size={16} />Harga Baru</button>} />
      {info && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
      <div className="mb-3 flex gap-2">
        <button onClick={() => setTab("prices")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "prices" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>Daftar Harga</button>
        <button onClick={() => setTab("log")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "log" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>Log Perubahan{pending ? ` (${pending} menunggu)` : ""}</button>
      </div>
      {tab === "prices" ? (
        <Table>
          <thead><tr><Th>Rute</Th><Th>Pengirim</Th><Th>Penerima</Th><Th>Pembayar</Th><Th>Barang</Th><Th right>Harga</Th><Th>Update</Th><Th /></tr></thead>
          <tbody>
            {prices.data?.items.map((p) => (
              <tr key={p.id}>
                <Td><b>{p.route}</b></Td><Td>{p.senderNama ?? "Semua"}</Td><Td>{p.receiverNama ?? "Semua"}</Td><Td>{p.payerNama ?? "Semua"}</Td>
                <Td>{p.goodsType ?? "-"}{p.minWeight ? ` ≥${p.minWeight}kg` : ""}</Td>
                <Td right><b>{rupiah(p.price)}</b>/{p.unit}{p.pendingCount > 0 && <div><Badge tone="amber">{p.pendingCount} pending</Badge></div>}</Td>
                <Td className="text-xs text-slate-500">{dateId(p.updatedAt)}</Td>
                <Td right><div className="flex justify-end gap-1">
                  <button className={btnGhost} onClick={() => setForm({ id: p.id, routeId: p.routeId, senderId: p.senderId ?? "", receiverId: p.receiverId ?? "", payerId: p.payerId ?? "", goodsType: p.goodsType ?? "", minWeight: p.minWeight?.toString() ?? "", price: String(p.price), unit: p.unit, notes: p.notes ?? "", reason: "" })}><Pencil size={14} /></button>
                  <button className={btnGhost} onClick={() => remove(p)}><Trash2 size={14} /></button>
                </div></Td>
              </tr>
            ))}
            {!prices.data?.items.length && <Empty cols={8} loading={prices.loading} error={prices.error} />}
          </tbody>
        </Table>
      ) : (
        <Table>
          <thead><tr><Th>Waktu</Th><Th>Rute / Pengirim</Th><Th right>Lama</Th><Th right>Baru</Th><Th>Alasan</Th><Th>Oleh</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {log.data?.items.map((l) => (
              <tr key={l.id}>
                <Td className="text-xs">{dateId(l.requestedAt)}</Td><Td>{l.route}<div className="text-xs text-slate-500">{l.senderNama ?? "Semua"}</div></Td>
                <Td right>{rupiah(l.oldPrice)}</Td><Td right><b>{rupiah(l.newPrice)}</b></Td><Td className="text-xs">{l.reason}</Td><Td className="text-xs">{l.requestedBy}</Td>
                <Td><Badge tone={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "amber"}>{l.status}</Badge>{l.decidedBy && <div className="text-xs text-slate-500">{l.decidedBy}</div>}</Td>
                <Td right>{l.status === "pending" && isOwner && <div className="flex gap-1"><button className={btnGhost} title="Setujui" onClick={() => decide(l, true)}><Check size={14} /></button><button className={btnGhost} title="Tolak" onClick={() => decide(l, false)}><X size={14} /></button></div>}</Td>
              </tr>
            ))}
            {!log.data?.items.length && <Empty cols={8} loading={log.loading} error={log.error} />}
          </tbody>
        </Table>
      )}
      {form && (
        <Modal title={form.id ? "Ubah Harga" : "Harga Baru"} onClose={() => setForm(null)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Rute *"><select required className={inputClass} value={form.routeId} onChange={(e) => set("routeId", e.target.value)}>
              <option value="">Pilih rute</option>{routes.data?.items.map((r) => <option key={r.id} value={r.id}>{r.asal} → {r.tujuan}</option>)}</select></Field></div>
            {sel("senderId", "Pengirim")}{sel("receiverId", "Penerima")}{sel("payerId", "Pembayar")}
            <Field label="Jenis barang"><input className={inputClass} value={form.goodsType} onChange={(e) => set("goodsType", e.target.value)} /></Field>
            <Field label="Min. berat (kg)"><input type="number" min={0} className={inputClass} value={form.minWeight} onChange={(e) => set("minWeight", e.target.value)} /></Field>
            <Field label="Harga *"><input required type="number" min={0} className={inputClass} value={form.price} onChange={(e) => set("price", e.target.value)} /></Field>
            <Field label="Satuan"><select className={inputClass} value={form.unit} onChange={(e) => set("unit", e.target.value)}><option>kg</option><option>koli</option><option>flat</option></select></Field>
            <Field label="Catatan"><input className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            {form.id && <Field label="Alasan perubahan"><input className={inputClass} value={form.reason} onChange={(e) => set("reason", e.target.value)} /></Field>}
            {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={btnGhost} onClick={() => setForm(null)}>Batal</button><button className={btnPrimary}>Simpan</button></div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
