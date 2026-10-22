import { AlertTriangle, Image as ImageIcon, Pencil, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { ACTION_ROW, actionClass } from "../../components/ActionButton";
import {
  MasterDataHeader,
  MasterDataToolbar,
  MasterFilterReset,
  MasterFilterSelect,
  MasterSearchInput,
  MasterTableCard,
  MasterTableMessage,
} from "../../components/master/MasterData";
import { Pagination } from "../../components/Pagination";
import { DeleteButton } from "../../components/DeleteButton";
import { useDebounced, usePagedList } from "../../utils/usePagedList";
import { useAuth } from "../../store/AuthContext";
import { useClientLogo, type ClientLogo } from "../../store/ClientLogoContext";
import { ApiError } from "../../utils/apiClient";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

type StatusFilter = "semua" | "aktif" | "nonaktif";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_MB = 8;

export default function ClientCompanyProfile() {
  const { profile } = useAuth();
  /** Management is Superadmin-only (the route guard enforces it too; the API
   * refuses anything else with 403). */
  const canManage = profile?.role === "Superadmin";
  const { createLogo, updateLogo } = useClientLogo();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const hasFilter = search.trim() !== "" || statusFilter !== "semua";
  function resetFilters() {
    setSearch("");
    setStatusFilter("semua");
  }
  const debouncedSearch = useDebounced(search.trim());
  const list = usePagedList<ClientLogo>("/api/client-logos", { q: debouncedSearch, status: statusFilter === "semua" ? "" : statusFilter });
  const [pageError, setPageError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await list.reload();
    } finally {
      setRefreshing(false);
    }
  }

  // --- Tambah / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientLogo | null>(null);
  const [nama, setNama] = useState("");
  const [altText, setAltText] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [aktif, setAktif] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openAdd() {
    setEditing(null);
    setNama("");
    setAltText("");
    setSortOrder("");
    setAktif(true);
    setFile(null);
    setPreview(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(l: ClientLogo) {
    setEditing(l);
    setNama(l.nama);
    setAltText(l.altText ?? "");
    setSortOrder(String(l.sortOrder));
    setAktif(l.aktif);
    setFile(null);
    setPreview(l.url);
    setFormError(null);
    setModalOpen(true);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFormError(null);
    if (!f) {
      setFile(null);
      setPreview(editing?.url ?? null);
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFormError("Format logo harus PNG, JPG/JPEG, atau WebP.");
      setFile(null);
      return;
    }
    if (f.size > MAX_LOGO_MB * 1024 * 1024) {
      setFormError(`Ukuran logo maksimal ${MAX_LOGO_MB}MB.`);
      setFile(null);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nama.trim()) {
      setFormError("Nama client wajib diisi.");
      return;
    }
    if (!editing && !file) {
      setFormError("Logo wajib diunggah.");
      return;
    }
    const order = sortOrder.trim() === "" ? undefined : Number(sortOrder);
    if (order !== undefined && (!Number.isInteger(order) || order < 1)) {
      setFormError("Urutan tampilan harus angka bulat lebih dari 0.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        nama: nama.trim(),
        altText: altText.trim() || undefined,
        sortOrder: order,
        aktif,
        ...(file ? { logoFile: file } : {}),
      };
      if (editing) {
        await updateLogo(editing.id, payload);
      } else {
        await createLogo(payload);
      }
      setModalOpen(false);
      void list.reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan data. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <MasterDataHeader
        title="Client Company Profile"
        description="Kelola logo client pada section Trusted by Our Clients di Company Profile. Hanya logo berstatus Aktif yang ditampilkan, sesuai urutan tampilan."
      />

      <MasterDataToolbar
        onRefresh={handleRefresh}
        refreshing={refreshing}
        addLabel="Tambah Client"
        onAdd={canManage ? () => openAdd() : undefined}
      >
        <MasterSearchInput value={search} onChange={setSearch} placeholder="Cari nama client..." />
        <MasterFilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} label="Filter status">
          <option value="semua">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </MasterFilterSelect>
        <MasterFilterReset visible={hasFilter} onReset={resetFilters} />
      </MasterDataToolbar>

      {pageError && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <span>{pageError}</span>
          <button type="button" onClick={() => setPageError(null)} className="shrink-0 text-red-500 hover:text-red-800" title="Tutup">
            <X size={15} />
          </button>
        </div>
      )}

      <MasterTableCard minWidth={820}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Logo Client</th>
            <th className="px-4 py-3 font-medium">Nama Client</th>
            <th className="px-4 py-3 font-medium">Urutan Tampilan</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Tanggal Ditambahkan</th>
            {canManage && <th className="px-4 py-3 font-medium">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.items.length === 0 && (
            <MasterTableMessage
              colSpan={canManage ? 6 : 5}
              loading={list.loading && list.items.length === 0}
              loadingText="Memuat logo client..."
              icon={ImageIcon}
              title={hasFilter ? "Tidak ada data." : "Belum ada logo client."}
              description={hasFilter ? undefined : "Tambahkan logo pertama untuk ditampilkan di Company Profile."}
              action={
                canManage && !hasFilter ? (
                  <button type="button" onClick={openAdd} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                    <ImageIcon size={15} /> Tambah Client
                  </button>
                ) : undefined
              }
            />
          )}
          {list.items.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="flex h-14 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5">
                  {l.url ? (
                    <img src={l.url} alt={l.altText ?? l.nama} className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <span className="text-[11px] text-slate-400">Tanpa gambar</span>
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{l.nama}</td>
              <td className="px-4 py-3 text-slate-600">{l.sortOrder}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${l.aktif ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {l.aktif ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(l.createdAt).toLocaleDateString("id-ID")}</td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className={ACTION_ROW}>
                    <button
                      onClick={() => openEdit(l)}
                      title="Edit"
                      aria-label="Edit"
                      className={actionClass("edit")}
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteButton
                      entityType="client_logo"
                      id={l.id}
                      details={[["Client", l.nama], ["Status", l.aktif ? "Aktif" : "Nonaktif"]]}
                      onDone={() => void list.reload()}
                    />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </MasterTableCard>
      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="client" />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit} className="max-h-[90vh] overflow-y-auto p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Client" : "Tambah Client"}</h2>
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    Nama Client <span className="text-rose-600">*</span>
                  </span>
                  <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: PT Maju Bersama" maxLength={120} className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    Upload Logo {!editing && <span className="text-rose-600">*</span>}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFile}
                    className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                  />
                  <span className="mt-1.5 block text-[11px] text-slate-400">PNG, JPG/JPEG, atau WebP. Maksimal {MAX_LOGO_MB}MB.</span>
                  {preview && (
                    <div className="mt-2 flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5">
                      <img src={preview} alt="Pratinjau logo" className="h-full w-full object-contain" />
                    </div>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Alt Text (opsional)</span>
                  <input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Deskripsi singkat untuk aksesibilitas gambar" maxLength={200} className={inputClass} />
                  <span className="mt-1.5 block text-[11px] text-slate-400">Kosongkan untuk memakai nama client.</span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Urutan Tampilan (opsional)</span>
                  <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={1} max={9999} placeholder="Kosongkan untuk otomatis di akhir" className={inputClass} />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-200" />
                  Aktif (ditampilkan di Company Profile)
                </label>
              </div>
              {formError && (
                <p className="mt-4 flex items-start gap-1.5 text-sm font-medium text-red-600">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {formError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}