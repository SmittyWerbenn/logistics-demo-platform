import { AlertTriangle, Download, FileSpreadsheet, Loader2, Pencil, Tags } from "lucide-react";
import { DeleteButton } from "../../components/DeleteButton";
import { useEffect, useRef, useState } from "react";
import { ACTION_ROW, ActionButton } from "../../components/ActionButton";
import { AdminLayout } from "../../components/layout/AdminLayout";
import {
  MasterDataHeader,
  MasterDataToolbar,
  MasterFilterReset,
  MasterFilterSelect,
  MasterSearchInput,
  MasterTableCard,
  MasterTableMessage,
  MasterToolbarButton,
} from "../../components/master/MasterData";
import { Pagination } from "../../components/Pagination";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../store/AuthContext";
import { api, ApiError } from "../../utils/apiClient";
import { downloadCsv, normalizeHeader, readTableFromFile } from "../../utils/csv";
import { formatTanggalJam, isoToWib } from "../../utils/format";
import { formatRupiah } from "../../utils/ongkir";
import { useDebounced, usePagedList } from "../../utils/usePagedList";

interface TariffRow {
  id: number;
  provinsi: string;
  pulau: string | null;
  /** SEDANG / JAUH from Java (Master Wilayah); null for Java itself. */
  jarakJawa: "SEDANG" | "JAUH" | null;
  kabupatenKota: string;
  kecamatan: string;
  kategoriArea: string;
  tarifPerKg: number;
  leadTime: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface PreviewRow {
  row: number | null;
  id: number | null;
  provinsi: string;
  kota: string;
  kecamatan: string;
  lama: number | null;
  baru: number | null;
  status: "UPDATE" | "SAMA" | "ERROR";
  message: string;
}
interface Preview {
  summary: { total: number; update: number; sama: number; error: number };
  rows: PreviewRow[];
  /** Rows already identical to the file's own "Rate Publish Lama" column: not even sent to the API. */
  notSent: number;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

/** Distance class from Java for display; Java itself has none. */
const jarakLabel = (j: "SEDANG" | "JAUH" | null) => (j === "SEDANG" ? "Sedang" : j === "JAUH" ? "Jauh" : "-");

const fmtIso = (iso: string) => {
  const w = isoToWib(iso);
  return formatTanggalJam(w.tanggal, w.jam);
};

/** Rate Publish: Harga Publish (price_tariffs) yang dipakai halaman Cek Ongkir. Hanya nilai master rate yang
 * dikelola di sini - semua aturan harga (markup asal, layanan, minimum, pembulatan) tetap di service pricing API.
 *
 * Access Control (ditegakkan ulang di backend API):
 * - Superadmin: VIEW + EDIT (kolom Aksi, Bulk Update, Unduh Data)
 * - Admin (GMS-Admin): VIEW + Unduh Data - tanpa kolom Aksi dan tanpa Bulk Update
 * - Viewer + Client (Admin Client): VIEW ONLY (tanpa kolom Diperbarui/Aksi, tanpa Bulk Update/Unduh Data)
 */
export default function RatePublish() {
  const toast = useToast();
  const { profile } = useAuth();
  // Diperbarui + Unduh Data: Superadmin & Admin (GMS-Admin).
  const canManage = profile?.role === "Superadmin" || profile?.role === "Admin";
  // Ubah Rate Publish (kolom Aksi) + Bulk Update: Superadmin saja.
  const canEdit = profile?.role === "Superadmin";
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [provinsi, setProvinsi] = useState("");
  const [kota, setKota] = useState("");
  const [kategori, setKategori] = useState("");
  const [pulau, setPulau] = useState("");
  const [jarak, setJarak] = useState("");
  const [facets, setFacets] = useState<{ provinsi: string[]; kota: string[]; kategori: string[]; pulau: string[] }>({ provinsi: [], kota: [], kategori: [], pulau: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const debounced = useDebounced(search.trim());
  const list = usePagedList<TariffRow>("/api/rate-publish", { q: debounced, provinsi, kota, kategori, pulau, jarak }, undefined, { pageSizeKey: "rate-publish", defaultPageSize: 20 });

  useEffect(() => {
    api.get<typeof facets>(`/api/rate-publish/facets${provinsi ? `?provinsi=${encodeURIComponent(provinsi)}` : ""}`).then(setFacets).catch(() => {});
  }, [provinsi]);

  const hasFilter = !!(search.trim() || provinsi || kota || kategori || pulau || jarak);
  function resetFilters() {
    setSearch("");
    setProvinsi("");
    setKota("");
    setKategori("");
    setPulau("");
    setJarak("");
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await list.reload();
    } finally {
      setRefreshing(false);
    }
  }

  // ---- Edit satu data
  const [editing, setEditing] = useState<TariffRow | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function saveEdit() {
    if (!editing || editBusy) return;
    const n = Number(editValue);
    if (!editValue.trim() || !Number.isInteger(n) || n <= 0) {
      setEditError("Rate Publish harus angka bulat lebih dari 0.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      await api.patch(`/api/rate-publish/${editing.id}`, { tarifPerKg: n });
      toast("Rate Publish berhasil diperbarui.");
      setEditing(null);
      void list.reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Gagal menyimpan Rate Publish.");
    } finally {
      setEditBusy(false);
    }
  }

  // ---- Unduh data (ID = kunci untuk Bulk Update)
  async function handleExport() {
    setExporting(true);
    setPageError(null);
    try {
      const qs = new URLSearchParams();
      if (debounced) qs.set("q", debounced);
      if (provinsi) qs.set("provinsi", provinsi);
      if (kota) qs.set("kota", kota);
      if (kategori) qs.set("kategori", kategori);
      if (pulau) qs.set("pulau", pulau);
      if (jarak) qs.set("jarak", jarak);
      const res = await api.get<{ items: TariffRow[] }>(`/api/rate-publish/export?${qs.toString()}`);
      downloadCsv(
        "rate-publish.csv",
        ["ID", "Provinsi", "Pulau", "Jarak dari P.Jawa", "Kabupaten/Kota", "Kecamatan", "Kategori Area", "Rate Publish Lama", "Rate Publish Baru"],
        res.items.map((r) => [String(r.id), r.provinsi, r.pulau ?? "", jarakLabel(r.jarakJawa), r.kabupatenKota, r.kecamatan, r.kategoriArea, String(r.tarifPerKg), String(r.tarifPerKg)]),
      );
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Gagal mengunduh data.");
    } finally {
      setExporting(false);
    }
  }

  // ---- Bulk Update: file -> preview -> konfirmasi -> commit
  const [bulkBusy, setBulkBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [commitBusy, setCommitBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBulkBusy(true);
    setPageError(null);
    try {
      const table = await readTableFromFile(file);
      if (table.length < 2) throw new Error("File kosong atau tidak ada baris data.");
      const head = table[0].map((c) => normalizeHeader(String(c ?? "")));
      const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
      const cId = col("id", "id tarif", "id area");
      const cBaru = col("rate publish baru", "rate baru", "rate publish");
      const cLama = col("rate publish lama", "rate lama");
      const cProv = col("provinsi");
      const cKota = col("kabupaten/kota", "kabupaten kota", "kota");
      const cKec = col("kecamatan");
      if (cId < 0) throw new Error('Kolom "ID" tidak ditemukan. Unduh data dari halaman ini lalu ubah kolom "Rate Publish Baru".');
      if (cBaru < 0) throw new Error('Kolom "Rate Publish Baru" tidak ditemukan.');
      const cell = (r: unknown[], c: number) => (c >= 0 ? String(r[c] ?? "").trim() : "");
      const digits = (v: string) => v.replace(/[^\d]/g, "");
      const rows: Array<Record<string, unknown>> = [];
      let notSent = 0;
      table.slice(1).forEach((r, i) => {
        if (!r || r.every((c) => String(c ?? "").trim() === "")) return;
        const baru = cell(r, cBaru);
        // A row whose new rate equals the file's own old-rate column is simply unchanged: not sent (keeps the request small).
        if (cLama >= 0 && baru !== "" && digits(baru) === digits(cell(r, cLama)) && digits(baru) !== "") {
          notSent++;
          return;
        }
        rows.push({ row: i + 2, id: cell(r, cId), provinsi: cell(r, cProv), kota: cell(r, cKota), kecamatan: cell(r, cKec), baru });
      });
      if (rows.length === 0) {
        toast(`Tidak ada perubahan Rate Publish di file (${notSent} baris sama dengan data lama).`);
        return;
      }
      const res = await api.post<{ summary: Preview["summary"]; rows: PreviewRow[] }>("/api/rate-publish/bulk/preview", { rows });
      setBulkError(null);
      setPreview({ ...res, notSent });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Gagal membaca file.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function commitBulk() {
    if (!preview || commitBusy) return;
    setCommitBusy(true);
    setBulkError(null);
    try {
      const rows = preview.rows.filter((r) => r.status === "UPDATE").map((r) => ({ id: r.id, baru: r.baru, lama: r.lama }));
      const res = await api.post<{ changed: number }>("/api/rate-publish/bulk/commit", { rows });
      toast(`${res.changed} Rate Publish berhasil diperbarui.`);
      setPreview(null);
      void list.reload();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan. Tidak ada data yang diubah.");
    } finally {
      setCommitBusy(false);
    }
  }

  const shown = preview ? [...preview.rows.filter((r) => r.status === "ERROR"), ...preview.rows.filter((r) => r.status === "UPDATE"), ...preview.rows.filter((r) => r.status === "SAMA")].slice(0, 300) : [];

  return (
    <AdminLayout>
      <MasterDataHeader
        title="Rate Publish"
        description="Harga publish per kg (basis, asal Jabodetabek) yang dipakai halaman Cek Ongkir. Aturan perhitungan (markup asal, layanan, minimum, pembulatan) tidak diubah di sini; hanya nilai Rate Publish."
      />
      <MasterDataToolbar
        onRefresh={handleRefresh}
        refreshing={refreshing}
        addLabel=""
        secondary={
          canManage ? (
            <>
              <MasterToolbarButton onClick={() => void handleExport()} icon={Download} label="Unduh Data" busy={exporting} />
              {canEdit && (
                <>
                  <MasterToolbarButton onClick={() => fileRef.current?.click()} icon={FileSpreadsheet} label="Bulk Update" busy={bulkBusy} />
                  <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={handleFile} />
                </>
              )}
            </>
          ) : undefined
        }
      >
        <MasterSearchInput value={search} onChange={setSearch} placeholder="Cari provinsi, kab/kota, atau kecamatan..." />
        <MasterFilterSelect
          value={provinsi}
          onChange={(v) => {
            setProvinsi(v);
            setKota("");
          }}
          label="Filter provinsi"
        >
          <option value="">Semua Provinsi</option>
          {facets.provinsi.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </MasterFilterSelect>
        {provinsi && (
          <MasterFilterSelect value={kota} onChange={setKota} label="Filter kabupaten/kota">
            <option value="">Semua Kab/Kota</option>
            {facets.kota.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </MasterFilterSelect>
        )}
        <MasterFilterSelect value={kategori} onChange={setKategori} label="Filter kategori area">
          <option value="">Semua Kategori</option>
          {facets.kategori.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </MasterFilterSelect>
        <MasterFilterSelect value={pulau} onChange={setPulau} label="Filter pulau">
          <option value="">Semua Pulau</option>
          {facets.pulau.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </MasterFilterSelect>
        <MasterFilterSelect value={jarak} onChange={setJarak} label="Filter jarak dari P.Jawa">
          <option value="">Semua Jarak</option>
          <option value="SEDANG">Jarak Sedang</option>
          <option value="JAUH">Jarak Jauh</option>
          <option value="JAWA">Pulau Jawa (tanpa jarak)</option>
        </MasterFilterSelect>
        <MasterFilterReset visible={hasFilter} onReset={resetFilters} />
      </MasterDataToolbar>

      {pageError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {pageError}
        </div>
      )}

      <MasterTableCard minWidth={1180}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Pulau</th>
            <th className="px-4 py-3 font-medium">Jarak dari P.Jawa</th>
            <th className="px-4 py-3 font-medium">Provinsi</th>
            <th className="px-4 py-3 font-medium">Kabupaten / Kota</th>
            <th className="px-4 py-3 font-medium">Kecamatan</th>
            <th className="px-4 py-3 font-medium">Kategori</th>
            <th className="px-4 py-3 font-medium">Lead Time</th>
            <th className="px-4 py-3 text-right font-medium">Rate Publish / kg</th>
            {/* Diperbarui untuk Superadmin + Admin (GMS-Admin); Viewer + Client view-only tanpa kolom ini.
                Aksi (ubah rate) hanya Superadmin. */}
            {canManage && <th className="px-4 py-3 font-medium">Diperbarui</th>}
            {canEdit && <th className="px-4 py-3 font-medium">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.items.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.pulau ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">
                {t.jarakJawa ? (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.jarakJawa === "JAUH" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{jarakLabel(t.jarakJawa)}</span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{t.provinsi}</td>
              <td className="px-4 py-3 text-slate-600">{t.kabupatenKota}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{t.kecamatan}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.kategoriArea}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.leadTime}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatRupiah(t.tarifPerKg)}</td>
              {canManage && (
                <td className="px-4 py-3 text-xs text-slate-500">{t.updatedAt ? <>{fmtIso(t.updatedAt)}<br />{t.updatedBy}</> : "-"}</td>
              )}
              {canEdit && (
                <td className="px-4 py-3">
                  <div className={ACTION_ROW}>
                    <ActionButton
                      tone="edit"
                      title="Edit Rate Publish"
                      aria-label="Edit Rate Publish"
                      onClick={() => {
                        setEditing(t);
                        setEditValue(String(t.tarifPerKg));
                        setEditError(null);
                      }}
                    >
                      <Pencil size={16} />
                    </ActionButton>
                    <DeleteButton
                      entityType="tariff"
                      id={String(t.id)}
                      details={[
                        ["Kecamatan", t.kecamatan],
                        ["Kab/Kota", t.kabupatenKota],
                        ["Provinsi", t.provinsi],
                        ["Rate Saat Ini", formatRupiah(t.tarifPerKg)],
                      ]}
                      onDone={() => list.reload()}
                    />
                  </div>
                </td>
              )}
            </tr>
          ))}
          {list.items.length === 0 && (
            <MasterTableMessage colSpan={canEdit ? 10 : canManage ? 9 : 8} loading={list.loading} loadingText="Memuat Rate Publish..." icon={Tags} title={hasFilter ? "Tidak ada data yang cocok." : "Belum ada data Rate Publish."} />
          )}
        </tbody>
      </MasterTableCard>
      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="area" />

      {editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Ubah Rate Publish</h2>
            <dl className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-xs text-slate-500">Kecamatan</dt><dd className="font-medium text-slate-800">{editing.kecamatan}</dd></div>
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-xs text-slate-500">Kab / Kota</dt><dd className="text-slate-800">{editing.kabupatenKota}, {editing.provinsi}</dd></div>
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-xs text-slate-500">Rate saat ini</dt><dd className="font-mono font-semibold text-slate-800">{formatRupiah(editing.tarifPerKg)} / kg</dd></div>
            </dl>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Rate Publish baru (Rp per kg) <span className="text-rose-600">*</span></span>
              <input autoFocus inputMode="numeric" className={inputClass} value={editValue} onChange={(e) => setEditValue(e.target.value.replace(/[^\d]/g, ""))} onKeyDown={(e) => e.key === "Enter" && void saveEdit()} />
            </label>
            <p className="mt-3 text-xs text-slate-500">
              Apakah Anda yakin ingin mengubah Rate Publish? Nilai baru langsung dipakai Cek Ongkir sesuai aturan perhitungan yang berlaku. Order yang sudah dibuat tidak berubah.
            </p>
            {editError && <p className="mt-3 text-sm font-medium text-red-600">{editError}</p>}
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setEditing(null)} disabled={editBusy} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">Batal</button>
              <button type="button" onClick={() => void saveEdit()} disabled={editBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {editBusy && <Loader2 size={15} className="animate-spin" />} Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Preview Update Rate Publish</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <Stat label="Baris diperiksa" value={preview.summary.total + preview.notSent} />
              <Stat label="Rate berubah" value={preview.summary.update} tone="text-emerald-700" />
              <Stat label="Tidak berubah" value={preview.summary.sama + preview.notSent} />
              <Stat label="Error" value={preview.summary.error} tone={preview.summary.error ? "text-rose-700" : undefined} />
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Baris</th>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Area</th>
                    <th className="px-3 py-2 text-right font-medium">Rate Lama</th>
                    <th className="px-3 py-2 text-right font-medium">Rate Baru</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((r, n) => (
                    <tr key={n}>
                      <td className="px-3 py-1.5 text-slate-500">{r.row ?? "-"}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600">{r.id ?? "-"}</td>
                      <td className="px-3 py-1.5 text-slate-700">{r.kecamatan ? `${r.kecamatan}, ${r.kota}` : "-"}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.lama !== null ? formatRupiah(r.lama) : "-"}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.baru !== null ? formatRupiah(r.baru) : "INVALID"}</td>
                      <td className="px-3 py-1.5">
                        <span className={`font-semibold ${r.status === "UPDATE" ? "text-emerald-700" : r.status === "ERROR" ? "text-rose-700" : "text-slate-500"}`}>
                          {r.status === "UPDATE" ? "Update" : r.status === "ERROR" ? "Error" : "Sama"}
                        </span>
                        {r.status === "ERROR" && <span className="ml-1.5 text-rose-600">{r.message}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > shown.length && <p className="mt-1.5 text-[11px] text-slate-400">Menampilkan {shown.length} dari {preview.rows.length} baris (error dan perubahan lebih dulu).</p>}
            {preview.summary.error > 0 ? (
              <p className="mt-3 text-sm font-medium text-rose-700">Masih ada {preview.summary.error} baris bermasalah. Perbaiki file lalu upload ulang; tidak ada data yang diubah.</p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Anda akan mengubah <span className="font-semibold">{preview.summary.update}</span> Rate Publish. Perubahan ini akan digunakan oleh Cek Ongkir sesuai dengan pricing rules dan setting yang saat ini berlaku. Data yang tidak ada di file tidak dihapus. Apakah Anda yakin ingin melanjutkan?
              </p>
            )}
            {bulkError && <p className="mt-2 text-sm font-medium text-red-600">{bulkError}</p>}
            <div className="mt-4 flex justify-end gap-2.5">
              <button type="button" onClick={() => setPreview(null)} disabled={commitBusy} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">Batal</button>
              <button
                type="button"
                onClick={() => void commitBulk()}
                disabled={commitBusy || preview.summary.error > 0 || preview.summary.update === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {commitBusy && <Loader2 size={15} className="animate-spin" />} Konfirmasi Update
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <p className={`text-lg font-bold ${tone ?? "text-slate-800"}`}>{value.toLocaleString("id-ID")}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
