import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody } from "../validate";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 120;
const hits = new Map<string, number[]>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) throw Errors.rateLimited("Terlalu banyak permintaan. Coba lagi dalam beberapa menit.");
  recent.push(now);
  hits.set(key, recent);
}

const HUBS = { JKT: "Jakarta", SUB: "Surabaya" } as const;
const MODES = { CARGO: "Cargo Darat & Laut", KERETA: "Kereta Api Express" } as const;
type Hub = keyof typeof HUBS;
type Mode = keyof typeof MODES;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const hubOf = (v: unknown): Hub => {
  const h = str(v).toUpperCase();
  if (h !== "JKT" && h !== "SUB") throw Errors.badRequest("Pilih kota asal (Jakarta / Surabaya).");
  return h;
};
const modeOf = (v: unknown): Mode => {
  const m = str(v).toUpperCase();
  if (m !== "CARGO" && m !== "KERETA") throw Errors.badRequest("Pilih jenis layanan (Cargo / Kereta Api).");
  return m;
};

interface RateRow {
  id: number;
  grp: string;
  kota: string;
  tarif_per_kg: number;
  tarif_1_5kg: number | null;
  min_kg: number;
  estimasi_text: string;
  lead_min: number;
  lead_max: number;
}

export function registerOngkirRoutes(router: Router) {
  // Options of the Cek Ongkir form: origin hubs, service modes and the destination list of the chosen hub + mode, grouped by region.
  // Source: ongkir_rates (generated from assets/Price List Website Sinar trans.xlsx).
  router.get("/api/public/ongkir/tujuan", async (ctx: Ctx) => {
    checkRateLimit(ctx.request.headers.get("CF-Connecting-IP") ?? "unknown");
    const q = new URL(ctx.request.url).searchParams;
    const hub = hubOf(q.get("hub"));
    const mode = modeOf(q.get("mode"));
    const r = await ctx.env.DB.prepare(
      `SELECT id, grp, kota, min_kg, estimasi_text FROM ongkir_rates WHERE origin_hub = ? AND mode = ? ORDER BY sort`,
    )
      .bind(hub, mode)
      .all<{ id: number; grp: string; kota: string; min_kg: number; estimasi_text: string }>();
    return ok({
      hubs: Object.entries(HUBS).map(([id, nama]) => ({ id, nama })),
      modes: Object.entries(MODES).map(([id, nama]) => ({ id, nama })),
      items: (r.results ?? []).map((x) => ({ id: x.id, grup: x.grp, kota: x.kota, minKg: x.min_kg, estimasi: x.estimasi_text })),
    });
  });

  // The price source of truth: the frontend only displays this answer.
  // chargeable kg = max(actual kg, volumetric kg (P x L x T / 4000), the route minimum kg); total = chargeable x rate per kg.
  router.post("/api/public/ongkir", async (ctx: Ctx) => {
    checkRateLimit(ctx.request.headers.get("CF-Connecting-IP") ?? "unknown");
    const body = await parseJsonBody(ctx.request);
    const hub = hubOf(body.hub);
    const mode = modeOf(body.mode);
    const rateId = Number(body.rateId);
    const beratKg = Number(body.beratKg);
    const jumlahKoli = Math.max(1, Math.floor(Number(body.jumlahKoli) || 1));
    if (!Number.isInteger(rateId) || rateId <= 0) throw Errors.badRequest("Pilih kota tujuan.");
    if (!Number.isFinite(beratKg) || beratKg <= 0 || beratKg > 100000) throw Errors.badRequest("Berat paket tidak valid.");
    const dim = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 && n <= 10000 ? n : 0;
    };
    const p = dim(body.panjangCm), l = dim(body.lebarCm), t = dim(body.tinggiCm);
    const volumetricKg = p && l && t ? Math.ceil((p * l * t * jumlahKoli) / 4000) : 0;

    const rate = await ctx.env.DB.prepare(
      `SELECT id, grp, kota, tarif_per_kg, tarif_1_5kg, min_kg, estimasi_text, lead_min, lead_max FROM ongkir_rates WHERE id = ? AND origin_hub = ? AND mode = ?`,
    )
      .bind(rateId, hub, mode)
      .first<RateRow>();
    if (!rate) throw Errors.badRequest("Tarif untuk tujuan tersebut tidak ditemukan.");

    const chargeableKg = Math.max(Math.ceil(beratKg), volumetricKg, rate.min_kg);
    // A "1 s/d 5 kg" flat price (when the sheet gives one) covers the first 5 kg; the rest is per kg.
    const total =
      rate.tarif_1_5kg != null
        ? rate.tarif_1_5kg + Math.max(0, chargeableKg - 5) * rate.tarif_per_kg
        : chargeableKg * rate.tarif_per_kg;
    if (!Number.isFinite(total) || total < 0) throw Errors.internal("Harga tidak dapat dihitung.");

    return ok({
      asal: { id: hub, nama: HUBS[hub] },
      mode: { id: mode, nama: MODES[mode] },
      tujuan: { id: rate.id, grup: rate.grp, kota: rate.kota },
      beratKg,
      jumlahKoli,
      volumetricKg,
      minimumKg: rate.min_kg,
      chargeableKg,
      tarifPerKg: rate.tarif_per_kg,
      total,
      estimasi: rate.estimasi_text,
      leadTimeMin: rate.lead_min,
      leadTimeMax: rate.lead_max,
    });
  });
}
