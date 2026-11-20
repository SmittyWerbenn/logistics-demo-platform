import { DeactivateModal } from "../../components/DeactivateModal";
import { ACTION_ROW, actionClass } from "../../components/ActionButton";
import { Pagination } from "../../components/Pagination";
import { Camera, Download, Eye, Pencil, Plus, Power, Search, Shield, Upload, Users, X } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { RefreshButton } from "../../components/RefreshButton";
import {
  MasterDataHeader,
  MasterFilterSelect,
  MasterSearchInput,
  MasterTableCard,
  MasterTableMessage,
  MasterToolbarButton,
} from "../../components/master/MasterData";
import { useAuth } from "../../store/AuthContext";
import { useUserManagement, type UserFormData } from "../../store/UserManagementContext";
import { ASSIGNABLE_USER_ROLES, roleLabel, type AppUser, type UserRole } from "../../types";
import { checkPhotoSize, compressImage, MAX_PHOTO_SIZE_MB } from "../../utils/compressImage";
import { formatTimestampWib } from "../../utils/format";
import { initials } from "../../utils/initials";
import { ROLE_BADGE_CLASS } from "../../utils/roleTheme";
import { exportUsersXlsx } from "../../utils/userExport";
import { useFileUrl } from "../../utils/useFileUrl";
import { isEmailTaken, useUserList, type UserFilters, type UserGroup } from "../../utils/useUserList";
import { DeleteButton } from "../../components/DeleteButton";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

const EMAIL_TAKEN = "Email sudah digunakan oleh user lain.";

function emptyForm(defaultRole: UserRole): UserFormData {
  return {
    nama: "",
    email: "",
    role: defaultRole,
    fotoDataUrl: undefined,
    password: "",
    driverId: null,
    customerId: null,
    mitraId: null,
  };
}

function UserRowAvatar({ fileId, nama, size = "sm" }: { fileId?: string; nama: string; size?: "sm" | "lg" }) {
  const url = useFileUrl(fileId);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-600 ${
        size === "lg" ? "h-14 w-14 text-sm" : "h-8 w-8 text-xs"
      }`}
    >
      {url ? <img src={url} alt={nama} className="h-full w-full object-cover" /> : initials(nama)}
    </div>
  );
}

const ROLE_DESCRIPTION: Record<UserRole, string> = {
  Superadmin: "Akses penuh, termasuk mengelola user lain.",
  Admin: "Dapat membuat/mengubah data pengiriman, armada, lokasi, dan pengaturan.",
  Driver: "Hanya dapat membuka Update Tracking untuk melaporkan status/serah terima.",
  Viewer: "Hanya dapat melihat data (read-only), tidak bisa mengubah apa pun.",
  "Client":
    "Setara Viewer, ditambah bisa Buat Pengiriman. Hanya melihat data pengiriman dengan Client ID miliknya sendiri.",
  Mitra:
    "Setara Driver. Login lewat dashboard admin yang sama, hanya melihat dan meng-update paket yang sudah diteruskan ke Mitra miliknya sendiri.",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE_CLASS[role]}`}>
      <Shield size={12} />
      {roleLabel(role)}
    </span>
  );
}

function StatusBadge({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {aktif ? "Aktif" : "Nonaktif"}
    </span>
  );
}

const dateOrDash = (iso?: string) => (iso ? formatTimestampWib(iso) : "-");

/** Management User (every role except Driver) and Management User Driver share
 * this page; `group` picks which accounts it lists, filters, exports and creates. */
export default function UserManagementView({ group }: { group: UserGroup }) {
  const isDriverGroup = group === "driver";
  const { drivers, clientOptions, mitraOptions, refresh, createUser, updateUser, setUserActive } = useUserManagement();
  const list = useUserList(group);
  const { profile } = useAuth();
  // Admin may only add/edit non-Admin accounts - Admin-role accounts
  // (including their own) are Superadmin's to manage.
  const isAdminActor = profile?.role === "Admin";
  const assignableRoles = (isAdminActor ? ASSIGNABLE_USER_ROLES.filter((r) => r !== "Admin") : ASSIGNABLE_USER_ROLES).filter(
    (r) => (isDriverGroup ? r === "Driver" : r !== "Driver"),
  );
  const filterableRoles: UserRole[] = ["Superadmin", ...ASSIGNABLE_USER_ROLES.filter((r) => r !== "Driver")];

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), list.reload()]);
    } finally {
      setRefreshing(false);
    }
  }

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      // Everything that matches the applied filters, not just the current page.
      await exportUsersXlsx(await list.fetchAll(), group);
    } catch {
      setExportError("Gagal mengunduh data user. Coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  // ----- add / edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm(assignableRoles[0]));
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    void refresh();
    setEditingId(null);
    setForm(emptyForm(assignableRoles[0]));
    setPhotoError(null);
    setSubmitError(null);
    setEmailError(null);
    setModalOpen(true);
  }

  function openEdit(u: AppUser) {
    void refresh();
    setEditingId(u.id);
    const linkedDriver = drivers.find((d) => d.linkedUserId === u.id);
    setForm({
      nama: u.nama,
      email: u.email,
      role: u.role,
      fotoDataUrl: undefined,
      password: "",
      driverId: linkedDriver?.id ?? null,
      customerId: u.customerId ?? null,
      mitraId: u.mitraId ?? null,
    });
    setPhotoError(null);
    setSubmitError(null);
    setEmailError(null);
    setModalOpen(true);
  }

  // Drivers selectable for this account: not yet linked to anyone, or
  // already linked to the account being edited (so its current pick stays
  // in the list instead of disappearing). Listed by Nopol - the existing
  // truck master data - rather than a second copy of it.
  const selectableDrivers = drivers.filter((d) => !d.linkedUserId || d.linkedUserId === editingId);

  /** Frontend check (the API enforces the same rule). Editing keeps the
   * account's own email valid. Returns true when the email is free. */
  async function checkEmail(): Promise<boolean> {
    const email = form.email.trim();
    if (!email) return true;
    try {
      if (await isEmailTaken(email, editingId)) {
        setEmailError(EMAIL_TAKEN);
        return false;
      }
    } catch {
      // Can't verify right now - the API will still reject a duplicate.
    }
    setEmailError(null);
    return true;
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkPhotoSize(file);
    if (sizeError) {
      setPhotoError(sizeError);
      return;
    }
    setPhotoError(null);
    compressImage(file, 320, 0.8)
      .then((dataUrl) => setForm((f) => ({ ...f, fotoDataUrl: dataUrl })))
      .catch(() => setPhotoError("Gagal memproses foto. Coba foto lain."));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const needsClient = form.role === "Client" || (form.role === "Viewer" && !editingId);
    if (needsClient && !form.customerId?.trim()) {
      setSubmitError(`Client wajib dipilih untuk role ${form.role}.`);
      return;
    }
    if (form.role === "Mitra" && !form.mitraId?.trim()) {
      setSubmitError("Mitra wajib dipilih untuk role Mitra.");
      return;
    }
    setSaving(true);
    try {
      if (!(await checkEmail())) {
        setSubmitError(EMAIL_TAKEN);
        return;
      }
      const data: UserFormData = {
        nama: form.nama,
        email: form.email,
        role: form.role,
        fotoDataUrl: form.fotoDataUrl,
        driverId: form.role === "Driver" ? form.driverId ?? null : null,
        customerId: form.role === "Client" || form.role === "Viewer" ? form.customerId?.trim() || null : null,
        mitraId: form.role === "Mitra" ? form.mitraId?.trim() || null : null,
        ...(form.password ? { password: form.password } : {}),
      };
      if (editingId) {
        await updateUser(editingId, data);
      } else {
        await createUser(data);
      }
      setModalOpen(false);
      await list.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan user.";
      if (message === EMAIL_TAKEN) setEmailError(EMAIL_TAKEN);
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  }

  const [deactTarget, setDeactTarget] = useState<AppUser | null>(null);
  async function handleToggle(u: AppUser) {
    // Nonaktifkan always goes through the confirmation modal (API is only called from its confirm button).
    if (u.aktif) { setDeactTarget(u); return; }
    try {
      await setUserActive(u.id, !u.aktif);
      await list.reload();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Gagal mengubah status user.");
    }
  }

  // ----- detail
  const [detail, setDetail] = useState<AppUser | null>(null);

  const colCount = isDriverGroup ? 5 : 6;
  const { draft, setDraft } = list;
  const patchFilter = (patch: Partial<UserFilters>) => setDraft({ ...draft, ...patch });

  return (
    <AdminLayout>
      {deactTarget && (
        <DeactivateModal
          entityLabel={deactTarget.role === "Driver" ? "driver" : "user"}
          details={[
            ["Nama", deactTarget.nama],
            ["Email", deactTarget.email],
            ["Role", deactTarget.role],
            ...(deactTarget.nopol ? ([["Nopol", deactTarget.nopol]] as Array<[string, string]>) : []),
            ["Status", "Aktif"],
          ]}
          note="Akun ini tidak akan bisa login sampai diaktifkan kembali."
          onClose={() => setDeactTarget(null)}
          onConfirm={async () => {
            await setUserActive(deactTarget.id, false);
            await list.reload();
          }}
        />
      )}
      {/* Actions top-right; the (many) filters get their own full-width row. */}
      <MasterDataHeader
        title={isDriverGroup ? "User Driver" : "User Admin"}
        description={
          isDriverGroup
            ? "Kelola akun Driver beserta Nopol truck yang ditautkan. Akun non-Driver ada di menu User Admin."
            : `Kelola akun internal dan peran akses (GMS-Admin / Viewer / Client / Mitra). Akun Driver ada di menu User Driver.${
                isAdminActor ? " Sebagai GMS-Admin, Anda hanya dapat menambah/mengubah akun Viewer, Client, dan Mitra." : ""
              }`
        }
        actions={
          <>
            <MasterToolbarButton
              onClick={() => void handleExport()}
              icon={Download}
              label="Unduh Data User"
              disabled={list.meta.total === 0}
              busy={exporting}
            />
            <RefreshButton onClick={handleRefresh} refreshing={refreshing} className="h-10" />
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              <Plus size={16} /> {isDriverGroup ? "Tambah Driver" : "Tambah User"}
            </button>
          </>
        }
      />

      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          list.apply();
        }}
      >
        <MasterSearchInput value={draft.nama} onChange={(v) => patchFilter({ nama: v })} placeholder="Nama" />
        <MasterSearchInput value={draft.email} onChange={(v) => patchFilter({ email: v })} placeholder="Email" />
        {isDriverGroup && (
          <MasterSearchInput value={draft.nopol} onChange={(v) => patchFilter({ nopol: v })} placeholder="Nopol" />
        )}
        {!isDriverGroup && (
          <MasterFilterSelect value={draft.role} onChange={(v) => patchFilter({ role: v })} label="Filter role">
            <option value="">Semua Role</option>
            {filterableRoles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </MasterFilterSelect>
        )}
        <MasterFilterSelect
          value={draft.status}
          onChange={(v) => patchFilter({ status: v as UserFilters["status"] })}
          label="Filter status"
        >
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </MasterFilterSelect>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            <Search size={15} /> Cari
          </button>
          <button
            type="button"
            onClick={list.reset}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <X size={14} /> Reset
          </button>
        </div>
      </form>

      {(list.error || exportError) && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <span>{list.error ?? exportError}</span>
          {exportError && (
            <button type="button" onClick={() => setExportError(null)} className="shrink-0 text-red-500 hover:text-red-800" title="Tutup">
              <X size={15} />
            </button>
          )}
        </div>
      )}

      <MasterTableCard minWidth={isDriverGroup ? 720 : 800}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Nama</th>
            <th className="px-4 py-3 font-medium">Email</th>
            {isDriverGroup && <th className="px-4 py-3 font-medium">Nopol</th>}
            {!isDriverGroup && <th className="px-4 py-3 font-medium">Role</th>}
            <th className="px-4 py-3 font-medium">Status</th>
            {!isDriverGroup && <th className="px-4 py-3 font-medium">Last Login</th>}
            <th className="px-4 py-3 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.items.length === 0 && (
            <MasterTableMessage
              colSpan={colCount}
              loading={list.loading}
              loadingText="Memuat data user..."
              icon={Users}
              title={list.hasFilter ? "Tidak ada user yang cocok dengan filter." : isDriverGroup ? "Belum ada user Driver." : "Belum ada user."}
            />
          )}
          {list.items.map((u) => {
            const canManage = u.role !== "Superadmin" && !(isAdminActor && u.role === "Admin");
            return (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <UserRowAvatar fileId={u.foto} nama={u.nama} />
                    <span className="font-medium text-slate-900">{u.nama}</span>
                  </div>
                </td>
                <td className="break-all px-4 py-3 text-slate-600">{u.email}</td>
                {isDriverGroup && <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">{u.nopol || "-"}</td>}
                {!isDriverGroup && (
                  <td className="whitespace-nowrap px-4 py-3">
                    <RoleBadge role={u.role} />
                    {(u.role === "Client" || u.role === "Viewer") && u.customerId && (
                      <span className="mt-1 block text-[11px] text-slate-400">{u.customerId}</span>
                    )}
                    {u.role === "Mitra" && u.mitraId && <span className="mt-1 block text-[11px] text-slate-400">{u.mitraId}</span>}
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge aktif={u.aktif} />
                </td>
                {!isDriverGroup && (
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateOrDash(u.lastLogin)}</td>
                )}
                <td className="px-4 py-3">
                  <div className={ACTION_ROW}>
                    <button
                      onClick={() => setDetail(u)}
                      title="Detail"
                      aria-label="Detail"
                      className={actionClass("view")}
                    >
                      <Eye size={16} />
                    </button>
                    {canManage ? (
                      <>
                        <button
                          onClick={() => openEdit(u)}
                          title="Edit"
                          aria-label="Edit"
                          className={actionClass("edit")}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => void handleToggle(u)}
                          title={u.aktif ? "Nonaktifkan" : "Aktifkan"}
                          aria-label={u.aktif ? "Nonaktifkan" : "Aktifkan"}
                          className={actionClass(u.aktif ? "danger" : "success")}
                        >
                          <Power size={16} />
                        </button>
                      </>
                    ) : (
                      <span
                        className="px-1 text-xs text-slate-300"
                        title={
                          u.role === "Superadmin"
                            ? "Akun Superadmin tidak bisa diubah lewat halaman ini"
                            : "Hanya Superadmin yang dapat mengubah akun GMS-Admin lain"
                        }
                      >
                        -
                      </span>
                    )}
                    {u.id !== profile?.id && (
                      <DeleteButton
                        entityType="user"
                        id={u.id}
                        details={[["Nama", u.nama], ["Email", u.email], ["Role", roleLabel(u.role)]]}
                        onDone={handleRefresh}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </MasterTableCard>

      <Pagination meta={list.meta} page={list.page} pageSize={list.pageSize} loading={list.loading} onPage={list.setPage} onPageSize={list.setPageSize} unit="user" />

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Detail User</h2>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  aria-label="Tutup"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <UserRowAvatar fileId={detail.foto} nama={detail.nama} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">{detail.nama}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={detail.role} />
                    <StatusBadge aktif={detail.aktif} />
                  </div>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-sm">
                <dt className="text-slate-400">Email</dt>
                <dd className="break-all text-slate-800">{detail.email}</dd>
                {isDriverGroup && (
                  <>
                    <dt className="text-slate-400">Nopol</dt>
                    <dd className="font-mono text-slate-800">{detail.nopol || "-"}</dd>
                  </>
                )}
                {detail.role === "Driver" && (
                  <>
                    <dt className="text-slate-400">No. HP Driver</dt>
                    <dd className="text-slate-800">{detail.driverTelepon || "-"}</dd>
                  </>
                )}
                {(detail.role === "Client" || detail.role === "Viewer") && detail.customerId && (
                  <>
                    <dt className="text-slate-400">Client ID</dt>
                    <dd className="text-slate-800">{detail.customerId}</dd>
                  </>
                )}
                {detail.role === "Mitra" && detail.mitraId && (
                  <>
                    <dt className="text-slate-400">Kode Mitra</dt>
                    <dd className="text-slate-800">{detail.mitraId}</dd>
                  </>
                )}
                <dt className="text-slate-400">Last Login</dt>
                <dd className="text-slate-800">{dateOrDash(detail.lastLogin)}</dd>
                <dt className="text-slate-400">Dibuat</dt>
                <dd className="text-slate-800">{dateOrDash(detail.createdAt)}</dd>
              </dl>
              <p className="mt-4 text-[11px] text-slate-400">{ROLE_DESCRIPTION[detail.role]}</p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit} className="max-h-[90vh] overflow-y-auto p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingId ? (isDriverGroup ? "Edit Driver" : "Edit User") : isDriverGroup ? "Tambah Driver" : "Tambah User"}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Tutup"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Foto</span>
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                      {form.fotoDataUrl ? (
                        <img src={form.fotoDataUrl} alt="Foto user" className="h-full w-full object-cover" />
                      ) : (
                        initials(form.nama || "?")
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-700">
                        <Camera size={14} /> Kamera
                        <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoChange} />
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-700">
                        <Upload size={14} /> Upload Foto
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      </label>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">Maks {MAX_PHOTO_SIZE_MB}MB</p>
                  {photoError && <p className="mt-1.5 text-xs font-medium text-red-600">{photoError}</p>}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="Nama lengkap"
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Email</span>
                  <input
                    required
                    type="email"
                    className={`${inputClass} ${emailError ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
                    placeholder="nama@gms-logistics.id"
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      setEmailError(null);
                    }}
                    onBlur={() => void checkEmail()}
                    aria-invalid={!!emailError}
                  />
                  {emailError && (
                    <span role="alert" className="mt-1.5 block text-xs font-medium text-red-600">
                      {emailError}
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    Password {editingId && <span className="text-slate-400">(opsional)</span>}
                  </span>
                  <input
                    required={!editingId}
                    type="password"
                    className={inputClass}
                    placeholder={editingId ? "Kosongkan jika tidak ingin mengubah" : "Buat password awal"}
                    value={form.password ?? ""}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>
                {isDriverGroup ? (
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Role</span>
                    <p className="text-sm text-slate-800">{roleLabel("Driver")}</p>
                    <span className="mt-1 block text-[11px] text-slate-400">{ROLE_DESCRIPTION.Driver}</span>
                  </div>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Role</span>
                    <select
                      className={inputClass}
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                    >
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block text-[11px] text-slate-400">{ROLE_DESCRIPTION[form.role]}</span>
                  </label>
                )}

                {form.role === "Driver" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Nopol (Data Driver &amp; Truck)</span>
                    <select
                      className={inputClass}
                      value={form.driverId ?? ""}
                      onChange={(e) => setForm({ ...form, driverId: e.target.value || null })}
                    >
                      <option value="">- Belum ditautkan -</option>
                      {selectableDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nomorUnit ?? "Tanpa Nopol"} - {d.nama} ({d.telepon})
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block text-[11px] text-slate-400">
                      Pilihan diambil dari data driver &amp; truck di Master Armada, supaya pengiriman yang ditugaskan ke
                      truck-nya muncul di dashboard Portal Driver. Kalau belum ditautkan, dashboard driver akan kosong.
                    </span>
                  </label>
                )}

                {(form.role === "Client" || form.role === "Viewer") && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Client</span>
                    <select
                      required={form.role === "Client" || !editingId}
                      className={inputClass}
                      value={form.customerId ?? ""}
                      onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    >
                      <option value="">Pilih Client...</option>
                      {clientOptions.map((c) => (
                        <option key={c.customerId} value={c.customerId}>
                          {c.nama && c.nama !== c.customerId ? `${c.customerId} - ${c.nama}` : c.customerId}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block text-[11px] text-slate-400">
                      Akun ini hanya akan melihat data pengiriman milik Client yang dipilih. Client belum ada di daftar? Tambahkan dulu di menu Clients.
                    </span>
                  </label>
                )}

                {form.role === "Mitra" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Mitra</span>
                    <select
                      required
                      className={inputClass}
                      value={form.mitraId ?? ""}
                      onChange={(e) => setForm({ ...form, mitraId: e.target.value })}
                    >
                      <option value="">Pilih Mitra...</option>
                      {mitraOptions.map((m) => (
                        <option key={m.mitraId} value={m.mitraId}>
                          {m.nama && m.nama !== m.mitraId ? `${m.mitraId} - ${m.nama}` : m.mitraId}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block text-[11px] text-slate-400">
                      Akun ini hanya akan melihat dan meng-update paket yang sudah diteruskan ke Mitra yang dipilih. Mitra belum ada di daftar? Tambahkan dulu di menu Mitra.
                    </span>
                  </label>
                )}
              </div>

              {submitError && <p className="mt-4 text-sm font-medium text-red-600">{submitError}</p>}

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
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
