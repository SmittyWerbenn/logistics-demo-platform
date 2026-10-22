import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../utils/apiClient";
import { useAuth } from "./AuthContext";

export interface Layanan {
  id: string;
  nama: string;
  deskripsi: string | null;
  aktif: boolean;
  /** Orders currently using this layanan. */
  jumlahOrder: number;
  /** True for LTL - the order fallback, which can't be deleted/deactivated/renamed. */
  fallback: boolean;
  createdAt?: string;
}

interface LayananResponse {
  items: Layanan[];
  standard: string[];
  fallback: { nama: string; ready: boolean };
}

interface LayananContextValue {
  /** Superadmin/Admin: every layanan. Any other role: active ones only. */
  layanans: Layanan[];
  /** What order forms offer - active layanan names, from Master Layanan. */
  activeNames: string[];
  /** Standard picks for "Tambah Layanan" (Darat..FTL). */
  standardOptions: string[];
  /** ready=false means LTL is missing/inactive so order fallback can't work. */
  fallback: { nama: string; ready: boolean };
  isLoading: boolean;
  refresh: () => Promise<void>;
  createLayanan: (nama: string, deskripsi?: string) => Promise<void>;
  updateLayanan: (id: string, data: { nama?: string; deskripsi?: string; aktif?: boolean }) => Promise<void>;
}

const LayananContext = createContext<LayananContextValue | null>(null);

export function LayananProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [layanans, setLayanans] = useState<Layanan[]>([]);
  const [standardOptions, setStandardOptions] = useState<string[]>([]);
  const [fallback, setFallback] = useState({ nama: "LTL", ready: true });
  const [isLoading, setIsLoading] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      const res = await api.get<LayananResponse>("/api/layanan");
      setLayanans(res.items);
      setStandardOptions(res.standard);
      setFallback(res.fallback);
    } catch {
      // Keep the last good list rather than blanking order dropdowns on a
      // transient failure.
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) refresh();
    else setLayanans([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function createLayanan(nama: string, deskripsi = "") {
    await api.post("/api/layanan", { nama, deskripsi });
    await refresh();
  }

  async function updateLayanan(id: string, data: { nama?: string; deskripsi?: string; aktif?: boolean }) {
    await api.patch(`/api/layanan/${encodeURIComponent(id)}`, data);
    await refresh();
  }

  return (
    <LayananContext.Provider
      value={{
        layanans,
        activeNames: layanans.filter((l) => l.aktif).map((l) => l.nama),
        standardOptions,
        fallback,
        isLoading,
        refresh,
        createLayanan,
        updateLayanan,
      }}
    >
      {children}
    </LayananContext.Provider>
  );
}

export function useLayanan() {
  const ctx = useContext(LayananContext);
  if (!ctx) throw new Error("useLayanan must be used within LayananProvider");
  return ctx;
}
