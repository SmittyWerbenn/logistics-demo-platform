import { DeactivateModal } from "../../components/DeactivateModal";
import { ACTION_ROW, actionClass } from "../../components/ActionButton";
import { AlertTriangle, Ban, Layers, Pencil, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { AdminLayout } from "../../components/layout/AdminLayout";
import {
  MasterDataHeader,
  MasterDataToolbar,
  MasterFilterReset,
  MasterFilterSelect,
  MasterSearchInput,
  MasterTableCard,
  MasterTableMessage,
} from "../../components/master/MasterData";
import { useLayanan, type Layanan } from "../../store/LayananContext";
import { useAuth } from "../../store/AuthContext";
import { ApiError } from "../../utils/apiClient";
import { DeleteButton } from "../../components/DeleteButton";
import { Pagination } from "../../components/Pagination";
import { useDebounced, usePagedList } from "../../utils/usePagedList";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

const CUSTOM = "__custom__";

type StatusFilter = "semua" | "aktif" | "nonaktif";

export default function LayananList() {
  const { profile } = useAuth();
  /** Superadmin + Admin (GMS-Admin) maintain the master data; Viewer + Client
   * (Admin Client) may open this page but only VIEW - no Tambah button and no
   * Aksi column. Enforced again server-side with `settings.manage`. */
  const canManage = profile?.role === "Superadmin" || profile?.role === "Admin";
  const { layanans, standardOptions, fallback, isLoading: lookupLoading, refresh: refreshLookup, createLayanan, updateLayanan } =
    useLayanan();
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const hasFilter = search.trim() !== "" || statusFilter !== "semua";
  function resetFilters() {
    setSearch("");
    setStatusFilter("semua");
  }
  // Search / Status are applied by the API (filter -> sort -> LIMIT/OFFSET); only the visible page is loaded.
  const debouncedSearch = useDebounced(search.trim());
  const list = usePagedList<Layanan>("/api/layanan", { q: debouncedSearch, status: statusFilter === "semua" ? "" : statusFilter });
  const filtered = list.items;
  const isLoading = lookupLoading;
  const refresh = async () => {
    await Promise.all([refreshLookup(), list.reload()]);
  };

  const [pageError, setPageError] = useState<string | null>(null);

  // --- Tambah Layanan: pick a standard layanan, or enter a custom one.
  const existingNames = useMemo(() => new Set(layanans.map((l) => l.nama.toLowerCase())), [layanans]);
  const [modalOpen, setModalOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [customName, setCustomName] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openAdd(preselect = "") {
    setChoice(preselect);
    setCustomName("");
    setDeskripsi("");
    setFormError(null);
    setModalOpen(true);
  }

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    const nama = choice === CUSTOM ? customName.trim() : choice;
    if (!nama) {
      setFormError("Pilih layanan atau isi nama layanan custom.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createLayanan(nama, deskripsi.trim());
      void list.reload();
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menambahkan layanan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  // --- Edit (rename)
  const [editing, setEditing] = useState<Layanan | null>(null);
  const [editName, setEditName] = useState("");
  const [editDeskripsi, setEditDeskripsi] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(l: Layanan) {
    setEditing(l);
    setEditName(l.nama);
    setEditDeskripsi(l.deskripsi ?? "");
    setEditError(null);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      // Only send what actually changed (the default layanan's name is locked).
      const changes: { nama?: string; deskripsi?: string } = {};
      if (!editing.fallback && editName.trim() !== editing.nama) changes.nama = editName.trim();
      if (editDeskripsi.trim() !== (editing.deskripsi ?? "")) changes.deskripsi = editDeskripsi.trim();
      if (Object.keys(changes).length > 0) await updateLayanan(editing.id, changes);
      void list.reload();
      setEditing(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  // --- Aktif/Nonaktif + Hapus
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deactTarget, setDeactTarget] = useState<Layanan | null>(null);
  async function handleToggleActive(l: Layanan) {
    const next = !l.aktif;
    // Nonaktifkan always goes through the confirmation modal (API is only called from its confirm button).
    if (!next) { setDeactTarget(l); return; }
    if (!window.confirm(`Aktifkan kembali layanan ${l.nama}? Layanan ini akan muncul lagi untuk order baru.`)) return;
    setBusyId(l.id);
    setPageError(null);
    try {
      await updateLayanan(l.id, { aktif: next });
      void list.reload();
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : "Gagal mengubah status layanan.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      {deactTarget && (
        <DeactivateModal
          entityLabel="layanan"
          details={[["Layanan", deactTarget.nama], ["Status", "Aktif"]]}
          note="Layanan tidak akan muncul untuk order baru. Order yang sudah ada tidak berubah."
          onClose={() => setDeactTarget(null)}
          onConfirm={async () => {
            await updateLayanan(deactTarget.id, { aktif: false });
            void list.reload();
          }}
        />
      )}
      <MasterDataHeader
        title="Master Layanan"
        description={`Daftar layanan pengiriman. Hanya layanan berstatus Aktif yang bisa dipilih saat membuat atau mengedit order. Layanan yang tidak dikenali pada order baru otomatis memakai ${fallback.nama}.`}
      />

      <MasterDataToolbar
        onRefresh={handleRefresh}
        refreshing={refreshing}
        addLabel="Tambah Layanan"
        onAdd={canManage ? () => openAdd() : undefined}
      >
        <MasterSearchInput value={search} onChange={setSearch} placeholder="Cari nama atau deskripsi layanan..." />
        <MasterFilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} label="Filter status">
          <option value="semua">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </MasterFilterSelect>
        <MasterFilterReset visible={hasFilter} onReset={resetFilters} />
      </MasterDataToolbar>

      {!fallback.ready && !isLoading && (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p>
              <span className="font-semibold">Layanan fallback {fallback.nama} belum tersedia atau tidak aktif.</span>{" "}
              Order baru dengan layanan yang tidak ada di daftar ini akan ditolak sampai {fallback.nama} ditambahkan dan
              aktif.
            </p>
          </div>
          {canManage && !existingNames.has(fallback.nama.toLowerCase()) && (
            <button
              type="button"
              onClick={() => openAdd(fallback.nama)}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Tambah {fallback.nama}
            </button>
          )}
        </div>
      )}

      {pageError && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <span>{pageError}</span>
          <button type="button" onClick={() => setPageError(null)} className="shrink-0 text-red-500 hover:text-red-800" title="Tutup">
            <X size={15} />
          </button>
        </div>
      )}

      <MasterTableCard minWidth={760}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Layanan</th>
            <th className="px-4 py-3 font-medium">Deskripsi</th>
            <th className="px-4 py-3 font-medium">Dipakai Order</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {canManage && <th className="px-4 py-3 font-medium">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.length === 0 && (
            <MasterTableMessage
              colSpan={canManage ? 5 : 4}
              loading={list.loading && filtered.length === 0}
              loadingText="Memuat data layanan..."
              icon={Layers}
              title={hasFilter ? "Tidak ada data." : "Belum ada data layanan."}
            />
          )}
          {filtered.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3">
                <span className="flex items-center gap-2 font-semibold text-slate-900">
                  <Layers size={14} className="text-teal-600" />
                  {l.nama}
                  {l.fallback && (
                    <span
                      title="Layanan fallback order - tidak bisa dihapus, dinonaktifkan, atau diganti namanya"
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                    >
                      <ShieldCheck size={11} /> Default
                    </span>
                  )}
                </span>
              </td>
              <td className="max-w-[320px] px-4 py-3 text-slate-600">
                {l.deskripsi ? (
                  <span className="line-clamp-2 break-words" title={l.deskripsi}>
                    {l.deskripsi}
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{l.jumlahOrder} order</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    l.aktif ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {l.aktif ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className={ACTION_ROW}>
                    <button
                      onClick={() => openEdit(l)}
                      title="Edit"
                      className={actionClass("edit")}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(l)}
                      disabled={busyId === l.id || (l.fallback && l.aktif)}
                      title={l.fallback && l.aktif ? "Layanan default tidak bisa dinonaktifkan" : l.aktif ? "Nonaktifkan" : "Aktifkan"}
                      className={actionClass(l.aktif ? "danger" : "success")}
                    >
                      {l.aktif ? <Ban size={16} /> : <RotateCcw size={16} />}
                    </button>
                    {!l.fallback && (
                      <DeleteButton
                        entityType="layanan"
                        id={l.id}
                        details={[["Layanan", l.nama]]}
                        onDone={refresh}
                      />
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </MasterTableCard>
      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="layanan" />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleAddSubmit} className="max-h-[90vh] overflow-y-auto p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Tambah Layanan</h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Pilih Layanan</span>
                  <select value={choice} onChange={(e) => setChoice(e.target.value)} className={inputClass}>
                    <option value="">- Pilih layanan -</option>
                    {standardOptions.map((s) => {
                      const exists = existingNames.has(s.toLowerCase());
                      return (
                        <option key={s} value={s} disabled={exists}>
                          {s}
                          {exists ? " (sudah ada)" : ""}
                        </option>
                      );
                    })}
                    <option value={CUSTOM}>+ Tambah Layanan Custom</option>
                  </select>
                </label>
                {choice === CUSTOM && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Layanan Custom</span>
                    <input
                      autoFocus
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Contoh: Same Day"
                      maxLength={50}
                      className={inputClass}
                    />
                    <span className="mt-1.5 block text-[11px] text-slate-400">
                      Nama tidak boleh sama dengan layanan yang sudah ada.
                    </span>
                  </label>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Deskripsi (opsional)</span>
                  <textarea
                    value={deskripsi}
                    onChange={(e) => setDeskripsi(e.target.value)}
                    placeholder="Penjelasan singkat layanan ini"
                    rows={3}
                    maxLength={300}
                    className={`${inputClass} resize-none`}
                  />
                  <span className="mt-1 block text-right text-[11px] text-slate-400">{deskripsi.length}/300</span>
                </label>
              </div>
              {formError && <p className="mt-4 text-sm font-medium text-red-600">{formError}</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleEditSubmit} className="max-h-[90vh] overflow-y-auto p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Edit Layanan</h2>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Layanan</span>
                <input
                  required
                  autoFocus={!editing.fallback}
                  disabled={editing.fallback}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                  className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500`}
                />
                {editing.fallback && (
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    Nama layanan default tidak bisa diganti, tetapi deskripsinya bisa diubah.
                  </span>
                )}
                {!editing.fallback && editing.jumlahOrder > 0 && (
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    {editing.jumlahOrder} order yang memakai layanan ini ikut diperbarui ke nama baru.
                  </span>
                )}
              </label>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Deskripsi (opsional)</span>
                <textarea
                  value={editDeskripsi}
                  onChange={(e) => setEditDeskripsi(e.target.value)}
                  placeholder="Penjelasan singkat layanan ini"
                  rows={3}
                  maxLength={300}
                  autoFocus={editing.fallback}
                  className={`${inputClass} resize-none`}
                />
                <span className="mt-1 block text-right text-[11px] text-slate-400">{editDeskripsi.length}/300</span>
              </label>
              {editError && <p className="mt-4 text-sm font-medium text-red-600">{editError}</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
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
