import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody } from "../validate";
import { ETA_JAUH_MIN_AVG_LEAD, calculatePricing, lclOriginMarkup, ratePublishFor, routeEta, routeMinimumKg, type OriginCategory } from "../pricing";
import { LAYANAN_ORDER_SQL, isFallbackLayanan } from "../layanan";

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

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Master Wilayah class of a place: the exact kab/kota when given, else the province (Luar Jawa only when EVERY region
 * of the province is Luar Jawa). null = not a known place. */
async function regionOf(db: D1Database, provinsi: string, kota?: string): Promise<OriginCategory | null> {
  if (kota) {
    const g = await db.prepare(`SELECT kategori_origin AS r FROM price_regions WHERE provinsi = ? AND kabupaten_kota = ?`).bind(provinsi, kota).first<{ r: OriginCategory }>();
    return g?.r ?? null;
  }
  const g = await db
    .prepare(`SELECT SUM(kategori_origin != 'LUAR_JAWA') AS jawa, COUNT(*) AS n FROM price_regions WHERE provinsi = ?`)
    .bind(provinsi)
    .first<{ jawa: number | null; n: number }>();
  if (!g || g.n === 0) return null;
  return (g.jawa ?? 0) > 0 ? "JAWA" : "LUAR_JAWA";
}

/** LTL and LCL are the per-kg layanan: both use the Rate Publish and the route minimum billing weight. */
const isLtlName = (nama: string) => isFallbackLayanan(nama);
const isLclName = (nama: string) => nama.trim().toLowerCase() === "lcl";

export function registerOngkirRoutes(router: Router) {
  // Wilayah tree for the Cek Ongkir pickers, one level per call:
  //   (nothing) -> provinsi list; ?provinsi= -> kab/kota; ?provinsi=&kota= -> kecamatan.
  router.get("/api/public/ongkir/wilayah", async (ctx: Ctx) => {
    checkRateLimit(ctx.request.headers.get("CF-Connecting-IP") ?? "unknown");
    const q = new URL(ctx.request.url).searchParams;
    const provinsi = str(q.get("provinsi"));
    const kota = str(q.get("kota"));
    const db = ctx.env.DB;
    if (!provinsi) {
      const r = await db.prepare(`SELECT DISTINCT provinsi AS nama FROM price_regions ORDER BY provinsi`).all<{ nama: string }>();
      return ok({ items: r.results.map((x) => x.nama) });
    }
    if (!kota) {
      const r = await db
        .prepare(`SELECT kabupaten_kota AS nama FROM price_regions WHERE provinsi = ? ORDER BY kabupaten_kota`)
        .bind(provinsi)
        .all<{ nama: string }>();
      return ok({ items: r.results.map((x) => x.nama) });
    }
    const r = await db
      .prepare(
        `SELECT t.kecamatan AS nama FROM price_tariffs t JOIN price_regions g ON g.id = t.region_id
         WHERE g.provinsi = ? AND g.kabupaten_kota = ? AND t.deleted_at IS NULL ORDER BY t.kecamatan`,
      )
      .bind(provinsi, kota)
      .all<{ nama: string }>();
    return ok({ items: r.results.map((x) => x.nama) });
  });

  // Jenis layanan for the Cek Ongkir picker: the ACTIVE entries of Master Layanan (Portal Admin), in its display order.
  // Nothing is listed in the frontend; an added / deactivated layanan shows up here without a deploy.
  router.get("/api/public/ongkir/layanan", async (ctx: Ctx) => {
    checkRateLimit(ctx.request.headers.get("CF-Connecting-IP") ?? "unknown");
    const r = await ctx.env.DB.prepare(
      `SELECT l.id, l.nama FROM layanans l WHERE l.aktif = 1 AND l.deleted_at IS NULL ORDER BY ${LAYANAN_ORDER_SQL}`,
    ).all<{ id: string; nama: string }>();
    return ok({ items: (r.results ?? []).map((x) => ({ id: x.id, nama: x.nama })) });
  });

  // Minimum billing weight of a ROUTE (origin + destination) for a layanan, so the form can pre-fill the weight. Decided
  // here from Master Wilayah (same routeMinimumKg rule as the price); the frontend never knows the 50 / 100 itself.
  // 0 = no minimum, or not decidable yet (e.g. Jawa destination while the origin is still unchosen).
  router.get("/api/public/ongkir/minimum", async (ctx: Ctx) => {
    checkRateLimit(ctx.request.headers.get("CF-Connecting-IP") ?? "unknown");
    const q = new URL(ctx.request.url).searchParams;
    const none = { minimumKg: 0, minimumKategori: null as string | null };
    const layananId = str(q.get("layananId"));
    const tProv = str(q.get("provinsi"));
    if (!tProv || !layananId) return ok(none);
    const lay = await ctx.env.DB.prepare(`SELECT nama FROM layanans WHERE id = ? AND aktif = 1 AND deleted_at IS NULL`).bind(layananId).first<{ nama: string }>();
    if (!lay || !(isLtlName(lay.nama) || isLclName(lay.nama))) return ok(none);
    const dest = await regionOf(ctx.env.DB, tProv, str(q.get("kota")) || undefined);
    if (!dest) return ok(none);
    const aProv = str(q.get("asalProvinsi"));
    const origin = aProv ? await regionOf(ctx.env.DB, aProv, str(q.get("asalKota")) || undefined) : null;
    if (!origin) {
      // Origin not chosen yet: only a Luar Jawa destination already fixes the answer (100 kg).
      if (dest === "LUAR_JAWA") return ok({ minimumKg: routeMinimumKg("LUAR_JAWA", dest).kg, minimumKategori: routeMinimumKg("LUAR_JAWA", dest).kategori });
      return ok(none);
    }
    const m = routeMinimumKg(origin, dest);
    return ok({ minimumKg: m.kg, minimumKategori: m.kategori });
  });

  // The pricing source of truth: the frontend only displays this answer.
  router.post("/api/public/ongkir", async (ctx: Ctx) => {
    checkRateLimit(ctx.request.headers.get("CF-Connecting-IP") ?? "unknown");
    const body = await parseJsonBody(ctx.request);
    const asal = (body.asal ?? {}) as Record<string, unknown>;
    const tujuan = (body.tujuan ?? {}) as Record<string, unknown>;
    const beratKg = Number(body.beratKg);
    const jumlahKoli = Math.max(1, Math.floor(Number(body.jumlahKoli) || 1));

    if (!str(asal.provinsi) || !str(asal.kota)) throw Errors.badRequest("Pilih provinsi dan kabupaten/kota asal.");
    if (!str(tujuan.provinsi) || !str(tujuan.kota) || !str(tujuan.kecamatan)) {
      throw Errors.badRequest("Pilih provinsi, kabupaten/kota, dan kecamatan tujuan.");
    }
    if (!Number.isFinite(beratKg) || beratKg <= 0 || beratKg > 100000) throw Errors.badRequest("Berat paket tidak valid.");
    // The layanan must be an ACTIVE Master Layanan entry, looked up by its id (a name is accepted only as a fallback
    // for older clients). Region, minimum weight and price are all decided below from the database, never from the request.
    const layananId = str(body.layananId);
    const layananName = str(body.layanan);
    if (!layananId && !layananName) throw Errors.badRequest("Pilih jenis layanan.");
    const layananRow = await ctx.env.DB.prepare(
      layananId
        ? `SELECT id, nama FROM layanans WHERE id = ? AND aktif = 1 AND deleted_at IS NULL`
        : `SELECT id, nama FROM layanans WHERE nama = ? COLLATE NOCASE AND aktif = 1 AND deleted_at IS NULL`,
    )
      .bind(layananId || layananName)
      .first<{ id: string; nama: string }>();
    if (!layananRow) throw Errors.badRequest("Jenis layanan tidak tersedia atau tidak aktif.");
    const layanan = layananRow.nama;
    const isLtl = isLtlName(layananRow.nama);
    const isLcl = isLclName(layananRow.nama);

    // Origin must be a known region: an unclassifiable origin is an error,
    // never a silent 0% / 15% / 25%.
    const origin = await ctx.env.DB.prepare(
      `SELECT kategori_origin, jarak_jawa FROM price_regions WHERE provinsi = ? AND kabupaten_kota = ?`,
    )
      .bind(str(asal.provinsi), str(asal.kota))
      .first<{ kategori_origin: OriginCategory; jarak_jawa: string | null }>();
    if (!origin) throw Errors.badRequest("Wilayah asal tidak dikenali, sehingga harga tidak dapat dihitung.");

    const tarif = await ctx.env.DB.prepare(
      `SELECT t.tarif_per_kg, t.kategori_area, t.lead_min, t.lead_max, g.kategori_origin AS wilayah_tujuan, g.jarak_jawa AS jarak_tujuan
       FROM price_tariffs t JOIN price_regions g ON g.id = t.region_id
       WHERE g.provinsi = ? AND g.kabupaten_kota = ? AND t.kecamatan = ? AND t.deleted_at IS NULL`,
    )
      .bind(str(tujuan.provinsi), str(tujuan.kota), str(tujuan.kecamatan))
      .first<{ tarif_per_kg: number; kategori_area: string; lead_min: number; lead_max: number; wilayah_tujuan: OriginCategory; jarak_tujuan: string | null }>();
    if (!tarif) throw Errors.badRequest("Tarif untuk tujuan tersebut tidak ditemukan.");

    // Rate Publish prices LTL and LCL; every other layanan is Rp0. LTL has a minimum billing weight by destination;
    // LCL has its own origin rule (+20% when the ORIGIN is Luar Jawa, nothing otherwise) instead of the LTL markup.
    const ratePublish = ratePublishFor(isLtl || isLcl, tarif.tarif_per_kg);
    // Minimum billing weight by route (Jawa-Jawa 50 kg, any Luar Jawa route 100 kg), for both per-kg layanan.
    const minimum = isLtl || isLcl ? routeMinimumKg(origin.kategori_origin, tarif.wilayah_tujuan) : null;
    const pricing = calculatePricing({
      basePricePerKg: ratePublish,
      originCategory: origin.kategori_origin,
      beratKg,
      jumlahKoli,
      minimumKg: minimum?.kg ?? 0,
      markup: isLcl ? lclOriginMarkup(origin.kategori_origin) : undefined,
    });
    if (!Number.isFinite(pricing.total) || pricing.total < 0) throw Errors.internal("Harga tidak dapat dihitung.");
    // ETA by route (backend decides; the frontend only shows it). Distance class = price_regions.jarak_jawa of each Luar
    // Jawa end (the same value the Rate Publish table shows); an unclassified region falls back to its province's average lead time.
    const isJauh = async (provinsi: string, jarak: string | null): Promise<boolean> => {
      if (jarak) return jarak === "JAUH";
      const r = await ctx.env.DB.prepare(
        `SELECT AVG(t.lead_max) AS a FROM price_tariffs t JOIN price_regions g ON g.id = t.region_id WHERE g.provinsi = ?`,
      ).bind(provinsi).first<{ a: number | null }>();
      return (r?.a ?? 0) >= ETA_JAUH_MIN_AVG_LEAD;
    };
    const jauh =
      (origin.kategori_origin === "LUAR_JAWA" && (await isJauh(str(asal.provinsi), origin.jarak_jawa))) ||
      (tarif.wilayah_tujuan === "LUAR_JAWA" && (await isJauh(str(tujuan.provinsi), tarif.jarak_tujuan)));
    const eta = routeEta(origin.kategori_origin, tarif.wilayah_tujuan, jauh);

    return ok({
      asal: { provinsi: str(asal.provinsi), kota: str(asal.kota) },
      tujuan: { provinsi: str(tujuan.provinsi), kota: str(tujuan.kota), kecamatan: str(tujuan.kecamatan), kategoriArea: tarif.kategori_area },
      beratKg,
      jumlahKoli,
      layananId: layananRow.id,
      layanan,
      ...pricing,
      minimumKg: minimum?.kg ?? 0,
      minimumKategori: minimum?.kategori ?? null,
      ratePublishTersedia: isLtl || isLcl,
      leadTimeMin: eta.min,
      leadTimeMax: eta.max,
      etaKategori: eta.kategori,
    });
  });
}
