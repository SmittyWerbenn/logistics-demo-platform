import { createContext, useContext, type ReactNode } from "react";
import { api } from "../utils/apiClient";

export interface ClientLogo {
  id: string;
  nama: string;
  altText: string | null;
  sortOrder: number;
  aktif: boolean;
  externalUrl: string | null;
  fileId: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** Resolved view URL (static /assets path for the 13 seed logos, short-lived
   * signed MinIO URL for uploaded ones). */
  url: string | null;
}

interface ClientLogoContextValue {
  /** Create a logo. If `logoFile` is provided it is uploaded (multipart);
   * otherwise the caller may pass an absolute URL. */
  createLogo: (data: {
    nama: string;
    altText?: string;
    sortOrder?: number;
    aktif?: boolean;
    logoFile?: File;
  }) => Promise<void>;
  updateLogo: (
    id: string,
    data: {
      nama?: string;
      altText?: string;
      sortOrder?: number;
      aktif?: boolean;
      logoFile?: File;
    },
  ) => Promise<void>;
}

const ClientLogoContext = createContext<ClientLogoContextValue | null>(null);

function toForm(body: Record<string, unknown>, logoFile?: File): FormData | Record<string, unknown> {
  if (!logoFile) return body;
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null && String(v) !== "") form.append(k, String(v));
  }
  if (logoFile) form.append("logoFile", logoFile);
  return form;
}

export function ClientLogoProvider({ children }: { children: ReactNode }) {
  async function createLogo(data: { nama: string; altText?: string; sortOrder?: number; aktif?: boolean; logoFile?: File }) {
    const body: Record<string, unknown> = {
      nama: data.nama,
      ...(data.altText !== undefined ? { altText: data.altText } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.aktif !== undefined ? { aktif: data.aktif } : {}),
    };
    await api.post("/api/client-logos", toForm(body, data.logoFile));
  }

  async function updateLogo(
    id: string,
    data: { nama?: string; altText?: string; sortOrder?: number; aktif?: boolean; logoFile?: File },
  ) {
    const body: Record<string, unknown> = {};
    if (data.nama !== undefined) body.nama = data.nama;
    if (data.altText !== undefined) body.altText = data.altText;
    if (data.sortOrder !== undefined) body.sortOrder = data.sortOrder;
    if (data.aktif !== undefined) body.aktif = data.aktif;
    await api.patch(`/api/client-logos/${encodeURIComponent(id)}`, toForm(body, data.logoFile));
  }

  return (
    <ClientLogoContext.Provider value={{ createLogo, updateLogo }}>{children}</ClientLogoContext.Provider>
  );
}

export function useClientLogo() {
  const ctx = useContext(ClientLogoContext);
  if (!ctx) throw new Error("useClientLogo must be used within ClientLogoProvider");
  return ctx;
}