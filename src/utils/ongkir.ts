import type { Language } from "../data/translations";
import { api } from "./apiClient";

/** Cek Ongkir runs on the Sinar Trans price list (assets/Price List Website Sinar trans.xlsx -> table ongkir_rates).
 * The backend (api-worker/src/routes/ongkir.ts) is the only place a price is computed; this module asks and formats. */
export interface OngkirOption {
  id: string;
  nama: string;
}

export interface OngkirDestination {
  id: number;
  grup: string;
  kota: string;
  minKg: number;
  estimasi: string;
}

export interface OngkirEstimate {
  asal: OngkirOption;
  mode: OngkirOption;
  tujuan: { id: number; grup: string; kota: string };
  beratKg: number;
  jumlahKoli: number;
  volumetricKg: number;
  minimumKg: number;
  chargeableKg: number;
  tarifPerKg: number;
  total: number;
  estimasi: string;
  leadTimeMin: number;
  leadTimeMax: number;
}

export interface OngkirRequest {
  hub: string;
  mode: string;
  rateId: number;
  beratKg: number;
  jumlahKoli: number;
  panjangCm?: number;
  lebarCm?: number;
  tinggiCm?: number;
}

export function fetchOngkirTujuan(hub: string, mode: string): Promise<{ hubs: OngkirOption[]; modes: OngkirOption[]; items: OngkirDestination[] }> {
  return api.get(`/api/public/ongkir/tujuan?hub=${encodeURIComponent(hub)}&mode=${encodeURIComponent(mode)}`, { auth: false });
}

export function fetchOngkir(req: OngkirRequest): Promise<OngkirEstimate> {
  return api.post<OngkirEstimate>("/api/public/ongkir", req, { auth: false });
}

export function estimasiHariLabel(min: number, max: number, language: Language): string {
  const unit = language === "en" ? (max === 1 ? "day" : "days") : "hari";
  return min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
