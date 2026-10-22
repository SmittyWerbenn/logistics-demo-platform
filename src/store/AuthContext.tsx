import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { UserRole } from "../types";
import { api, ApiError, getToken, setToken } from "../utils/apiClient";

export interface AdminProfile {
  id: string;
  nama: string;
  email: string;
  role: UserRole;
  fotoFileId?: string;
  /** Client ID - set only for role "Client". */
  customerId?: string | null;
  /** Kode Mitra - set only for role "Mitra". */
  mitraId?: string | null;
}

interface MeResponse {
  id: string;
  nama: string;
  email: string;
  role: UserRole;
  aktif: number;
  foto_file_id: string | null;
  customer_id: string | null;
  mitra_id: string | null;
}

interface LoginResponse {
  token: string;
  expiresAt: string;
  user: { id: string; nama: string; email: string; role: UserRole; customerId: string | null; mitraId: string | null };
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: AdminProfile | null;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  logout: () => void;
  updateProfile: (data: { nama: string; email: string; fotoFileId?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toProfile(me: MeResponse): AdminProfile {
  return {
    id: me.id,
    nama: me.nama,
    email: me.email,
    role: me.role,
    fotoFileId: me.foto_file_id ?? undefined,
    customerId: me.customer_id,
    mitraId: me.mitra_id,
  };
}

/**
 * Real authentication against the production API (see api-worker/) - the
 * session token lives only in sessionStorage (cleared when the tab
 * closes); the server is the source of truth for role/permissions, this
 * context just mirrors the signed-in profile for the UI.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api
      .get<MeResponse>("/api/auth/me")
      .then((me) => setProfile(toProfile(me)))
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    try {
      const res = await api.post<LoginResponse>("/api/auth/login", { email, password }, { auth: false });
      setToken(res.token);
      setProfile({ ...res.user });
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof ApiError ? err.message : "Gagal login.",
        code: err instanceof ApiError ? err.code : undefined,
      };
    }
  }

  function logout() {
    api.post("/api/auth/logout").catch(() => {});
    setToken(null);
    setProfile(null);
  }

  async function updateProfile(data: { nama: string; email: string; fotoFileId?: string }) {
    try {
      await api.patch("/api/auth/me", data);
      setProfile((p) => (p ? { ...p, nama: data.nama, email: data.email, fotoFileId: data.fotoFileId ?? p.fotoFileId } : p));
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal menyimpan profil." };
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Gagal mengganti password." };
    }
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!profile, isLoading, profile, login, logout, updateProfile, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
