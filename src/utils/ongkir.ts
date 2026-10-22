import type { Language } from "../data/translations";
import { api } from "./apiClient";

/** Answer of POST /api/public/ongkir. The backend (api-worker/src/pricing.ts) is
 * the only place a price is computed; this module just asks and formats. */
export interface OngkirEstimate {
  asal: { provinsi: string; kota: string };
  tujuan: { provinsi: string; kota: string; kecamatan: string; kategoriArea: string };
  beratKg: number;
  jumlahKoli: number;
  layananId: string;
  layanan: string;
  hargaPublishPerKg: number;
  originCategory: "JABODETABEK" | "JAWA" | "LUAR_JAWA";
  markupPersen: number;
  hargaSetelahPenyesuaianPerKg: number;
  chargeableKg: number;
  /** LTL minimum billing weight (Jawa 50 / Luar Jawa 100 / Pelosok Terjauh 300); 0 for other layanan. */
  minimumKg: number;
  minimumKategori: string | null;
  /** false = this layanan has no Rate Publish (Rp0). */
  ratePublishTersedia: boolean;
  biayaKoli: number;
  total: number;
  leadTimeMin: number;
  leadTimeMax: number;
}

export interface OngkirRequest {
  asal: { provinsi: string; kota: string };
  tujuan: { provinsi: string; kota: string; kecamatan: string };
  beratKg: number;
  jumlahKoli: number;
  /** Master Layanan id (the API validates it: active entries only). */
  layananId: string;
}

/** Jenis layanan = the active entries of Master Layanan (Portal Admin), already in display order. */
export async function fetchLayananOptions(): Promise<Array<{ id: string; nama: string }>> {
  const res = await api.get<{ items: Array<{ id: string; nama: string }> }>("/api/public/ongkir/layanan", { auth: false });
  return res.items;
}

/** Minimum billing weight of a route (origin + destination, per layanan), decided by the API (0 = none / not decidable yet). */
export async function fetchMinimumWeight(params: { provinsi: string; kota?: string; asalProvinsi?: string; asalKota?: string; layananId: string }): Promise<{ minimumKg: number; minimumKategori: string | null }> {
  const qs = new URLSearchParams({ provinsi: params.provinsi, layananId: params.layananId });
  if (params.kota) qs.set("kota", params.kota);
  if (params.asalProvinsi) qs.set("asalProvinsi", params.asalProvinsi);
  if (params.asalKota) qs.set("asalKota", params.asalKota);
  return api.get(`/api/public/ongkir/minimum?${qs.toString()}`, { auth: false });
}

export function fetchOngkir(req: OngkirRequest): Promise<OngkirEstimate> {
  return api.post<OngkirEstimate>("/api/public/ongkir", req, { auth: false });
}

/** One level of the wilayah tree: provinces, then kab/kota of a province, then
 * kecamatan of a kab/kota. */
export async function fetchWilayah(provinsi?: string, kota?: string): Promise<string[]> {
  const params = new URLSearchParams();
  if (provinsi) params.set("provinsi", provinsi);
  if (provinsi && kota) params.set("kota", kota);
  const qs = params.toString();
  const res = await api.get<{ items: string[] }>(`/api/public/ongkir/wilayah${qs ? `?${qs}` : ""}`, { auth: false });
  return res.items;
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
