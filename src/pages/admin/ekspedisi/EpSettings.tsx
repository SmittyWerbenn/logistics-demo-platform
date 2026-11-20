import { useEffect, useState, type FormEvent } from "react";
import { AdminLayout } from "../../../components/layout/AdminLayout";
import { api } from "../../../utils/apiClient";
import { btnPrimary, Field, inputClass, PageHead, useApi, type EpSettings as S } from "./common";

export default function EpSettings() {
  const { data } = useApi<S>("/api/ep/settings");
  const [f, setF] = useState<S>({});
  const [msg, setMsg] = useState("");
  useEffect(() => { if (data) setF(data); }, [data]);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.patch("/api/ep/settings", f); setMsg("Pengaturan disimpan."); } catch (x) { setMsg(x instanceof Error ? x.message : "Gagal menyimpan."); }
  }
  return (
    <AdminLayout>
      <PageHead title="Pengaturan Ekspedisi" desc="Hanya Owner. Format resi, kop invoice, tempo PAD, dan persetujuan perubahan harga." />
      <form onSubmit={submit} className="grid max-w-2xl gap-3">
        <Field label="Format resi" hint="Pakai {YYYY} untuk tahun dan {NNNNN} untuk nomor urut"><input className={inputClass} value={f.resi_format ?? ""} onChange={(e) => set("resi_format", e.target.value)} /></Field>
        <Field label="Kop invoice (baris 1 = nama perusahaan)"><textarea rows={3} className={inputClass} value={f.invoice_header ?? ""} onChange={(e) => set("invoice_header", e.target.value)} /></Field>
        <Field label="Rekening pembayaran"><textarea rows={2} className={inputClass} value={f.invoice_bank ?? ""} onChange={(e) => set("invoice_bank", e.target.value)} /></Field>
        <Field label="Footer invoice"><textarea rows={2} className={inputClass} value={f.invoice_footer ?? ""} onChange={(e) => set("invoice_footer", e.target.value)} /></Field>
        <Field label="Tempo default PAD (hari)"><input type="number" min={0} className={inputClass} value={f.pad_default_days ?? ""} onChange={(e) => set("pad_default_days", e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.price_approval === "true"} onChange={(e) => set("price_approval", e.target.checked ? "true" : "false")} />Perubahan harga oleh Admin memerlukan persetujuan Owner</label>
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
        <div><button className={btnPrimary}>Simpan</button></div>
      </form>
    </AdminLayout>
  );
}
