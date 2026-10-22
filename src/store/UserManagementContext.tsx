import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppUser, UserRole } from "../types";
import { api, uploadFile } from "../utils/apiClient";
import { useAuth } from "./AuthContext";

export interface UserRow {
  id: string;
  nama: string;
  email: string;
  role: UserRole;
  aktif: number;
  foto_file_id: string | null;
  last_login_at: string | null;
  created_at?: string | null;
  customer_id: string | null;
  mitra_id: string | null;
  nopol?: string | null;
  driver_telepon?: string | null;
}

interface DriverRow {
  id: string;
  nama: string;
  telepon: string;
  user_id: string | null;
  linked_user_nama: string | null;
  nomor_unit: string | null;
}

export interface DriverOption {
  id: string;
  nama: string;
  telepon: string;
  linkedUserId: string | null;
  linkedUserNama: string | null;
  nomorUnit: string | null;
}

function toDriverOption(row: DriverRow): DriverOption {
  return {
    id: row.id,
    nama: row.nama,
    telepon: row.telepon,
    linkedUserId: row.user_id,
    linkedUserNama: row.linked_user_nama,
    nomorUnit: row.nomor_unit,
  };
}

export function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    nama: row.nama,
    email: row.email,
    role: row.role,
    aktif: row.aktif === 1,
    lastLogin: row.last_login_at ?? undefined,
    foto: row.foto_file_id ?? undefined,
    customerId: row.customer_id,
    mitraId: row.mitra_id,
    nopol: row.nopol ?? null,
    driverTelepon: row.driver_telepon ?? null,
    createdAt: row.created_at ?? undefined,
  };
}

export interface UserFormData {
  nama: string;
  email: string;
  role: UserRole;
  /** A freshly-picked photo as a data URL (from compressImage); uploaded
   * to storage before the user record is written. Leave unset to keep the
   * existing photo on an edit. */
  fotoDataUrl?: string;
  /** Set only when creating a user, or when explicitly resetting one's
   * password - omit on a plain profile edit to leave it unchanged. */
  password?: string;
  /** Links this account to a drivers-table record (id from `drivers`,
   * see DriverOption) so the driver portal knows which shipments belong
   * to it. Only meaningful when role is "Driver". Pass null to unlink,
   * omit to leave the current link untouched on an edit. */
  driverId?: string | null;
  /** Client ID - mandatory when role is "Client", ignored/cleared
   * for every other role. */
  customerId?: string | null;
  /** Kode Mitra - mandatory when role is "Mitra", ignored/cleared for
   * every other role. */
  mitraId?: string | null;
}

interface UserManagementContextValue {
  drivers: DriverOption[];
  customerIds: string[];
  /** Client ID + name for the Tambah User dropdown. */
  clientOptions: { customerId: string; nama: string | null }[];
  /** Kode Mitra + name for the Tambah User dropdown (active Mitra only). */
  mitraOptions: { mitraId: string; nama: string }[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  createUser: (data: UserFormData) => Promise<void>;
  updateUser: (id: string, data: UserFormData) => Promise<void>;
  setUserActive: (id: string, aktif: boolean) => Promise<void>;
}

const UserManagementContext = createContext<UserManagementContextValue | null>(null);

export function UserManagementProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, profile } = useAuth();
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [customerIds, setCustomerIds] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<{ customerId: string; nama: string | null }[]>([]);
  const [mitraOptions, setMitraOptions] = useState<{ mitraId: string; nama: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function refresh() {
    if (profile?.role !== "Superadmin" && profile?.role !== "Admin") return;
    setIsLoading(true);
    // Each source loads independently: one failing dropdown endpoint (e.g.
    // /api/mitras before the Worker is redeployed) must not blank the others,
    // and a failed source keeps its last good value. (The user list itself is
    // queried per page, with filters, by useUserList.)
    const [driversRes, customerIdsRes, mitrasRes] = await Promise.allSettled([
      api.get<{ items: DriverRow[] }>("/api/drivers"),
      api.get<{ items: string[]; clients?: { customerId: string; nama: string | null }[] }>("/api/customer-ids"),
      api.get<{ items: { kodeMitra: string; nama: string; aktif: boolean }[] }>("/api/mitras?active=true"),
    ]);
    if (driversRes.status === "fulfilled") setDrivers(driversRes.value.items.map(toDriverOption));
    if (customerIdsRes.status === "fulfilled") {
      const { items, clients } = customerIdsRes.value;
      setCustomerIds(items);
      setClientOptions(clients ?? items.map((id) => ({ customerId: id, nama: null })));
    }
    if (mitrasRes.status === "fulfilled") {
      setMitraOptions(mitrasRes.value.items.map((m) => ({ mitraId: m.kodeMitra, nama: m.nama })));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    if (isAuthenticated && (profile?.role === "Superadmin" || profile?.role === "Admin")) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, profile?.role]);

  async function createUser(data: UserFormData) {
    let fotoFileId: string | undefined;
    const tempId = crypto.randomUUID();
    if (data.fotoDataUrl) {
      const uploaded = await uploadFile(data.fotoDataUrl, "user_avatar", tempId);
      fotoFileId = uploaded.id;
    }
    await api.post("/api/users", {
      nama: data.nama,
      email: data.email,
      role: data.role,
      password: data.password,
      fotoFileId,
      ...(data.driverId ? { driverId: data.driverId } : {}),
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.mitraId ? { mitraId: data.mitraId } : {}),
    });
    await refresh();
  }

  async function updateUser(id: string, data: UserFormData) {
    let fotoFileId: string | undefined;
    if (data.fotoDataUrl) {
      const uploaded = await uploadFile(data.fotoDataUrl, "user_avatar", id);
      fotoFileId = uploaded.id;
    }
    await api.patch(`/api/users/${id}`, {
      nama: data.nama,
      email: data.email,
      role: data.role,
      password: data.password || undefined,
      fotoFileId,
      ...(data.driverId !== undefined ? { driverId: data.driverId } : {}),
      ...(data.customerId !== undefined ? { customerId: data.customerId } : {}),
      ...(data.mitraId !== undefined ? { mitraId: data.mitraId } : {}),
    });
    await refresh();
  }

  async function setUserActive(id: string, aktif: boolean) {
    await api.patch(`/api/users/${id}`, { aktif });
    await refresh();
  }

  return (
    <UserManagementContext.Provider
      value={{ drivers, customerIds, clientOptions, mitraOptions, isLoading, refresh, createUser, updateUser, setUserActive }}
    >
      {children}
    </UserManagementContext.Provider>
  );
}

export function useUserManagement() {
  const ctx = useContext(UserManagementContext);
  if (!ctx) throw new Error("useUserManagement must be used within UserManagementProvider");
  return ctx;
}
