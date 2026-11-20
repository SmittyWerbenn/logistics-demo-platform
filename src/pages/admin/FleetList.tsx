import { DeactivateModal } from "../../components/DeactivateModal";
import { ACTION_ROW, actionClass } from "../../components/ActionButton";
import { adminPath } from "../../utils/urls";
import { AlertTriangle, Ban, CheckCircle2, History, Pencil, Plus, RotateCcw, Table, Truck, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArmadaStatusBadge } from "../../components/ArmadaStatusBadge";
import { BulkFleetImport } from "../../components/BulkFleetImport";
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
import { useAuth } from "../../store/AuthContext";
import { toTruckWithDriver, useFleet, type TruckFormData, type TruckRow, type TruckWithDriver } from "../../store/FleetContext";
import { Pagination } from "../../components/Pagination";
import { api } from "../../utils/apiClient";
import { useDebounced, usePagedList } from "../../utils/usePagedList";
import type { ArmadaStatus } from "../../types";
import { ApiError } from "../../utils/apiClient";
import { ARMADA_STATUS_OPTIONS } from "../../utils/status";
import { DeleteButton } from "../../components/DeleteButton";
import { ReasonModal } from "../../components/ReasonModal";
import { useToast } from "../../components/Toast";

function isArmadaStatus(value: string): value is ArmadaStatus {
  return (ARMADA_STATUS_OPTIONS as string[]).includes(value);
}

const TRUCK_TYPES = ["Wingbox", "CDD", "Box", "Pickup", "Fuso", "Tronton"];

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

const emptyForm: TruckFormData = {
  nomorUnit: "",
  jenis: "Wingbox",
  kapasitas: "",
  driverNama: "",
  driverTelepon: "",
  status: "Available",
  keterangan: "",
};

export default function FleetList() {
  const { trucksWithDriver, refresh, createTruck, updateTruck, setTruckStatus } = useFleet();
  const { profile } = useAuth();
  const canEdit = profile?.role === "Superadmin" || profile?.role === "Admin";
  const isClientSide = profile?.role === "Client" || profile?.role === "Viewer";
  const toast = useToast();

  // Armada Dedicated: staff assign a unit to one Client; the API enforces everything (exclusive, audit).
  const [clients, setClients] = useState<{ customerId: string; nama: string | null }[]>([]);
  useEffect(() => {
    if (!canEdit) return;
    api.get<{ clients: { customerId: string; nama: string | null }[] }>("/api/customer-ids").then((r) => setClients(r.clients)).catch(() => {});
  }, [canEdit]);
  const [dedicatedFilter, setDedicatedFilter] = useState("");
  const [deactTruck, setDeactTruck] = useState<TruckWithDriver | null>(null);
  const [assignTarget, setAssignTarget] = useState<TruckWithDriver | null>(null);
  const [assignClient, setAssignClient] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<TruckWithDriver | null>(null);
  async function submitAssign() {
    if (!assignTarget || !assignClient) {
      setAssignError("Pilih Client terlebih dahulu.");
      return;
    }
    setAssignBusy(true);
    setAssignError(null);
    try {
      await api.post(`/api/trucks/${assignTarget.id}/assign`, { customerId: assignClient, alasan: assignNote.trim() || undefined });
      toast(`Armada ${assignTarget.nomorUnit} didedikasikan untuk Client.`);
      setAssignTarget(null);
      setAssignClient("");
      setAssignNote("");
      void list.reload();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Gagal menyimpan assignment.");
    } finally {
      setAssignBusy(false);
    }
  }

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), list.reload()]);
    } finally {
      setRefreshing(false);
    }
  }

  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [form, setForm] = useState<TruckFormData>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  function closeInput() {
    setExpanded(false);
    setMode("single");
    setForm(emptyForm);
    setCreateError(null);
  }

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TruckFormData>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);

  const existingNomorUnit = useMemo(
    () => trucksWithDriver.map((t) => t.nomorUnit.replace(/\s+/g, "").toLowerCase()),
    [trucksWithDriver],
  );
  // Suggestions merge the original preset types with whatever jenis values
  // are already in use, so a custom type someone typed once shows up as a
  // suggestion for everyone after that instead of only the fixed preset.
  const jenisSuggestions = useMemo(
    () => Array.from(new Set([...TRUCK_TYPES, ...trucksWithDriver.map((t) => t.jenis)])).sort(),
    [trucksWithDriver],
  );
  const isDuplicateNomorUnit =
    form.nomorUnit.trim() !== "" && existingNomorUnit.includes(form.nomorUnit.replace(/\s+/g, "").toLowerCase());

  const statusParam = searchParams.get("status") ?? "";
  const statusFilter: ArmadaStatus | "Semua" = isArmadaStatus(statusParam) ? statusParam : "Semua";

  function handleStatusFilterChange(value: ArmadaStatus | "Semua") {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "Semua") {
        next.delete("status");
      } else {
        next.set("status", value);
      }
      return next;
    });
  }

  const [search, setSearch] = useState("");
  const [jenisFilter, setJenisFilter] = useState("");
  const [usedJenis, setUsedJenis] = useState<string[]>([]);
  useEffect(() => {
    api.get<{ jenis: string[] }>("/api/trucks/facets").then((r) => setUsedJenis(r.jenis)).catch(() => {});
  }, []);
  const hasFilter = search.trim() !== "" || jenisFilter !== "" || statusFilter !== "Semua" || dedicatedFilter !== "";
  function resetFilters() {
    setSearch("");
    setJenisFilter("");
    setDedicatedFilter("");
    handleStatusFilterChange("Semua");
  }

  // Search / Status / Jenis go to the API (filter -> sort -> LIMIT/OFFSET); only the visible page is loaded.
  const debouncedSearch = useDebounced(search.trim());
  const list = usePagedList<TruckRow, TruckWithDriver>(
    "/api/trucks",
    { q: debouncedSearch, jenis: jenisFilter, status: statusFilter === "Semua" ? "" : statusFilter, dedicated: dedicatedFilter },
    toTruckWithDriver,
  );
  const filteredTrucks = list.items;

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (isDuplicateNomorUnit) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createTruck(form);
      void list.reload();
      setForm(emptyForm);
      setCreated(true);
      setTimeout(() => setCreated(false), 2000);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Gagal menyimpan unit truck. Coba lagi.");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(t: TruckWithDriver) {
    setEditingId(t.id);
    setEditForm({
      nomorUnit: t.nomorUnit,
      jenis: t.jenis,
      kapasitas: t.kapasitas,
      driverNama: t.driver?.nama ?? "",
      driverTelepon: t.driver?.telepon ?? "",
      status: t.status,
      keterangan: t.keterangan ?? "",
    });
    setEditError(null);
    setEditModalOpen(true);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    try {
      await updateTruck(editingId, editForm);
      void list.reload();
      setEditModalOpen(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan. Coba lagi.");
    }
  }

  return (
    <AdminLayout>
      <datalist id="jenis-truck-suggestions">
        {jenisSuggestions.map((j) => (
          <option key={j} value={j} />
        ))}
      </datalist>
      <MasterDataHeader
        title={isClientSide ? "Master Armada Dedicated" : "Master Armada"}
        description={
          !expanded
            ? isClientSide
              ? "Armada yang ditugaskan khusus untuk Anda oleh GMS."
              : "Kelola data unit truck dan driver."
            : mode === "single"
              ? "Tambah satu unit truck ke master armada."
              : "Tambah banyak unit truck sekaligus dengan mengisi tabel atau mengimpor file Excel/CSV."
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
                Input 1 Truck
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
          <BulkFleetImport existingNomorUnit={existingNomorUnit} />
        </div>
      )}

      {canEdit && expanded && mode === "single" && (
        <form
          onSubmit={handleCreateSubmit}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Nomor Unit / Polisi</span>
              <input
                required
                className={`${inputClass} ${isDuplicateNomorUnit ? "border-amber-400 focus:border-amber-500 focus:ring-amber-100" : ""}`}
                placeholder="B 9123 XYZ"
                value={form.nomorUnit}
                onChange={(e) => setForm({ ...form, nomorUnit: e.target.value })}
              />
              {isDuplicateNomorUnit && (
                <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertTriangle size={13} /> "{form.nomorUnit.trim()}" sudah ada di master data, tidak bisa dobel.
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Jenis Truck</span>
              <input
                required
                list="jenis-truck-suggestions"
                className={inputClass}
                placeholder="Contoh: Wingbox"
                value={form.jenis}
                onChange={(e) => setForm({ ...form, jenis: e.target.value })}
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Kapasitas</span>
              <input
                required
                className={inputClass}
                placeholder="8 Ton"
                value={form.kapasitas}
                onChange={(e) => setForm({ ...form, kapasitas: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Status Armada</span>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TruckFormData["status"] })}
              >
                {ARMADA_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Driver</span>
              <input
                required
                className={inputClass}
                placeholder="Nama driver"
                value={form.driverNama}
                onChange={(e) => setForm({ ...form, driverNama: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">No. HP Driver</span>
              <input
                required
                className={inputClass}
                placeholder="0812-0000-0000"
                value={form.driverTelepon}
                onChange={(e) => setForm({ ...form, driverTelepon: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Keterangan</span>
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Opsional"
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              />
            </label>
          </div>

          {createError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              <AlertTriangle size={15} /> {createError}
            </div>
          )}
          {created && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} /> Unit truck berhasil ditambahkan.
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={creating || isDuplicateNomorUnit}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
            >
              <Plus size={15} /> Simpan Truck
            </button>
          </div>
        </form>
      )}

      {!expanded && (
      <>
      <MasterDataToolbar
        onRefresh={handleRefresh}
        refreshing={refreshing}
        addLabel="Tambah Truck"
        onAdd={canEdit ? () => setExpanded(true) : undefined}
      >
        <MasterSearchInput value={search} onChange={setSearch} placeholder="Cari nomor unit, jenis, atau driver..." />
        <MasterFilterSelect
          value={statusFilter}
          onChange={(v) => handleStatusFilterChange(v as ArmadaStatus | "Semua")}
          label="Filter status"
        >
          <option value="Semua">Semua Status</option>
          {ARMADA_STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </MasterFilterSelect>
        <MasterFilterSelect value={jenisFilter} onChange={setJenisFilter} label="Filter jenis">
          <option value="">Semua Jenis</option>
          {usedJenis.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </MasterFilterSelect>
        {canEdit && (
          <MasterFilterSelect value={dedicatedFilter} onChange={setDedicatedFilter} label="Filter dedicated">
            <option value="">Semua Dedicated</option>
            <option value="assigned">Sudah Assigned</option>
            <option value="unassigned">Belum Assigned</option>
            {clients.map((c) => (
              <option key={c.customerId} value={c.customerId}>
                {c.nama ?? c.customerId} ({c.customerId})
              </option>
            ))}
          </MasterFilterSelect>
        )}
        <MasterFilterReset visible={hasFilter} onReset={resetFilters} />
      </MasterDataToolbar>

      <MasterTableCard minWidth={960}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Nomor Unit</th>
            <th className="px-4 py-3 font-medium">Jenis</th>
            <th className="px-4 py-3 font-medium">Kapasitas</th>
            <th className="px-4 py-3 font-medium">Driver</th>
            <th className="px-4 py-3 font-medium">No. HP Driver</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {canEdit && <th className="px-4 py-3 font-medium">Dedicated To</th>}
            <th className="px-4 py-3 font-medium">Keterangan</th>
            <th className="px-4 py-3 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
              {filteredTrucks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-slate-900">
                    {t.nomorUnit}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.jenis}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.kapasitas}</td>
                  <td className="px-4 py-3 text-slate-600">{t.driver?.nama ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.driver?.telepon ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <ArmadaStatusBadge status={t.status} size="sm" />
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {t.dedicatedCustomerId ? (
                        <span className="font-medium text-blue-900">{t.dedicatedCustomerNama ?? t.dedicatedCustomerId}</span>
                      ) : (
                        <span className="text-slate-400">Belum Assigned</span>
                      )}
                    </td>
                  )}
                  <td className="max-w-[220px] truncate px-4 py-3 text-xs text-slate-500" title={t.keterangan}>
                    {t.keterangan ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className={ACTION_ROW}>
                      <Link
                        to={adminPath(`/armada/${t.id}`)}
                        title="Riwayat Perjalanan"
                        className={actionClass("track")}
                      >
                        <History size={16} />
                      </Link>
                      {canEdit && (
                        <button
                          onClick={() => openEdit(t)}
                          title="Edit"
                          className={actionClass("edit")}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canEdit && !t.dedicatedCustomerId && (
                        <button
                          onClick={() => { setAssignTarget(t); setAssignClient(""); setAssignNote(""); setAssignError(null); }}
                          title="Assign ke Client (Dedicated)"
                          className={actionClass("view")}
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                      {canEdit && t.dedicatedCustomerId && (
                        <button
                          onClick={() => setUnassignTarget(t)}
                          title="Cabut Assignment"
                          className={actionClass("warn")}
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                      {canEdit && t.status !== "Inactive" && (
                        <button
                          onClick={() => setDeactTruck(t)}
                          title="Nonaktifkan"
                          className={actionClass("danger")}
                        >
                          <Ban size={16} />
                        </button>
                      )}
                      {canEdit && t.status === "Inactive" && (
                        <button
                          onClick={() => void setTruckStatus(t.id, "Available").then(list.reload)}
                          title="Aktifkan"
                          className={actionClass("success")}
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                      <DeleteButton
                        entityType="truck"
                        id={t.id}
                        details={[["Nomor Unit", t.nomorUnit], ["Jenis", t.jenis], ["Driver", t.driver?.nama ?? "-"]]}
                        onDone={() => { void refresh(); void list.reload(); }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
          {filteredTrucks.length === 0 && (
            <MasterTableMessage
              colSpan={canEdit ? 9 : 8}
              loading={list.loading}
              loadingText="Memuat data armada..."
              icon={Truck}
              title={
                hasFilter ? "Tidak ada data." : isClientSide ? "Belum ada armada dedicated untuk Anda. Hubungi GMS untuk penugasan armada." : "Belum ada data armada."
              }
              action={
                !hasFilter && canEdit ? (
                  <MasterEmptyAction label="Tambah Truck" onClick={() => setExpanded(true)} />
                ) : undefined
              }
            />
          )}
        </tbody>
      </MasterTableCard>
      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="armada" />
      </>
      )}

      {deactTruck && (
        <DeactivateModal
          entityLabel="armada"
          details={[["Nopol", deactTruck.nomorUnit], ["Jenis", deactTruck.jenis], ["Driver", deactTruck.driver?.nama ?? "-"], ["Status", deactTruck.status]]}
          note="Armada nonaktif tidak bisa dipilih untuk order baru. Riwayat order lama tidak berubah."
          onClose={() => setDeactTruck(null)}
          onConfirm={async () => {
            await setTruckStatus(deactTruck.id, "Inactive");
            await list.reload();
          }}
        />
      )}

      {assignTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Assign Armada Dedicated</h2>
            <p className="mt-2 text-sm text-slate-600">
              Armada <span className="font-mono font-semibold">{assignTarget.nomorUnit}</span> ({assignTarget.jenis}) akan menjadi armada dedicated satu Client dan hanya dapat dipakai Client tersebut.
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Client <span className="text-rose-600">*</span></span>
              <select className={inputClass} value={assignClient} onChange={(e) => setAssignClient(e.target.value)}>
                <option value="">Pilih Client</option>
                {clients.map((c) => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.nama ?? c.customerId} ({c.customerId})
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Keterangan (opsional)</span>
              <textarea rows={2} maxLength={500} className={inputClass} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="Contoh: Standby harian di gudang Client" />
            </label>
            {assignError && <p className="mt-3 text-sm font-medium text-red-600">{assignError}</p>}
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setAssignTarget(null)} disabled={assignBusy} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">Batal</button>
              <button type="button" onClick={() => void submitAssign()} disabled={assignBusy} className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">Simpan Assignment</button>
            </div>
          </div>
        </div>
      )}

      {unassignTarget && (
        <ReasonModal
          title="Cabut Armada Dedicated"
          reasonLabel="Alasan"
          placeholder="Contoh: Kontrak dedicated berakhir"
          confirmLabel="Cabut Assignment"
          tone="warning"
          onClose={() => setUnassignTarget(null)}
          onConfirm={async (reason) => {
            await api.post(`/api/trucks/${unassignTarget.id}/unassign`, { alasan: reason });
            toast("Assignment armada dicabut.");
            setUnassignTarget(null);
            void list.reload();
          }}
        >
          <p>Armada tidak akan lagi tersedia untuk Client ini. Order lama tetap menampilkan nomor polisinya.</p>
          <dl className="mt-1 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-xs text-slate-500">Armada</dt><dd className="font-mono font-medium text-slate-800">{unassignTarget.nomorUnit}</dd></div>
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-xs text-slate-500">Client</dt><dd className="font-medium text-slate-800">{unassignTarget.dedicatedCustomerNama ?? unassignTarget.dedicatedCustomerId}</dd></div>
          </dl>
        </ReasonModal>
      )}

      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleEditSubmit} className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Edit Truck</h2>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nomor Unit / Polisi</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="B 9123 XYZ"
                    value={editForm.nomorUnit}
                    onChange={(e) => setEditForm({ ...editForm, nomorUnit: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Jenis Truck</span>
                  <input
                    required
                    list="jenis-truck-suggestions"
                    className={inputClass}
                    placeholder="Contoh: Wingbox"
                    value={editForm.jenis}
                    onChange={(e) => setEditForm({ ...editForm, jenis: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Kapasitas</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="8 Ton"
                    value={editForm.kapasitas}
                    onChange={(e) => setEditForm({ ...editForm, kapasitas: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Status Armada</span>
                  <select
                    className={inputClass}
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TruckFormData["status"] })}
                  >
                    {ARMADA_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Driver</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="Nama driver"
                    value={editForm.driverNama}
                    onChange={(e) => setEditForm({ ...editForm, driverNama: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">No. HP Driver</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="0812-0000-0000"
                    value={editForm.driverTelepon}
                    onChange={(e) => setEditForm({ ...editForm, driverTelepon: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Keterangan</span>
                  <textarea
                    rows={2}
                    className={inputClass}
                    placeholder="Opsional"
                    value={editForm.keterangan}
                    onChange={(e) => setEditForm({ ...editForm, keterangan: e.target.value })}
                  />
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
                  className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
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
