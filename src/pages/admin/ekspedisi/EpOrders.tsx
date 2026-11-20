import { useEffect, useState, type FormEvent } from "react";
import { Eye, FileText, Plus, Printer } from "lucide-react";
import { AdminLayout } from "../../../components/layout/AdminLayout";
import { api } from "../../../utils/apiClient";
import { Badge, btnGhost, btnPrimary, dateId, Empty, Field, inputClass, Modal, PageHead, rupiah, SOURCE_LABEL, statusTone, Table, Td, Th, useApi, type EpCustomer, type EpOrder, type EpReceivable, type EpRoute, type EpSettings } from "./common";
import { printOrder } from "./print";

const STATUSES = ["Baru", "Dijemput", "Dikirim", "Tiba", "Selesai", "Batal"];
interface Resolved { price: number | null; unit: string; source: string; label: string }
interface Detail extends EpOrder { history: { status: string; note: string | null; at: string; by: string | null }[]; receivable: EpReceivable | null }

function NewOrder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const routes = useApi<{ items: EpRoute[] }>("/api/ep/routes");
  const custs = useApi<{ items: EpCustomer[] }>("/api/ep/customers");
  const [f, setF] = useState({ routeId: "", senderId: "", receiverId: "", payerId: "", goodsType: "", koli: "1", weight: "", price: "", unit: "kg", orderDate: new Date().toISOString().slice(0, 10), internalNote: "" });
  const [res, setRes] = useState<Resolved | null>(null);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!f.routeId) { setRes(null); return; }
    const t = setTimeout(() => {
      api.post<Resolved>("/api/ep/price-resolve", { routeId: f.routeId, senderId: f.senderId || null, receiverId: f.receiverId || null, payerId: f.payerId || null, goodsType: f.goodsType || null, weight: Number(f.weight) || 0 })
        .then((r) => { setRes(r); if (r.unit) setF((x) => ({ ...x, unit: r.unit })); }).catch(() => setRes(null));
    }, 250);
    return () => clearTimeout(t);
  }, [f.routeId, f.senderId, f.receiverId, f.payerId, f.goodsType, f.weight]);

  const qty = f.unit === "kg" ? Number(f.weight) || 0 : f.unit === "koli" ? Number(f.koli) || 0 : 1;
  const unitPrice = f.price !== "" ? Number(f.price) : res?.price ?? 0;
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/ep/orders", { ...f, koli: Number(f.koli) || 0, weight: Number(f.weight) || 0, price: f.price === "" ? undefined : Number(f.price), senderId: f.senderId || null, receiverId: f.receiverId || null, payerId: f.payerId || null });
      onSaved();
    } catch (x) { setErr(x instanceof Error ? x.message : "Gagal menyimpan."); }
  }
  const cs = (k: "senderId" | "receiverId" | "payerId", l: string, req = false) => (
    <Field label={l}><select required={req} className={inputClass} value={f[k]} onChange={(e) => set(k, e.target.value)}><option value="">Pilih...</option>{custs.data?.items.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></Field>
  );
  return (
    <Modal title="Order Baru" onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><Field label="Rute *"><select required className={inputClass} value={f.routeId} onChange={(e) => set("routeId", e.target.value)}><option value="">Pilih rute</option>{routes.data?.items.map((r) => <option key={r.id} value={r.id}>{r.asal} → {r.tujuan}</option>)}</select></Field></div>
        <Field label="Tanggal"><input type="date" className={inputClass} value={f.orderDate} onChange={(e) => set("orderDate", e.target.value)} /></Field>
        {cs("senderId", "Pengirim *", true)}{cs("receiverId", "Penerima *", true)}{cs("payerId", "Pembayar *", true)}
        <Field label="Jenis barang"><input className={inputClass} value={f.goodsType} onChange={(e) => set("goodsType", e.target.value)} /></Field>
        <Field label="Koli"><input type="number" min={0} className={inputClass} value={f.koli} onChange={(e) => set("koli", e.target.value)} /></Field>
        <Field label="Berat (kg)"><input type="number" min={0} step="0.1" className={inputClass} value={f.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
        <div className={`rounded-lg p-3 text-sm sm:col-span-3 ${res?.source === "manual" || !res ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          {res ? <><b>{SOURCE_LABEL[res.source] ?? res.source}</b>: {res.price != null ? `${rupiah(res.price)}/${res.unit}` : "tidak ada harga"} — {res.label}{res.source === "manual" && <div>Harga belum terdaftar. Isi harga manual di bawah.</div>}</> : "Pilih rute untuk melihat harga otomatis."}
        </div>
        <Field label="Harga manual (override)" hint="Kosongkan untuk memakai harga otomatis"><input type="number" min={0} className={inputClass} value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
        <Field label="Satuan"><select className={inputClass} value={f.unit} onChange={(e) => set("unit", e.target.value)}><option>kg</option><option>koli</option><option>flat</option></select></Field>
        <div className="flex items-end"><p className="text-sm">Estimasi total: <b className="text-lg">{rupiah(unitPrice * qty)}</b></p></div>
        <div className="sm:col-span-3"><Field label="Catatan internal"><input className={inputClass} value={f.internalNote} onChange={(e) => set("internalNote", e.target.value)} /></Field></div>
        {err && <p className="text-sm text-red-600 sm:col-span-3">{err}</p>}
        <div className="flex justify-end gap-2 sm:col-span-3"><button type="button" className={btnGhost} onClick={onClose}>Batal</button><button className={btnPrimary}>Buat Order & Resi</button></div>
      </form>
    </Modal>
  );
}

function OrderDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, reload } = useApi<Detail>(`/api/ep/orders/${id}`);
  const settings = useApi<EpSettings>("/api/ep/settings");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const o = data;
  async function update() {
    if (!status) return;
    try { await api.patch(`/api/ep/orders/${id}`, { status, note }); setStatus(""); setNote(""); await reload(); onChanged(); } catch (x) { alert(x instanceof Error ? x.message : "Gagal."); }
  }
  const pr = (k: "resi" | "suratjalan" | "invoice") => o && settings.data && printOrder(k, o, settings.data, o.receivable?.invoiceNo, o.receivable?.dueDate, o.receivable?.status === "Lunas" ? (o.total ?? 0) : 0);
  return (
    <Modal title={o ? `Order ${o.resi}` : "Memuat..."} onClose={onClose} wide>
      {o && (
        <div className="space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            <div><span className="text-slate-500">Pengirim</span><div className="font-medium">{o.senderNama}</div></div>
            <div><span className="text-slate-500">Penerima</span><div className="font-medium">{o.receiverNama}</div></div>
            <div><span className="text-slate-500">Pembayar</span><div className="font-medium">{o.payerNama} {o.payerScheme && <Badge tone="blue">{o.payerScheme}</Badge>}</div></div>
            <div><span className="text-slate-500">Rute</span><div className="font-medium">{o.route}</div></div>
            <div><span className="text-slate-500">Barang</span><div className="font-medium">{o.goodsType} · {o.koli} koli · {o.weight} kg</div></div>
            <div><span className="text-slate-500">Harga</span><div className="font-medium">{rupiah(o.price)}/{o.priceUnit} <Badge tone={o.priceSource === "manual" ? "amber" : "green"}>{SOURCE_LABEL[o.priceSource] ?? o.priceSource}</Badge></div></div>
          </div>
          <div className="text-base">Total: <b>{rupiah(o.total)}</b>{o.receivable && <> · Piutang: <Badge tone={o.receivable.overdue ? "red" : statusTone(o.receivable.status)}>{o.receivable.overdue ? "Overdue" : o.receivable.status}</Badge></>}</div>
          {o.internalNote && <p className="rounded bg-slate-50 p-2 text-slate-600">Catatan: {o.internalNote}</p>}
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => pr("resi")}><Printer size={14} />Resi</button>
            <button className={btnGhost} onClick={() => pr("suratjalan")}><Printer size={14} />Surat Jalan</button>
            <button className={btnGhost} onClick={() => pr("invoice")}><FileText size={14} />Invoice</button>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Riwayat Status</h3>
            <ol className="space-y-1 border-l-2 border-slate-200 pl-3">
              {o.history.map((h, i) => <li key={i}><Badge tone={statusTone(h.status)}>{h.status}</Badge> <span className="text-xs text-slate-500">{new Date(h.at).toLocaleString("id-ID")} {h.by && `· ${h.by}`}</span>{h.note && <div className="text-slate-600">{h.note}</div>}</li>)}
            </ol>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <Field label="Ubah status"><select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Pilih...</option>{STATUSES.filter((s) => s !== o.status).map((s) => <option key={s}>{s}</option>)}</select></Field>
            <div className="min-w-48 flex-1"><Field label="Catatan"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
            <button className={btnPrimary} disabled={!status} onClick={update}>Simpan</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function EpOrders() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const qs = new URLSearchParams({ ...(q && { q }), ...(status && { status }) }).toString();
  const { data, loading, error, reload } = useApi<{ items: EpOrder[] }>(`/api/ep/orders${qs ? `?${qs}` : ""}`);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  return (
    <AdminLayout>
      <PageHead title="Order Ekspedisi" desc="Setiap order otomatis mendapat nomor resi, harga dari master harga, dan riwayat status."
        action={<button className={btnPrimary} onClick={() => setCreating(true)}><Plus size={16} />Order Baru</button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-xs`} placeholder="Cari resi / customer..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inputClass} max-w-44`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <Table>
        <thead><tr><Th>Resi</Th><Th>Tanggal</Th><Th>Rute</Th><Th>Pengirim → Penerima</Th><Th>Status</Th><Th right>Total</Th><Th /></tr></thead>
        <tbody>
          {data?.items.map((o) => (
            <tr key={o.id}>
              <Td><b>{o.resi}</b></Td><Td>{dateId(o.orderDate)}</Td><Td>{o.route}</Td><Td className="text-xs">{o.senderNama} → {o.receiverNama}</Td>
              <Td><Badge tone={statusTone(o.status)}>{o.status}</Badge></Td><Td right>{rupiah(o.total)}</Td>
              <Td right><button className={btnGhost} onClick={() => setDetail(o.id)}><Eye size={14} /></button></Td>
            </tr>
          ))}
          {!data?.items.length && <Empty cols={7} loading={loading} error={error} />}
        </tbody>
      </Table>
      {creating && <NewOrder onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {detail && <OrderDetail id={detail} onClose={() => setDetail(null)} onChanged={() => void reload()} />}
    </AdminLayout>
  );
}
