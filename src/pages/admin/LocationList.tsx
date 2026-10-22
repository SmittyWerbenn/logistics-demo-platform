import { DeactivateModal } from "../../components/DeactivateModal";
import { ACTION_ROW, actionClass } from "../../components/ActionButton";
import { AlertTriangle, Ban, CheckCircle2, Download, MapPinned, Pencil, RotateCcw, Table, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BulkLocationImport } from "../../components/BulkLocationImport";
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
  MasterToolbarButton,
} from "../../components/master/MasterData";
import { useAuth } from "../../store/AuthContext";
import { toTitik, useLocations, type LocationRow, type TitikFormData } from "../../store/LocationContext";
import { Pagination } from "../../components/Pagination";
import { useDebounced, usePagedList } from "../../utils/usePagedList";
import { ApiError } from "../../utils/apiClient";
import type { TitikJenis, TitikLokasi } from "../../types";
import { exportLocationsXlsx } from "../../utils/locationImport";
import { DeleteButton } from "../../components/DeleteButton";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

type StatusFilter = "semua" | "aktif" | "nonaktif";

const JENIS_OPTIONS: TitikJenis[] = ["Gudang", "Hub", "Transit", "Cabang", "Tujuan"];

const emptyForm: TitikFormData = {
  namaKota: "",
  provinsi: "",
  kodeKota: "",
  namaArea: "",
  jenis: "Transit",
  aktif: true,
};

const JENIS_STYLE: Record<TitikJenis, string> = {
  Gudang: "bg-blue-100 text-blue-700",
  Hub: "bg-violet-100 text-violet-700",
  Transit: "bg-amber-100 text-amber-700",
  Cabang: "bg-teal-100 text-teal-700",
  Tujuan: "bg-emerald-100 text-emerald-700",
};

export default function LocationList() {
  const { createTitik, updateTitik, setTitikAktif } = useLocations();
  const { profile } = useAuth();
  const canEdit = profile?.role === "Superadmin" || profile?.role === "Admin";

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await list.reload();
    } finally {
      setRefreshing(false);
    }
  }

  const [search, setSearch] = useState("");
  const [jenisFilter, setJenisFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const hasFilter = search.trim() !== "" || jenisFilter !== "" || statusFilter !== "semua";
  function resetFilters() {
    setSearch("");
    setJenisFilter("");
    setStatusFilter("semua");
  }
  // Search / Jenis / Status are applied by the API (filter -> sort -> LIMIT/OFFSET); only the visible page is loaded.
  const debouncedSearch = useDebounced(search.trim());
  const list = usePagedList<LocationRow, TitikLokasi>(
    "/api/locations",
    { q: debouncedSearch, jenis: jenisFilter, status: statusFilter === "semua" ? "" : statusFilter },
    toTitik,
    { pageSizeKey: "locations", defaultPageSize: 10 },
  );
  const filtered = list.items;
  const isLoading = list.loading;
  const refresh = list.reload;

  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [form, setForm] = useState<TitikFormData>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function closeInput() {
    setExpanded(false);
    setMode("single");
    setForm(emptyForm);
    setCreateError(null);
  }

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TitikFormData>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);

  // Duplicate Nama Area (same Jenis Titik) is rejected by the API with a clear message.
  const createAreaOwner: string | null = null;
  const editAreaOwner: string | null = null;

  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    setExporting(true);
    try {
      await exportLocationsXlsx(await list.fetchAll());
    } finally {
      setExporting(false);
    }
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (createAreaOwner) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createTitik(form);
      void list.reload();
      setForm(emptyForm);
      setCreated(true);
      setTimeout(() => setCreated(false), 2000);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Gagal menyimpan titik lokasi. Coba lagi.");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(t: TitikLokasi) {
    setEditingId(t.id);
    setEditForm({
      namaKota: t.namaKota,
      provinsi: t.provinsi,
      kodeKota: t.kodeKota,
      namaArea: t.namaArea,
      jenis: t.jenis,
      aktif: t.aktif,
    });
    setEditError(null);
    setEditModalOpen(true);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || editAreaOwner) return;
    setEditError(null);
    try {
      await updateTitik(editingId, editForm);
      void list.reload();
      setEditModalOpen(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan. Coba lagi.");
    }
  }

  const [deactTarget, setDeactTarget] = useState<TitikLokasi | null>(null);

  return (
    <AdminLayout>
      {deactTarget && (
        <DeactivateModal
          entityLabel="titik/kota"
          details={[["Nama Area", deactTarget.namaArea], ["Kota", deactTarget.namaKota], ["Jenis", deactTarget.jenis], ["Status", "Aktif"]]}
          onClose={() => setDeactTarget(null)}
          onConfirm={async () => {
            await setTitikAktif(deactTarget.id, false);
            await list.reload();
          }}
        />
      )}
      <MasterDataHeader
        title="Kota & Titik Transit"
        description={
          !expanded
            ? "Master data lokasi yang digunakan pada pengiriman dan update tracking."
            : mode === "single"
              ? "Tambah satu titik lokasi (Provinsi, Kota / Kabupaten) ke master data."
              : "Tambah banyak titik lokasi sekaligus dengan mengisi tabel atau mengimpor file Excel/CSV."
        }
        actions={
          canEdit && expanded ? (
            <>
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === "single" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Plus size={13} />
                Input 1 Titik
              </button>
              <button
                type="button"
                onClick={() => setMode("bulk")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === "bulk" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Table size={13} />
                Bulk / Import Excel
              </button>
            </div>
            <button
              type="button"
              onClick={closeInput}
              title="Tutup"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <X size={16} />
            </button>
            </>
          ) : undefined
        }
      />

      {canEdit && expanded && mode === "bulk" && (
        <div className="mt-6">
          <BulkLocationImport onImported={() => void list.reload()} />
        </div>
      )}

      {canEdit && expanded && mode === "single" && (
        <form
          onSubmit={handleCreateSubmit}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Kode (opsional)</span>
              <input
                className={inputClass}
                placeholder="JKT"
                value={form.kodeKota}
                onChange={(e) => setForm({ ...form, kodeKota: e.target.value.toUpperCase() })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Area (opsional)</span>
              <input
                className={inputClass}
                placeholder="Contoh: Jakarta Timur Area 1"
                value={form.namaArea}
                onChange={(e) => setForm({ ...form, namaArea: e.target.value })}
              />
              {createAreaOwner && (
                <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertTriangle size={13} /> Nama Area ini dengan Jenis Titik {form.jenis} sudah ada (dipakai oleh {createAreaOwner}). Duplikat tidak diperbolehkan.
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Jenis Titik</span>
              <select
                className={inputClass}
                value={form.jenis}
                onChange={(e) => setForm({ ...form, jenis: e.target.value as TitikJenis })}
              >
                {JENIS_OPTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Provinsi (opsional)</span>
              <input
                className={inputClass}
                placeholder="DKI Jakarta"
                value={form.provinsi}
                onChange={(e) => setForm({ ...form, provinsi: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Kota / Kabupaten</span>
              <input
                required
                className={inputClass}
                placeholder="Jakarta Pusat"
                value={form.namaKota}
                onChange={(e) => setForm({ ...form, namaKota: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.aktif}
                onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Aktif (tampil di dropdown lokasi)</span>
            </label>
          </div>

          {createError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              <AlertTriangle size={15} /> {createError}
            </div>
          )}
          {created && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} /> Titik lokasi berhasil ditambahkan.
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={creating || !!createAreaOwner}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
            >
              <Plus size={15} /> Simpan Titik
            </button>
          </div>
        </form>
      )}

      {!expanded && (
        <>
          <MasterDataToolbar
            onRefresh={handleRefresh}
            refreshing={refreshing}
            addLabel="Tambah Titik"
            onAdd={canEdit ? () => setExpanded(true) : undefined}
            secondary={
              <MasterToolbarButton
                onClick={() => void handleExport()}
                icon={Download}
                label="Unduh Data"
                disabled={list.meta.total === 0}
                busy={exporting}
              />
            }
          >
            <MasterSearchInput value={search} onChange={setSearch} placeholder="Cari kode, provinsi, atau kota/kabupaten..." />
            <MasterFilterSelect value={jenisFilter} onChange={setJenisFilter} label="Filter jenis titik">
              <option value="">Semua Jenis</option>
              {JENIS_OPTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </MasterFilterSelect>
            <MasterFilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} label="Filter status">
              <option value="semua">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </MasterFilterSelect>
            <MasterFilterReset visible={hasFilter} onReset={resetFilters} />
          </MasterDataToolbar>


          {/* Equal-width columns so the spacing between them is even. */}
          <MasterTableCard minWidth={760} fixed>
            <colgroup>
              {Array.from({ length: canEdit ? 7 : 6 }, (_, i) => (
                <col key={i} className={canEdit ? "w-1/7" : "w-1/6"} />
              ))}
            </colgroup>
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Nama Area</th>
                <th className="px-4 py-3 font-medium">Jenis Titik</th>
                <th className="px-4 py-3 font-medium">Provinsi</th>
                <th className="px-4 py-3 font-medium">Kota / Kabupaten</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canEdit && <th className="px-4 py-3 font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <MasterTableMessage
                  colSpan={canEdit ? 7 : 6}
                  loading={isLoading && filtered.length === 0}
                  loadingText="Memuat data lokasi..."
                  icon={MapPinned}
                  title={
                    hasFilter
                      ? "Tidak ada data."
                      : "Belum ada data kota & titik transit"
                  }
                  description={
                    hasFilter
                      ? undefined
                      : canEdit
                        ? "Tambahkan kota atau titik transit terlebih dahulu. Data ini dipakai sebagai pilihan lokasi pada pembuatan pengiriman dan update tracking."
                        : "Data ini dikelola oleh Admin dan dipakai sebagai pilihan lokasi pada pengiriman dan update tracking."
                  }
                  action={
                    !hasFilter && canEdit ? (
                      <MasterEmptyAction label="Tambah Titik" onClick={() => setExpanded(true)} />
                    ) : undefined
                  }
                />
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-600">{t.kodeKota || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{t.namaArea || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${JENIS_STYLE[t.jenis]}`}>
                      {t.jenis}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.provinsi || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 font-medium text-slate-900">
                      <MapPinned size={14} className="shrink-0 text-slate-400" />
                      {t.namaKota}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        t.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className={ACTION_ROW}>
                        <button
                          onClick={() => openEdit(t)}
                          title="Edit"
                          className={actionClass("edit")}
                        >
                          <Pencil size={16} />
                        </button>
                        {t.aktif ? (
                          <button
                            onClick={() => setDeactTarget(t)}
                            title="Nonaktifkan"
                            className={actionClass("danger")}
                          >
                            <Ban size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => void setTitikAktif(t.id, true).then(list.reload)}
                            title="Aktifkan"
                            className={actionClass("success")}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        <DeleteButton
                          entityType="location"
                          id={t.id}
                          details={[["Nama Area", t.namaArea], ["Kota", t.namaKota], ["Jenis", t.jenis]]}
                          onDone={refresh}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </MasterTableCard>
          <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="titik" />
        </>
      )}

      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleEditSubmit} className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Edit Titik</h2>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Kode (opsional)</span>
                  <input
                    className={inputClass}
                    placeholder="JKT"
                    value={editForm.kodeKota}
                    onChange={(e) => setEditForm({ ...editForm, kodeKota: e.target.value.toUpperCase() })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Area (opsional)</span>
                  <input
                    className={inputClass}
                    placeholder="Contoh: Jakarta Timur Area 1"
                    value={editForm.namaArea}
                    onChange={(e) => setEditForm({ ...editForm, namaArea: e.target.value })}
                  />
                  {editAreaOwner && (
                    <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <AlertTriangle size={13} /> Nama Area ini dengan Jenis Titik {editForm.jenis} sudah ada (dipakai oleh {editAreaOwner}). Duplikat tidak diperbolehkan.
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Jenis Titik</span>
                  <select
                    className={inputClass}
                    value={editForm.jenis}
                    onChange={(e) => setEditForm({ ...editForm, jenis: e.target.value as TitikJenis })}
                  >
                    {JENIS_OPTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Provinsi (opsional)</span>
                  <input
                    className={inputClass}
                    placeholder="DKI Jakarta"
                    value={editForm.provinsi}
                    onChange={(e) => setEditForm({ ...editForm, provinsi: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Kota / Kabupaten</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="Jakarta Pusat"
                    value={editForm.namaKota}
                    onChange={(e) => setEditForm({ ...editForm, namaKota: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.aktif}
                    onChange={(e) => setEditForm({ ...editForm, aktif: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Aktif (tampil di dropdown lokasi)</span>
                </label>
              </div>

              {editError && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
                  <AlertTriangle size={15} /> {editError}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!!editAreaOwner}
                  className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
