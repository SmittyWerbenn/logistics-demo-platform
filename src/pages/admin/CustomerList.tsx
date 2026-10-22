import { DeactivateModal } from "../../components/DeactivateModal";
import { ACTION_ROW, actionClass } from "../../components/ActionButton";
import { Ban, Building2, Pencil, RotateCcw, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Pagination } from "../../components/Pagination";
import { useDebounced, usePagedList } from "../../utils/usePagedList";
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
import { DeleteButton } from "../../components/DeleteButton";
import { useAuth } from "../../store/AuthContext";
import { api, ApiError } from "../../utils/apiClient";
import { formatTanggalPanjang, isoToWib } from "../../utils/format";

interface CustomerAccount {
  id: string;
  nama: string;
  email: string;
  aktif: boolean;
  createdAt: string;
}

interface CustomerRow {
  customerId: string;
  nama: string | null;
  kota: string | null;
  kontrakNoPelanggan: string | null;
  aktif: boolean;
  shipmentCount: number;
  accounts: CustomerAccount[];
}

type StatusFilter = "semua" | "aktif" | "nonaktif";

function formatCreatedAt(iso: string): string {
  return formatTanggalPanjang(isoToWib(iso).tanggal);
}

export default function CustomerList() {
  // Only Superadmin may change "Kontrak Kerja Sama / No. Pelanggan" - the
  // server refuses it for anyone else too, this just keeps the form honest.
  const { profile } = useAuth();
  const canEditKontrak = profile?.role === "Superadmin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [kotaFilter, setKotaFilter] = useState("");
  // Search / Status / Kota are applied by the API (filter -> sort -> page); only the visible page is loaded.
  const debouncedSearch = useDebounced(search.trim());
  const list = usePagedList<CustomerRow>("/api/customers", {
    q: debouncedSearch,
    status: statusFilter === "semua" ? "" : statusFilter,
    kota: kotaFilter,
  });
  const customers = list.items;
  const isLoading = list.loading;
  const [kotaOptions, setKotaOptions] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setError] = useState<string | null>(null);
  const error = actionError ?? list.error;
  const [modalOpen, setModalOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newNama, setNewNama] = useState("");
  const [newKota, setNewKota] = useState("");
  const [newKontrak, setNewKontrak] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Edit modal: the Client ID is fixed, only name/city change.
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editKota, setEditKota] = useState("");
  const [editKontrak, setEditKontrak] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function openEdit(c: CustomerRow) {
    setEditing(c);
    setEditNama(c.nama ?? "");
    setEditKota(c.kota ?? "");
    setEditKontrak(c.kontrakNoPelanggan ?? "");
    setEditError(null);
  }

  async function handleEditClient(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const nama = editNama.trim();
    if (!nama) {
      setEditError("Nama Client wajib diisi.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await api.patch(`/api/customers/${encodeURIComponent(editing.customerId)}`, {
        nama,
        kota: editKota.trim(),
        ...(canEditKontrak ? { kontrakNoPelanggan: editKontrak.trim() } : {}),
      });
      setEditing(null);
      setNotice(`Data Client ${editing.customerId} berhasil diperbarui.`);
      await fetchCustomers();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Gagal memperbarui client.");
    } finally {
      setSaving(false);
    }
  }

  const [deactTarget, setDeactTarget] = useState<CustomerRow | null>(null);
  async function handleToggleActive(c: CustomerRow) {
    const next = !c.aktif;
    // Nonaktifkan always goes through the confirmation modal (API is only called from its confirm button).
    if (!next) { setDeactTarget(c); return; }
    if (!window.confirm(`Aktifkan kembali Client ${c.customerId}? Semua akun user Client ini bisa login lagi.`)) return;
    setTogglingId(c.customerId);
    setError(null);
    try {
      await api.patch(`/api/customers/${encodeURIComponent(c.customerId)}`, { aktif: next });
      setNotice(`Client ${c.customerId} ${next ? "diaktifkan" : "dinonaktifkan"}.`);
      await fetchCustomers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah status client.");
    } finally {
      setTogglingId(null);
    }
  }

  function openModal() {
    setNewId("");
    setNewNama("");
    setNewKota("");
    setNewKontrak("");
    setFormError(null);
    setModalOpen(true);
  }

  async function handleAddClient(e: FormEvent) {
    e.preventDefault();
    const customerId = newId.trim().toUpperCase();
    const nama = newNama.trim();
    if (!customerId || !nama) {
      setFormError("Client ID dan Nama Client wajib diisi.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/api/customers", {
        customerId,
        nama,
        kota: newKota.trim(),
        // Omitted for non-Superadmin: the field is theirs to read only.
        ...(canEditKontrak ? { kontrakNoPelanggan: newKontrak.trim() } : {}),
      });
      setModalOpen(false);
      setNotice(`Client ${customerId} berhasil ditambahkan. Sekarang bisa dipilih di User Admin > Tambah User.`);
      await fetchCustomers();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menambahkan client.");
    } finally {
      setSaving(false);
    }
  }

  function fetchCustomers() {
    setError(null);
    api.get<{ items: string[] }>("/api/customers/kota").then((r) => setKotaOptions(r.items)).catch(() => {});
    return list.reload();
  }

  useEffect(() => {
    api.get<{ items: string[] }>("/api/customers/kota").then((r) => setKotaOptions(r.items)).catch(() => {});
  }, []);

  const hasFilter = search.trim() !== "" || statusFilter !== "semua" || kotaFilter !== "";
  function resetFilters() {
    setSearch("");
    setStatusFilter("semua");
    setKotaFilter("");
  }
  const filtered = customers;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetchCustomers();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <AdminLayout>
      {deactTarget && (
        <DeactivateModal
          entityLabel="Client"
          details={[["Client ID", deactTarget.customerId], ["Nama", deactTarget.nama ?? "-"], ["Status", "Aktif"]]}
          note="Semua akun user Client ini akan dibekukan dan tidak bisa login."
          onClose={() => setDeactTarget(null)}
          onConfirm={async () => {
            await api.patch(`/api/customers/${encodeURIComponent(deactTarget.customerId)}`, { aktif: false });
            setNotice(`Client ${deactTarget.customerId} dinonaktifkan.`);
            await fetchCustomers();
          }}
        />
      )}
      <MasterDataHeader
        title="Clients"
        description="Daftar Client beserta akun yang tertaut dan jumlah pengiriman. Client baru ditambahkan di sini terlebih dahulu, lalu dipilih saat membuat user di User Admin."
      />

      <MasterDataToolbar onRefresh={handleRefresh} refreshing={refreshing} addLabel="Tambah Client" onAdd={openModal}>
        <MasterSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari Client ID, nama, kota, kontrak, atau akun..."
        />
        <MasterFilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} label="Filter status client">
          <option value="semua">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </MasterFilterSelect>
        <MasterFilterSelect value={kotaFilter} onChange={setKotaFilter} label="Filter kota">
          <option value="">Semua Kota</option>
          {kotaOptions.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </MasterFilterSelect>
        <MasterFilterReset visible={hasFilter} onReset={resetFilters} />
      </MasterDataToolbar>

      {notice && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-emerald-600 hover:text-emerald-900" title="Tutup">
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      )}

      <MasterTableCard minWidth={1080}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3 font-medium">Client ID</th>
            <th className="px-3 py-3 font-medium">Nama Client</th>
            <th className="px-3 py-3 font-medium">Kota</th>
            <th className="px-3 py-3 font-medium">Kontrak Kerja Sama / No. Pelanggan</th>
            <th className="px-3 py-3 font-medium">Status Client</th>
            <th className="px-3 py-3 font-medium">Nama Akun</th>
            <th className="px-3 py-3 font-medium">Email</th>
            <th className="px-3 py-3 font-medium">Status Akun</th>
            <th className="px-3 py-3 font-medium">Dibuat</th>
            <th className="px-3 py-3 font-medium">Jumlah Pengiriman</th>
            <th className="sticky right-0 z-10 bg-slate-50 px-5 py-3 font-medium shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.12)]">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.length === 0 && (
            <MasterTableMessage
              colSpan={11}
              loading={isLoading}
              loadingText="Memuat data Client..."
              icon={Building2}
              title={hasFilter ? "Tidak ada data." : "Belum ada data Client."}
              description={!hasFilter ? 'Klik "Tambah Client" untuk membuat Client ID pertama.' : undefined}
              action={!hasFilter ? <MasterEmptyAction label="Tambah Client" onClick={openModal} /> : undefined}
            />
          )}
          {filtered.map((c) => {
            const rows = c.accounts.length > 0 ? c.accounts : [null];
            return rows.map((a, i) => (
              <tr key={a ? a.id : `client-${c.customerId}`} className="group hover:bg-slate-50">
                {i === 0 && (
                  <>
                    <td rowSpan={rows.length} className="whitespace-nowrap border-r border-slate-100 px-3 py-3 align-top">
                      <span className="flex items-center gap-1.5 font-mono font-semibold text-slate-900">
                        <Building2 size={14} className="text-teal-600" />
                        {c.customerId}
                      </span>
                    </td>
                    <td rowSpan={rows.length} className="px-3 py-3 align-top text-slate-800">
                      {c.nama ?? "-"}
                    </td>
                    <td rowSpan={rows.length} className="px-3 py-3 align-top text-slate-800">
                      {c.kota ?? "-"}
                    </td>
                    <td rowSpan={rows.length} className="px-3 py-3 align-top">
                      <span className={c.kontrakNoPelanggan ? "font-mono text-slate-800" : "text-slate-400"}>
                        {c.kontrakNoPelanggan ?? "-"}
                      </span>
                    </td>
                    <td rowSpan={rows.length} className="whitespace-nowrap px-3 py-3 align-top">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          c.aktif ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {c.aktif ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                  </>
                )}
                {a ? (
                  <>
                    <td className="px-3 py-3 text-slate-800">{a.nama}</td>
                    <td className="px-3 py-3 text-slate-600 [overflow-wrap:anywhere]">{a.email}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          a.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {a.aktif ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatCreatedAt(a.createdAt)}</td>
                  </>
                ) : (
                  <td colSpan={4} className="px-3 py-3 text-xs italic text-slate-400">
                    Belum ada akun user untuk client ini.
                  </td>
                )}
                {i === 0 && (
                  <td rowSpan={rows.length} className="whitespace-nowrap px-3 py-3 align-top text-slate-600">
                    {c.shipmentCount}
                  </td>
                )}
                {i === 0 && (
                  <td
                    rowSpan={rows.length}
                    className="sticky right-0 z-10 whitespace-nowrap bg-white px-5 py-3 align-top shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.12)] group-hover:bg-slate-50"
                  >
                    <div className={ACTION_ROW}>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        title="Edit"
                        aria-label="Edit"
                        className={actionClass("edit")}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        disabled={togglingId === c.customerId}
                        title={c.aktif ? "Nonaktifkan" : "Aktifkan"}
                        aria-label={c.aktif ? "Nonaktifkan" : "Aktifkan"}
                        className={actionClass(c.aktif ? "danger" : "success")}
                      >
                        {c.aktif ? <Ban size={16} /> : <RotateCcw size={16} />}
                      </button>
                      <DeleteButton
                        entityType="client"
                        id={c.customerId}
                        details={[["Client ID", c.customerId], ["Nama", c.nama ?? "-"], ["User", `${c.accounts.length} akun`]]}
                        onDone={handleRefresh}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </MasterTableCard>
      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="client" />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleEditClient} className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Edit Client</h2>
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
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Client ID</span>
                  <input
                    value={editing.customerId}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-500"
                  />
                  <span className="mt-1.5 block text-[11px] text-slate-400">Client ID tidak bisa diubah.</span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Client</span>
                  <input
                    required
                    autoFocus
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Kota</span>
                  <input
                    value={editKota}
                    onChange={(e) => setEditKota(e.target.value)}
                    placeholder="Contoh: Jakarta Barat"
                    maxLength={100}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    Kontrak Kerja Sama / No. Pelanggan
                  </span>
                  <input
                    value={editKontrak}
                    onChange={(e) => setEditKontrak(e.target.value)}
                    disabled={!canEditKontrak}
                    placeholder="Contoh: CTR/TATA/2026/001"
                    maxLength={100}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${
                      canEditKontrak
                        ? "border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  />
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    {canEditKontrak
                      ? "Boleh nomor kontrak kerja sama atau nomor pelanggan. Opsional."
                      : "Hanya Superadmin yang dapat mengubah field ini."}
                  </span>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleAddClient} className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Tambah Client</h2>
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
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Client ID</span>
                  <input
                    required
                    autoFocus
                    value={newId}
                    onChange={(e) => setNewId(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                    placeholder="Contoh: IDCLIENT001"
                    autoComplete="off"
                    maxLength={50}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    Nomor pelanggan unik. Tidak bisa diubah setelah dibuat.
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Client</span>
                  <input
                    required
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    placeholder="Contoh: PT Megah Jaya"
                    maxLength={100}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Kota</span>
                  <input
                    value={newKota}
                    onChange={(e) => setNewKota(e.target.value)}
                    placeholder="Contoh: Jakarta Barat"
                    maxLength={100}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                {canEditKontrak && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">
                      Kontrak Kerja Sama / No. Pelanggan
                    </span>
                    <input
                      value={newKontrak}
                      onChange={(e) => setNewKontrak(e.target.value)}
                      placeholder="Contoh: CTR/TATA/2026/001"
                      maxLength={100}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="mt-1.5 block text-[11px] text-slate-400">
                      Boleh nomor kontrak kerja sama atau nomor pelanggan. Opsional.
                    </span>
                  </label>
                )}
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
    </AdminLayout>
  );
}
