/**
 * Cek Ongkir pricing - the single place where a price is computed.
 *
 *   base (Harga Publish, per kg, from price_tariffs - Jabodetabek-origin)
 *     x origin markup (decided by the ORIGIN region, never the destination)
 *   -> per-kg price; total = chargeable kg x per-kg price + koli handling,
 *      rounded to the nearest Rp500.
 *
 * Harga Publish is priced for TWO layanan, both with the same minimum billing weight by ROUTE (see routeMinimumKg):
 * LTL (origin markup 0/15/25%) and LCL (+20% only when the ORIGIN is outside Java - see lclOriginMarkup). Every other layanan has a Rate Publish of Rp0
 * (see ratePublishFor) - the LTL/LCL rate is never reused for them.
 *
 * Base prices are never stored marked up. The origin category of every region
 * (Jabodetabek / Jawa / Luar Jawa) lives in price_regions.kategori_origin.
 */
export type OriginCategory = "JABODETABEK" | "JAWA" | "LUAR_JAWA";

export const ORIGIN_MARKUP: Record<OriginCategory, number> = {
  JABODETABEK: 0,
  JAWA: 0.15,
  LUAR_JAWA: 0.25,
};

/** Minimum billing weight (kg) of a route for the per-kg layanan (LTL and LCL): Jawa -> Jawa 50 kg, every other route
 * (Luar Jawa involved at either end) 100 kg. "Jawa" = a region classified JABODETABEK or JAWA in Master Wilayah
 * (price_regions.kategori_origin): DKI Jakarta, Banten, Jawa Barat, Jawa Tengah, DI Yogyakarta, Jawa Timur. */
export const MINIMUM_KG = { JAWA_JAWA: 50, LUAR_JAWA: 100 } as const;
export type MinimumKategori = "Jawa - Jawa" | "Rute Luar Jawa";

export const isJawa = (r: OriginCategory) => r !== "LUAR_JAWA";

export function routeMinimumKg(origin: OriginCategory, dest: OriginCategory): { kg: number; kategori: MinimumKategori } {
  return isJawa(origin) && isJawa(dest)
    ? { kg: MINIMUM_KG.JAWA_JAWA, kategori: "Jawa - Jawa" }
    : { kg: MINIMUM_KG.LUAR_JAWA, kategori: "Rute Luar Jawa" };
}

/** Estimated transit time of a route. Jawa -> Jawa is 1-5 days. Any route touching Luar Jawa is SEDANG (7-12 days) or
 * JAUH (14-25 days): JAUH when a Luar Jawa end is classified JAUH in Master Wilayah (price_regions.jarak_jawa; currently
 * every Papua province, Maluku and NTT, shown in the Rate Publish table), otherwise SEDANG. A region with no class yet
 * falls back to its province's average published lead time (ETA_JAUH_MIN_AVG_LEAD days or more = JAUH). Never decided
 * by the frontend. */
export const ETA_JAUH_MIN_AVG_LEAD = 10;
export const ETA_BANDS = {
  JAWA: { min: 1, max: 5, kategori: "Jawa - Jawa" },
  SEDANG: { min: 7, max: 12, kategori: "Luar Jawa - Jarak Sedang" },
  JAUH: { min: 14, max: 25, kategori: "Luar Jawa - Jarak Jauh" },
} as const;

/** `jauh`: some Luar Jawa end of the route is classified JAUH (ignored for Jawa -> Jawa). */
export function routeEta(origin: OriginCategory, dest: OriginCategory, jauh: boolean): { min: number; max: number; kategori: string } {
  if (isJawa(origin) && isJawa(dest)) return ETA_BANDS.JAWA;
  return jauh ? ETA_BANDS.JAUH : ETA_BANDS.SEDANG;
}

/** Rate Publish used for a layanan: the stored tariff for LTL and LCL, Rp0 for every other layanan. */
export function ratePublishFor(priced: boolean, tariffPerKg: number): number {
  return priced ? tariffPerKg : 0;
}

/** LCL origin surcharge, decided by the ORIGIN region only (price_regions.kategori_origin): Jabodetabek / Jawa pay
 * nothing extra, Luar Jawa +20%. LCL does not use the LTL origin markup (0 / 15 / 25%). */
export const LCL_LUAR_JAWA_MARKUP = 0.2;
export function lclOriginMarkup(origin: OriginCategory): number {
  return origin === "LUAR_JAWA" ? LCL_LUAR_JAWA_MARKUP : 0;
}
const MIN_CHARGEABLE_KG = 1;
const KOLI_HANDLING_FEE = 2000;
const ROUND_TO = 500;

export function getOriginMarkup(category: OriginCategory): number {
  return ORIGIN_MARKUP[category];
}

export interface PricingInput {
  /** Rate Publish for the chosen layanan (LTL tariff, or 0). */
  basePricePerKg: number;
  originCategory: OriginCategory;
  beratKg: number;
  jumlahKoli: number;
  /** Minimum billing weight (LTL only; 0 = none). */
  minimumKg?: number;
  /** Markup to apply instead of the LTL origin markup (LCL passes its own rule). */
  markup?: number;
}

export interface PricingResult {
  hargaPublishPerKg: number;
  originCategory: OriginCategory;
  markupPersen: number;
  hargaSetelahPenyesuaianPerKg: number;
  chargeableKg: number;
  biayaKoli: number;
  total: number;
}

export function calculatePricing(i: PricingInput): PricingResult {
  const markup = i.markup ?? getOriginMarkup(i.originCategory);
  const adjusted = i.basePricePerKg * (1 + markup);
  const chargeableKg = Math.max(i.beratKg, MIN_CHARGEABLE_KG, i.minimumKg ?? 0);
  // No Rate Publish (non-LTL layanan) means nothing to charge: the koli handling fee must not turn Rp0 into a price.
  const biayaKoli = i.basePricePerKg > 0 ? Math.max(i.jumlahKoli - 1, 0) * KOLI_HANDLING_FEE : 0;
  // Round cents away first so 10000 x 1.15 is exactly 11500, not 11499.999...
  const perKg = Math.round(adjusted * 100) / 100;
  const total = Math.round((Math.round(chargeableKg * perKg * 100) / 100 + biayaKoli) / ROUND_TO) * ROUND_TO;
  return {
    hargaPublishPerKg: i.basePricePerKg,
    originCategory: i.originCategory,
    markupPersen: Math.round(markup * 100),
    hargaSetelahPenyesuaianPerKg: Math.round(adjusted * 100) / 100,
    chargeableKg,
    biayaKoli,
    total,
  };
}
