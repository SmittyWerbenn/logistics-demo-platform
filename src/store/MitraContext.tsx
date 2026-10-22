import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../utils/apiClient";
import { useAuth } from "./AuthContext";

export interface Mitra {
  kodeMitra: string;
  nama: string;
  pic: string | null;
  telepon: string | null;
  email: string | null;
  alamat: string | null;
  area: string | null;
  aktif: boolean;
  createdAt?: string;
}

export interface MitraFormData {
  kodeMitra: string;
  nama: string;
  pic: string;
  telepon: string;
  email: string;
  alamat: string;
  area: string;
}

interface MitraContextValue {
  mitras: Mitra[];
  activeMitras: Mitra[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  createMitra: (data: MitraFormData) => Promise<void>;
  updateMitra: (kodeMitra: string, data: Omit<MitraFormData, "kodeMitra">) => Promise<void>;
  setMitraAktif: (kodeMitra: string, aktif: boolean) => Promise<void>;
}

const MitraContext = createContext<MitraContextValue | null>(null);

export function MitraProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, profile } = useAuth();
  const [mitras, setMitras] = useState<Mitra[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const canManage = profile?.role === "Superadmin" || profile?.role === "Admin";

  async function refresh() {
    if (!canManage) {
      setMitras([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get<{ items: Mitra[] }>("/api/mitras");
      setMitras(res.items);
    } catch {
      setMitras([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && canManage) refresh();
    else setMitras([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, canManage]);

  async function createMitra(data: MitraFormData) {
    await api.post("/api/mitras", data);
    await refresh();
  }

  async function updateMitra(kodeMitra: string, data: Omit<MitraFormData, "kodeMitra">) {
    await api.patch(`/api/mitras/${encodeURIComponent(kodeMitra)}`, data);
    await refresh();
  }

  async function setMitraAktif(kodeMitra: string, aktif: boolean) {
    await api.patch(`/api/mitras/${encodeURIComponent(kodeMitra)}`, { aktif });
    await refresh();
  }

  return (
    <MitraContext.Provider
      value={{
        mitras,
        activeMitras: mitras.filter((m) => m.aktif),
        isLoading,
        refresh,
        createMitra,
        updateMitra,
        setMitraAktif,
      }}
    >
      {children}
    </MitraContext.Provider>
  );
}

export function useMitras() {
  const ctx = useContext(MitraContext);
  if (!ctx) throw new Error("useMitras must be used within MitraProvider");
  return ctx;
}
