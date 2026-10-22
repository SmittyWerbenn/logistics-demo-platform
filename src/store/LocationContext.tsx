import { createContext, useContext, type ReactNode } from "react";
import type { TitikJenis, TitikLokasi } from "../types";
import { api } from "../utils/apiClient";

export interface LocationRow {
  id: string;
  nama_kota: string;
  kode_kota: string;
  provinsi?: string;
  nama_titik?: string | null;
  nama_area?: string | null;
  jenis: TitikJenis;
  aktif?: number;
}

export function toTitik(row: LocationRow): TitikLokasi {
  return {
    id: row.id,
    namaKota: row.nama_kota,
    provinsi: row.provinsi ?? "",
    namaTitik: row.nama_titik ?? "",
    kodeKota: row.kode_kota ?? "",
    namaArea: row.nama_area ?? "",
    jenis: row.jenis,
    aktif: row.aktif === undefined ? true : row.aktif === 1,
  };
}

/** Nama Titik Transit is no longer edited from the UI; rows that already have
 * one keep it (the field is simply not sent). */
export interface TitikFormData {
  namaKota: string;
  provinsi: string;
  kodeKota: string;
  namaArea: string;
  jenis: TitikJenis;
  aktif: boolean;
}

/** One row sent to the bulk-import endpoint. `row` is the number shown to the
 * admin (file row) so server-side errors can point at it. */
export interface TitikImportItem extends Omit<TitikFormData, "jenis" | "aktif"> {
  row: number;
  jenis?: string;
  aktif?: boolean;
}

export interface TitikImportFailure {
  row: number;
  kota: string;
  provinsi: string;
  /** Still returned by the API; not shown anymore. */
  titik?: string;
  message: string;
}

export interface TitikImportResult {
  total: number;
  created: number;
  failed: TitikImportFailure[];
}

interface LocationContextValue {
  createTitik: (data: TitikFormData) => Promise<TitikLokasi>;
  updateTitik: (id: string, data: TitikFormData) => Promise<void>;
  setTitikAktif: (id: string, aktif: boolean) => Promise<void>;
  importTitik: (items: TitikImportItem[]) => Promise<TitikImportResult>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/** Write-side of Kota & Titik Transit. Reading is done page by page (GET
 * /api/locations?page=..) by the list screen and by server-searched
 * suggestions elsewhere - the whole master list is never loaded into the browser. */
export function LocationProvider({ children }: { children: ReactNode }) {
  async function createTitik(data: TitikFormData): Promise<TitikLokasi> {
    const res = await api.post<{ id: string }>("/api/locations", data);
    return { id: res.id, namaTitik: "", ...data };
  }

  async function updateTitik(id: string, data: TitikFormData) {
    await api.patch(`/api/locations/${id}`, data);
  }

  async function setTitikAktif(id: string, aktif: boolean) {
    await api.patch(`/api/locations/${id}`, { aktif });
  }

  /** Imports in chunks (keeps each request small), merging per-row failures. */
  async function importTitik(items: TitikImportItem[]): Promise<TitikImportResult> {
    const CHUNK = 400;
    const total: TitikImportResult = { total: items.length, created: 0, failed: [] };
    for (let i = 0; i < items.length; i += CHUNK) {
      const res = await api.post<TitikImportResult>("/api/locations/bulk", { items: items.slice(i, i + CHUNK) });
      total.created += res.created;
      total.failed.push(...res.failed);
    }
    return total;
  }

  return (
    <LocationContext.Provider
      value={{ createTitik, updateTitik, setTitikAktif, importTitik }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocations() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocations must be used within LocationProvider");
  return ctx;
}
