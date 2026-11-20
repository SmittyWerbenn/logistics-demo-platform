import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminLayout } from "../../../components/layout/AdminLayout";
import { api } from "../../../utils/apiClient";
import { btnGhost, btnPrimary, Empty, Field, inputClass, Modal, PageHead, rupiah, Table, Td, Th, useApi, type EpRoute } from "./common";

const blank = { asal: "", tujuan: "", publishRate: "", unit: "kg", transitDays: "", notes: "" };

export default function EpRoutes() {
  const { data, loading, error, reload } = useApi<{ items: EpRoute[] }>("/api/ep/routes");
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const { id, publishRate, transitDays, ...rest } = form;
    const body = { ...rest, publishRate: publishRate === "" ? null : Number(publishRate), transitDays: transitDays === "" ? null : Number(transitDays) };
    try {
      if (id) await api.patch(`/api/ep/routes/${id}`, body); else await api.post("/api/ep/routes", body);
      setForm(null); setErr(""); await reload();
    } catch (x) { setErr(x instanceof Error ? x.message : "Gagal menyimpan."); }
  }
  async function remove(r: EpRoute) {
    if (!confirm(`Hapus rute ${r.asal} → ${r.tujuan}?`)) return;
    try { await api.del(`/api/ep/routes/${r.id}`); await reload(); } catch (x) { alert(x instanceof Error ? x.message : "Gagal menghapus."); }
  }

  return (
    <AdminLayout>
      <PageHead title="Master Rute" desc="Rute asal → tujuan beserta harga publish (fallback bila belum ada harga khusus)."
        action={<button className={btnPrimary} onClick={() => setForm({ ...blank })}><Plus size={16} />Rute Baru</button>} />
      <Table>
        <thead><tr><Th>Rute</Th><Th right>Harga Publish</Th><Th>Estimasi</Th><Th>Catatan</Th><Th /></tr></thead>
        <tbody>
          {data?.items.map((r) => (
            <tr key={r.id}>
              <Td><b>{r.asal} → {r.tujuan}</b></Td>
              <Td right>{r.publishRate != null ? `${rupiah(r.publishRate)}/${r.unit}` : "-"}</Td>
              <Td>{r.transitDays != null ? `${r.transitDays} hari` : "-"}</Td>
              <Td className="text-xs text-slate-600">{r.notes}</Td>
              <Td right><div className="flex justify-end gap-1">
                <button className={btnGhost} onClick={() => setForm({ id: r.id, asal: r.asal, tujuan: r.tujuan, publishRate: r.publishRate?.toString() ?? "", unit: r.unit, transitDays: r.transitDays?.toString() ?? "", notes: r.notes ?? "" })}><Pencil size={14} /></button>
                <button className={btnGhost} onClick={() => remove(r)}><Trash2 size={14} /></button>
              </div></Td>
            </tr>
          ))}
          {!data?.items.length && <Empty cols={5} loading={loading} error={error} />}
        </tbody>
      </Table>
      {form && (
        <Modal title={form.id ? "Ubah Rute" : "Rute Baru"} onClose={() => setForm(null)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Field label="Asal *"><input required className={inputClass} value={form.asal} onChange={(e) => set("asal", e.target.value)} /></Field>
            <Field label="Tujuan *"><input required className={inputClass} value={form.tujuan} onChange={(e) => set("tujuan", e.target.value)} /></Field>
            <Field label="Harga publish"><input type="number" min={0} className={inputClass} value={form.publishRate} onChange={(e) => set("publishRate", e.target.value)} /></Field>
            <Field label="Satuan"><select className={inputClass} value={form.unit} onChange={(e) => set("unit", e.target.value)}><option>kg</option><option>koli</option><option>flat</option></select></Field>
            <Field label="Estimasi (hari)"><input type="number" min={0} className={inputClass} value={form.transitDays} onChange={(e) => set("transitDays", e.target.value)} /></Field>
            <Field label="Catatan"><input className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            {err && <p className="sm:col-span-2 text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={btnGhost} onClick={() => setForm(null)}>Batal</button><button className={btnPrimary}>Simpan</button></div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
