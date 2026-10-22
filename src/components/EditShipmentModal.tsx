import { AlertTriangle, Loader2, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLayanan } from "../store/LayananContext";
import { useShipments } from "../store/ShipmentContext";
import type { Shipment } from "../types";
import { useLocationSuggest } from "../utils/useLocationSuggest";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

/** Client self-service: edit EVERY customer-facing field of an order while it is
 * still "Dalam Persiapan". The API enforces ownership and status; internal
 * fields (SLA/ETA, truck, mitra) are not part of this form. */
export function EditShipmentModal({ shipment, onClose, onSaved }: { shipment: Shipment; onClose: () => void; onSaved?: () => void }) {
  const { updateShipmentInfo } = useShipments();
  const { activeNames: layananOptions, refresh: refreshLayanan } = useLayanan();

  const [f, setF] = useState({
    pengirimNama: shipment.pengirim.nama,
    pengirimTelepon: shipment.pengirim.telepon,
    pengirimEmail: shipment.pengirim.email,
    penerimaNama: shipment.penerima.nama,
    penerimaTelepon: shipment.penerima.telepon,
    penerimaEmail: shipment.penerima.email,
    kotaAsal: shipment.kotaAsal,
    alamatAsal: shipment.alamatAsal,
    kotaTujuan: shipment.kotaTujuan,
    alamatTujuan: shipment.alamatTujuan,
    deskripsiBarang: shipment.deskripsiBarang,
    beratKg: String(shipment.beratKg),
    jumlahKoli: String(shipment.jumlahKoli),
    layanan: shipment.layanan as string,
  });
  const kotaAsalSuggestions = useLocationSuggest("kota", f.kotaAsal);
  const kotaTujuanSuggestions = useLocationSuggest("kota", f.kotaTujuan);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Insurance fields are locked when the order has moved past preparation.
  const insuranceLocked = shipment.status !== "Dalam Persiapan" && shipment.status !== "Hold";

  // Insurance fields (separate state: not simple strings like the rest of f).
  const [asuransi, setAsuransi] = useState(shipment.asuransi);
  const [koliAsuransi, setKoliAsuransi] = useState(shipment.koliAsuransi ?? "");
  const [nilaiAsuransi, setNilaiAsuransi] = useState(shipment.nilaiAsuransi ? String(shipment.nilaiAsuransi) : "");

  useEffect(() => {
    refreshLayanan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The order's current layanan is always selectable, even if it was deactivated later.
  const layananChoices = layananOptions.includes(shipment.layanan) ? layananOptions : [shipment.layanan, ...layananOptions];

  const berat = Number(f.beratKg);
  const koli = Number(f.jumlahKoli);
  const valid =
    f.pengirimNama.trim() && f.pengirimTelepon.trim() && f.pengirimEmail.trim() &&
    f.penerimaNama.trim() && f.penerimaTelepon.trim() && f.penerimaEmail.trim() &&
    f.kotaAsal.trim() && f.alamatAsal.trim() && f.kotaTujuan.trim() && f.alamatTujuan.trim() &&
    berat > 0 && koli >= 1;

  async function save() {
    if (asuransi) {
      if (!koliAsuransi.trim()) { setError("Nomor koli yang diasuransikan wajib diisi."); return; }
      const nilai = Number(nilaiAsuransi);
      if (!nilai || nilai <= 0) { setError("Nilai barang yang diasuransikan wajib diisi dan lebih dari 0."); return; }
    }
    setPending(true);
    setError(null);
    const result = await updateShipmentInfo(shipment.awb, {
      pengirim: { nama: f.pengirimNama.trim(), telepon: f.pengirimTelepon.trim(), email: f.pengirimEmail.trim() },
      penerima: { nama: f.penerimaNama.trim(), telepon: f.penerimaTelepon.trim(), email: f.penerimaEmail.trim() },
      alamatAsal: f.alamatAsal.trim(),
      kotaAsal: f.kotaAsal.trim(),
      alamatTujuan: f.alamatTujuan.trim(),
      kotaTujuan: f.kotaTujuan.trim(),
      deskripsiBarang: f.deskripsiBarang.trim(),
      beratKg: berat,
      jumlahKoli: Math.floor(koli),
      layanan: f.layanan,
      asuransi,
      koliAsuransi: asuransi ? koliAsuransi : "",
      nilaiAsuransi: asuransi ? Number(nilaiAsuransi) : undefined,
    });
    setPending(false);
    if (result.ok) {
      onSaved?.();
      onClose();
    }
    else setError(result.error);
  }

  const field = (label: string, k: keyof typeof f, extra: { type?: string; list?: string; rows?: number; placeholder?: string } = {}) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {extra.rows ? (
        <textarea rows={extra.rows} className={inputClass} value={f[k]} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input
          type={extra.type ?? "text"}
          list={extra.list}
          autoComplete="off"
          className={inputClass}
          value={f[k]}
          placeholder={extra.placeholder}
          onChange={(e) => set(k, e.target.value)}
        />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Pencil size={18} /> Edit Data Pengiriman
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          AWB <span className="font-mono font-semibold">{shipment.awb}</span> · data hanya dapat diubah selama status masih Dalam Persiapan.
        </p>

        <datalist id="edit-kota-asal-suggestions">
          {kotaAsalSuggestions.map((k) => (
            <option key={k.nama} value={k.nama} />
          ))}
        </datalist>
        <datalist id="edit-kota-tujuan-suggestions">
          {kotaTujuanSuggestions.map((k) => (
            <option key={k.nama} value={k.nama} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:col-span-2">Pengirim</p>
          {field("Nama Pengirim", "pengirimNama")}
          {field("Telepon Pengirim", "pengirimTelepon")}
          <div className="sm:col-span-2">{field("Email Pengirim", "pengirimEmail", { type: "email" })}</div>

          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:col-span-2">Penerima</p>
          {field("Nama Penerima", "penerimaNama")}
          {field("Telepon Penerima", "penerimaTelepon")}
          <div className="sm:col-span-2">{field("Email Penerima", "penerimaEmail", { type: "email" })}</div>

          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:col-span-2">Rute</p>
          {field("Kota Asal", "kotaAsal", { list: "edit-kota-asal-suggestions" })}
          {field("Kota Tujuan", "kotaTujuan", { list: "edit-kota-tujuan-suggestions" })}
          {field("Alamat Asal", "alamatAsal", { rows: 2 })}
          {field("Alamat Tujuan", "alamatTujuan", { rows: 2 })}

          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:col-span-2">Barang</p>
          <div className="sm:col-span-2">{field("Deskripsi Barang", "deskripsiBarang", { rows: 2 })}</div>
          {field("Berat Final (Kg)", "beratKg", { type: "number" })}
          {field("Jumlah Koli", "jumlahKoli", { type: "number" })}
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Layanan</span>
            <select className={inputClass} value={f.layanan} onChange={(e) => set("layanan", e.target.value)}>
              {layananChoices.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600"
                checked={asuransi}
                disabled={insuranceLocked}
                onChange={(e) => {
                  setAsuransi(e.target.checked);
                  if (!e.target.checked) { setKoliAsuransi(""); setNilaiAsuransi(""); }
                }}
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">Asuransi Pengiriman</span>
                <span className="block text-xs text-slate-500">Centang jika barang ini diasuransikan.</span>
              </span>
            </div>
            {insuranceLocked && (
              <p className="mt-2 text-[11px] font-medium text-amber-600">
                Data asuransi terkunci — hanya bisa diubah saat status masih Dalam Persiapan.
              </p>
            )}
            {asuransi && (
              <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nomor Koli yang Diasuransikan</span>
                  <input
                    className={inputClass}
                    placeholder="Contoh: 62001, 62002"
                    value={koliAsuransi}
                    disabled={insuranceLocked}
                    onChange={(e) => setKoliAsuransi(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nilai Barang yang Diasuransikan (Rp)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={inputClass}
                    placeholder="Contoh: 1,000,000"
                    value={nilaiAsuransi ? Number(nilaiAsuransi).toLocaleString("en-US") : ""}
                    disabled={insuranceLocked}
                    onChange={(e) => setNilaiAsuransi(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-red-600">
            <AlertTriangle size={14} /> {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Batal
          </button>
          <button
            type="button"
            disabled={pending || !valid}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}
