import { DeactivateModal } from "../../components/DeactivateModal";
import { ACTION_ROW, actionClass } from "../../components/ActionButton";
import { Ban, Handshake, Pencil, RotateCcw, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AdminLayout } from "../../components/layout/AdminLayout";
import {
  MasterDataHeader,
  MasterDataToolbar,
  MasterEmptyAction,
  MasterFilterReset,
  MasterFilterSelect,
  MasterSearchInput,
  MasterTableCard,
  MasterTableMessage,
} from "../../components/master/MasterData";
import { useMitras, type Mitra, type MitraFormData } from "../../store/MitraContext";
import { ApiError } from "../../utils/apiClient";
import { DeleteButton } from "../../components/DeleteButton";
import { Pagination } from "../../components/Pagination";
import { useDebounced, usePagedList } from "../../utils/usePagedList";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

type StatusFilter = "semua" | "aktif" | "nonaktif";

const emptyForm: MitraFormData = { kodeMitra: "", nama: "", pic: "", telepon: "", email: "", alamat: "", area: "" };

export default function MitraList() {
  const { refresh: refreshLookup, createMitra, updateMitra, setMitraAktif } = useMitras();
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
  const list = usePagedList<Mitra>("/api/mitras", { q: debouncedSearch, status: statusFilter === "semua" ? "" : statusFilter });
  const filtered = list.items;
  const isLoading = list.loading;
  const refresh = async () => {
    await Promise.all([refreshLookup(), list.reload()]);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<MitraFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openAdd() {
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await createMitra({ ...form, kodeMitra: form.kodeMitra.trim().toUpperCase() });
      void list.reload();
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menambahkan Mitra. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const [editing, setEditing] = useState<Mitra | null>(null);
  const [editForm, setEditForm] = useState<MitraFormData>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(m: Mitra) {
    setEditing(m);
    setEditForm({
      kodeMitra: m.kodeMitra,
      nama: m.nama,
      pic: m.pic ?? "",
      telepon: m.telepon ?? "",
      email: m.email ?? "",
      alamat: m.alamat ?? "",
      area: m.area ?? "",
    });
    setEditError(null);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      const { kodeMitra: _kodeMitra, ...rest } = editForm;
      await updateMitra(editing.kodeMitra, rest);
      void list.reload();
      setEditing(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deactTarget, setDeactTarget] = useState<Mitra | null>(null);
  async function handleToggleActive(m: Mitra) {
    const next = !m.aktif;
    // Nonaktifkan always goes through the confirmation modal (API is only called from its confirm button).
    if (!next) { setDeactTarget(m); return; }
    if (!window.confirm(`Aktifkan kembali Mitra ${m.kodeMitra}? Akun user Mitra ini bisa login lagi.`)) return;
    setTogglingId(m.kodeMitra);
    try {
      await setMitraAktif(m.kodeMitra, next);
      void list.reload();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <AdminLayout>
      {deactTarget && (
        <DeactivateModal
          entityLabel="Mitra"
          details={[["Kode", deactTarget.kodeMitra], ["Nama", deactTarget.nama], ["Status", "Aktif"]]}
          note="Akun user Mitra ini akan dibekukan dan tidak bisa login."
          onClose={() => setDeactTarget(null)}
          onConfirm={async () => {
            await setMitraAktif(deactTarget.kodeMitra, false);
            void list.reload();
          }}
        />
      )}
      <MasterDataHeader
        title="Mitra"
        description="Data mitra agen pihak ketiga. Tambahkan Mitra di sini terlebih dahulu, lalu kaitkan dengan akun user (role Mitra) di User Admin, dan teruskan/assign paket ke Mitra dari Detail Paket."
      />

      <MasterDataToolbar onRefresh={handleRefresh} refreshing={refreshing} addLabel="Tambah Mitra" onAdd={openAdd}>
        <MasterSearchInput value={search} onChange={setSearch} placeholder="Cari kode, nama, PIC, atau area..." />
        <MasterFilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} label="Filter status">
          <option value="semua">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </MasterFilterSelect>
        <MasterFilterReset visible={hasFilter} onReset={resetFilters} />
      </MasterDataToolbar>

      <MasterTableCard minWidth={960}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Kode Mitra</th>
            <th className="px-4 py-3 font-medium">Nama Mitra</th>
            <th className="px-4 py-3 font-medium">PIC</th>
            <th className="px-4 py-3 font-medium">No. HP</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Area/Coverage</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.length === 0 && (
            <MasterTableMessage
              colSpan={8}
              loading={isLoading && filtered.length === 0}
              loadingText="Memuat data Mitra..."
              icon={Handshake}
              title={hasFilter ? "Tidak ada data." : "Belum ada data Mitra."}
              action={!hasFilter ? <MasterEmptyAction label="Tambah Mitra" onClick={openAdd} /> : undefined}
            />
          )}
          {filtered.map((m) => (
            <tr key={m.kodeMitra} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3">
                <span className="flex items-center gap-1.5 font-mono font-semibold text-slate-900">
                  <Handshake size={14} className="text-teal-600" />
                  {m.kodeMitra}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-800">{m.nama}</td>
              <td className="px-4 py-3 text-slate-600">{m.pic ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600">{m.telepon ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600">{m.email ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600">{m.area ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    m.aktif ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {m.aktif ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className={ACTION_ROW}>
                  <button
                    onClick={() => openEdit(m)}
                    title="Edit"
                    className={actionClass("edit")}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(m)}
                    disabled={togglingId === m.kodeMitra}
                    title={m.aktif ? "Nonaktifkan" : "Aktifkan"}
                    className={actionClass(m.aktif ? "danger" : "success")}
                  >
                    {m.aktif ? <Ban size={16} /> : <RotateCcw size={16} />}
                  </button>
                  <DeleteButton
                    entityType="mitra"
                    id={m.kodeMitra}
                    details={[["Nama", m.nama], ["Kode", m.kodeMitra]]}
                    onDone={refresh}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </MasterTableCard>
      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="mitra" />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleAddSubmit} className="max-h-[90vh] overflow-y-auto p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Tambah Mitra</h2>
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
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Kode Mitra</span>
                  <input
                    required
                    autoFocus
                    value={form.kodeMitra}
                    onChange={(e) => setForm({ ...form, kodeMitra: e.target.value.toUpperCase().replace(/\s+/g, "") })}
                    placeholder="Contoh: MITRA-JKT-001"
                    autoComplete="off"
                    maxLength={50}
                    className={`${inputClass} font-mono`}
                  />
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    Kode unik Mitra. Tidak bisa diubah setelah dibuat.
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Mitra</span>
                  <input
                    required
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    placeholder="Contoh: Mitra Agen Doring Jakarta"
                    maxLength={100}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">PIC</span>
                  <input
                    value={form.pic}
                    onChange={(e) => setForm({ ...form, pic: e.target.value })}
                    placeholder="Nama penanggung jawab"
                    maxLength={100}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">No. HP</span>
                  <input
                    value={form.telepon}
                    onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    maxLength={30}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="mitra@contoh.com"
                    maxLength={150}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Alamat</span>
                  <input
                    value={form.alamat}
                    onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                    maxLength={300}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Area/Coverage</span>
                  <input
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="Contoh: Jakarta & sekitarnya"
                    maxLength={150}
                    className={inputClass}
                  />
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
                <h2 className="text-lg font-semibold text-slate-900">Edit Mitra</h2>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Kode Mitra</span>
                  <input
                    value={editForm.kodeMitra}
                    disabled
                    className={`${inputClass} bg-slate-50 font-mono text-slate-500`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Mitra</span>
                  <input
                    required
                    value={editForm.nama}
                    onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                    maxLength={100}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">PIC</span>
                  <input
                    value={editForm.pic}
                    onChange={(e) => setEditForm({ ...editForm, pic: e.target.value })}
                    maxLength={100}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">No. HP</span>
                  <input
                    value={editForm.telepon}
                    onChange={(e) => setEditForm({ ...editForm, telepon: e.target.value })}
                    maxLength={30}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Email</span>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    maxLength={150}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Alamat</span>
                  <input
                    value={editForm.alamat}
                    onChange={(e) => setEditForm({ ...editForm, alamat: e.target.value })}
                    maxLength={300}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Area/Coverage</span>
                  <input
                    value={editForm.area}
                    onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                    maxLength={150}
                    className={inputClass}
                  />
                </label>
              </div>
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
