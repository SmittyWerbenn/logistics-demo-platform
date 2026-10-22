/**
 * GMS Demo clone - generates api-worker/seed/demo_seed.sql.
 *
 * All data below is fictional. Run via `npm run demo:seed` (see
 * scripts/seed-demo.sh) or directly:
 *   node api-worker/scripts/generate-demo-seed.mjs
 *
 * Dates are generated relative to "today" (WIB), so the demo always looks
 * fresh: shipments spread over the last 30 days, timelines consistent with
 * each status.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../seed/demo_seed.sql");

const PASSWORD = "Demo2026!";
const WIB_MS = 7 * 3600 * 1000;
const NOW = new Date();

const b64url = (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$100000$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}

const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const rows = (table, cols, list) =>
  `INSERT INTO ${table} (${cols.join(", ")}) VALUES\n` + list.map((r) => `  (${r.map(q).join(", ")})`).join(",\n") + ";\n";

/* ---------------------------------------------------------------- time ---- */
function wib(date) {
  const iso = new Date(date.getTime() + WIB_MS).toISOString();
  return { tanggal: iso.slice(0, 10), jam: iso.slice(11, 16) };
}
function isoAt(tanggal, jam) {
  return new Date(`${tanggal}T${jam}:00+07:00`).toISOString();
}
/** A moment `days` ago at the given WIB wall-clock time. */
function moment(days, jam = "09:00") {
  const d = new Date(NOW.getTime() - days * 86_400_000);
  const tanggal = wib(d).tanggal;
  return { tanggal, jam, iso: isoAt(tanggal, jam), date: new Date(isoAt(tanggal, jam)) };
}
function plusHours(base, hours) {
  const d = new Date(base.getTime() + hours * 3_600_000);
  const p = wib(d);
  return { tanggal: p.tanggal, jam: p.jam, iso: isoAt(p.tanggal, p.jam), date: new Date(isoAt(p.tanggal, p.jam)) };
}

/* ------------------------------------------------------------- masters ---- */
const CLIENTS = [
  { id: "ACME", nama: "PT Acme Retail Indonesia", kota: "Jakarta", aktif: 1, kontrak: "KTR/ACME/2026/011", pic: "Andi Wijaya", telp: "0812-1100-2201", email: "andi.wijaya@acme-retail.co.id" },
  { id: "NUSA", nama: "PT Nusantara Distribusi Utama", kota: "Surabaya", aktif: 1, kontrak: "KTR/NUSA/2026/007", pic: "Rina Kartika", telp: "0813-2200-3302", email: "rina.kartika@nusantara-dist.co.id" },
  { id: "SMBR", nama: "CV Sumber Makmur", kota: "Bandung", aktif: 1, kontrak: "KTR/SMBR/2026/003", pic: "Hadi Sucipto", telp: "0815-3300-4403", email: "hadi@sumbermakmur.co.id" },
  { id: "GRDA", nama: "PT Garuda Tekstil Nusantara", kota: "Semarang", aktif: 1, kontrak: "KTR/GRDA/2026/019", pic: "Maya Anggraini", telp: "0817-4400-5504", email: "maya@garudatekstil.co.id" },
  { id: "SDRH", nama: "PT Sederhana Retail (nonaktif)", kota: "Yogyakarta", aktif: 0, kontrak: null, pic: "Tono Saputra", telp: "0819-5500-6605", email: "tono@sederhana-retail.co.id" },
];

const MITRAS = [
  { kode: "MITRA01", nama: "PT Lintas Nusantara Express", pic: "Hendra Gunawan", telepon: "0811-6000-7701", email: "ops@lintasnusantara.co.id", alamat: "Jl. Kedungdoro No. 141, Surabaya", area: "Jawa Timur", aktif: 1 },
  { kode: "MITRA02", nama: "CV Samudra Cargo Medan", pic: "Faisal Nasution", telepon: "0812-6000-7702", email: "admin@samudracargo.co.id", alamat: "Jl. Sisingamangaraja No. 77, Medan", area: "Sumatera Utara", aktif: 1 },
];

const LOCATIONS = [
  ["loc-jkt", "Jakarta", "JKT", "DKI Jakarta", "Gudang", "Hub Jakarta (Cakung)", "Jabodetabek"],
  ["loc-sby", "Surabaya", "SBY", "Jawa Timur", "Hub", "Hub Surabaya (Rungkut)", "Jawa Timur"],
  ["loc-bdg", "Bandung", "BDG", "Jawa Barat", "Cabang", "Cabang Bandung (Cimahi)", "Jawa Barat"],
  ["loc-smg", "Semarang", "SMG", "Jawa Tengah", "Transit", "Transit Semarang (Kaligawe)", "Jawa Tengah"],
  ["loc-mdn", "Medan", "MDN", "Sumatera Utara", "Cabang", "Cabang Medan (Medan Perjuangan)", "Sumatera Utara"],
  ["loc-mks", "Makassar", "MKS", "Sulawesi Selatan", "Hub", "Hub Makassar (Perintis)", "Sulawesi Selatan"],
  ["loc-dps", "Denpasar", "DPS", "Bali", "Tujuan", "Agen Denpasar", "Bali"],
  ["loc-yog", "Yogyakarta", "YOG", "DI Yogyakarta", "Transit", "Transit Yogyakarta (Ringroad)", "DI Yogyakarta"],
  ["loc-plm", "Palembang", "PLM", "Sumatera Selatan", "Tujuan", "Agen Palembang", "Sumatera Selatan"],
  ["loc-bpn", "Balikpapan", "BPN", "Kalimantan Timur", "Tujuan", "Agen Balikpapan", "Kalimantan Timur"],
  ["loc-btm", "Batam", "BTM", "Kepulauan Riau", "Tujuan", "Agen Batam", "Kepulauan Riau"],
  ["loc-mdo", "Manado", "MDO", "Sulawesi Utara", "Tujuan", "Agen Manado", "Sulawesi Utara"],
];

const DRIVERS = [
  ["drv-joko", "Joko Susilo", "0812-3456-7801", "u-driver"],
  ["drv-slamet", "Slamet Riyadi", "0812-3456-7802", null],
  ["drv-agus", "Agus Setiawan", "0812-3456-7803", null],
  ["drv-budi", "Budi Santoso", "0812-3456-7804", null],
  ["drv-wawan", "Wawan Hermawan", "0812-3456-7805", null],
  ["drv-sigit", "Sigit Prasetyo", "0812-3456-7806", null],
];

const TRUCKS = [
  ["trk-01", "B 9012 KCD", "CDD Box", "4 Ton", "drv-joko", "On Trip", "Dedicated Acme Retail"],
  ["trk-02", "B 9123 KCE", "Fuso Wingbox", "8 Ton", "drv-slamet", "Available", null],
  ["trk-03", "L 8001 AB", "Tronton Wingbox", "20 Ton", "drv-agus", "On Trip", null],
  ["trk-04", "L 8002 AC", "Trailer 40 FT", "28 Ton", "drv-budi", "Available", null],
  ["trk-05", "D 7001 XY", "CDD Bak", "4 Ton", "drv-wawan", "Maintenance", "Servis rutin 10.000 km"],
  ["trk-06", "H 6001 QQ", "Fuso Bak", "8 Ton", "drv-sigit", "Available", "Dedicated Nusantara"],
  ["trk-07", "B 9555 TR", "CDD Losbak", "4 Ton", null, "Inactive", "Unit lama, menunggu lelang"],
  ["trk-08", "AB 1234 CD", "Pickup", "1 Ton", null, "Available", null],
];

const LAYANAN = [
  ["Darat", "Pengiriman darat reguler antar kota dengan jadwal keberangkatan harian."],
  ["Express", "Layanan prioritas, estimasi tiba lebih cepat untuk kebutuhan mendesak."],
  ["Kargo", "Pengiriman barang dalam jumlah besar dengan tarif per kilogram yang ekonomis."],
  ["Regular", "Layanan standar dengan keseimbangan harga dan waktu tempuh."],
  ["Charter", "Sewa armada penuh untuk satu kali perjalanan sesuai kebutuhan."],
  ["LTL", "Less than Truck Load - kirim sebagian muatan, bayar sesuai berat aktual."],
  ["FTL", "Full Truck Load - satu armada penuh untuk satu pengiriman."],
];
const SLA = { Express: 2, Charter: 2, FTL: 3, Regular: 4, LTL: 5, Darat: 6, Kargo: 7 };

const CITY_ADDR = {
  Jakarta: "Jl. Raya Cakung Cilincing No. 88, Jakarta Utara",
  Surabaya: "Jl. Rungkut Industri III No. 42, Surabaya",
  Bandung: "Jl. Soekarno Hatta No. 512, Bandung",
  Semarang: "Jl. Arteri Yos Sudarso No. 17, Semarang",
  Medan: "Jl. Gatot Subroto No. 210, Medan",
  Makassar: "Jl. Perintis Kemerdekaan No. 99, Makassar",
  Denpasar: "Jl. By Pass Ngurah Rai No. 76, Denpasar",
  Yogyakarta: "Jl. Ringroad Utara No. 31, Yogyakarta",
  Palembang: "Jl. Kapten A. Rivai No. 55, Palembang",
  Balikpapan: "Jl. MT Haryono No. 12, Balikpapan",
  Batam: "Jl. Laksamana Bintan No. 8, Batam",
  Manado: "Jl. Sam Ratulangi No. 201, Manado",
};
const LOC_BY_CITY = Object.fromEntries(LOCATIONS.map((l) => [l[1], l[0]]));

/* ------------------------------------------------------------- people ----- */
const PEOPLE = {
  Andi: ["Andi Wijaya", "0812-1100-2201", "andi.wijaya@acme-retail.co.id"],
  Rina: ["Rina Kartika", "0813-2200-3302", "rina.kartika@nusantara-dist.co.id"],
  Hadi: ["Hadi Sucipto", "0815-3300-4403", "hadi@sumbermakmur.co.id"],
  Maya: ["Maya Anggraini", "0817-4400-5504", "maya@garudatekstil.co.id"],
  BudiP: ["Budi Prasetyo", "0812-7788-1010", "budi.prasetyo@contoh.id"],
  Sari: ["Sari Wulandari", "0812-7788-1011", "sari.wulandari@contoh.id"],
  Dimas: ["Dimas Ardhana", "0812-7788-1012", "dimas.ardhana@contoh.id"],
  Nurul: ["Nurul Hidayah", "0812-7788-1013", "nurul.hidayah@contoh.id"],
  Fajar: ["Fajar Ramadhan", "0812-7788-1014", "fajar.ramadhan@contoh.id"],
  Lestari: ["Lestari Ningsih", "0812-7788-1015", "lestari.ningsih@contoh.id"],
  Reza: ["Reza Maulana", "0812-7788-1016", "reza.maulana@contoh.id"],
  Indah: ["Indah Permata", "0812-7788-1017", "indah.permata@contoh.id"],
  Yudi: ["Yudi Kurniawan", "0812-7788-1018", "yudi.kurniawan@contoh.id"],
  Tania: ["Tania Kusuma", "0812-7788-1019", "tania.kusuma@contoh.id"],
  Bayu: ["Bayu Nugroho", "0812-7788-1020", "bayu.nugroho@contoh.id"],
  Wulan: ["Wulan Safitri", "0812-7788-1021", "wulan.safitri@contoh.id"],
  Arif: ["Arif Budiman", "0812-7788-1022", "arif.budiman@contoh.id"],
  Mega: ["Mega Puspita", "0812-7788-1023", "mega.puspita@contoh.id"],
  Rizky: ["Rizky Ananda", "0812-7788-1024", "rizky.ananda@contoh.id"],
  Galih: ["Galih Saputra", "0812-7788-1025", "galih.saputra@contoh.id"],
  Nadia: ["Nadia Rahmawati", "0812-7788-1026", "nadia.rahmawati@contoh.id"],
  Hendra: ["Hendra Kusnadi", "0812-7788-1027", "hendra.kusnadi@contoh.id"],
  Putri: ["Putri Amelia", "0812-7788-1028", "putri.amelia@contoh.id"],
  Sigit: ["Sigit Hartanto", "0812-7788-1029", "sigit.hartanto@contoh.id"],
  Ayu: ["Ayu Lestari", "0812-7788-1030", "ayu.lestari@contoh.id"],
};

/* ---------------------------------------------------------- shipments ----- */
/**
 * Compact shipment spec. Timeline is derived from the status via CHAIN, so
 * every resi immediately has a believable, ordered tracking history.
 *  client | status | daysAgo | jam | layanan | asal | tujuan | receiver key |
 *  item | berat | koli | truckIdx | mitra | asuransi(nilaiRp) | reference |
 *  createdBy | note
 */
const SPECS = [
  // --- Dalam Persiapan (6) ------------------------------------------------
  { c: "ACME", st: "Dalam Persiapan", d: 0, jam: "08:20", l: "LTL", a: "Jakarta", t: "Surabaya", p: "BudiP", item: "Elektronik konsumen (40 karton)", kg: 320, koli: 40, trk: null, asr: 45_000_000, ref: "PO-AC-2611", by: "admin" },
  { c: "ACME", st: "Dalam Persiapan", d: 0, jam: "10:05", l: "Express", a: "Jakarta", t: "Medan", p: "Sari", item: "Produk perawatan tubuh (18 karton)", kg: 145, koli: 18, trk: null, asr: null, ref: "PO-AC-2612", by: "admin" },
  { c: "NUSA", st: "Dalam Persiapan", d: 1, jam: "09:40", l: "Regular", a: "Surabaya", t: "Makassar", p: "Dimas", item: "Makanan kemasan (60 karton)", kg: 480, koli: 60, trk: null, asr: null, ref: "PO-NU-2607", by: "client" },
  { c: "SMBR", st: "Dalam Persiapan", d: 1, jam: "13:15", l: "Kargo", a: "Bandung", t: "Semarang", p: "Nurul", item: "Tekstil dan garmen (25 roll)", kg: 620, koli: 25, trk: null, asr: 120_000_000, ref: "PO-SM-2603", by: "admin" },
  { c: "GRDA", st: "Dalam Persiapan", d: 2, jam: "11:30", l: "FTL", a: "Semarang", t: "Jakarta", p: "Fajar", item: "Furniture knock-down (18 koli)", kg: 850, koli: 18, trk: 3, asr: null, ref: "PO-GR-2604", by: "admin", note: "Butuh armada pickup, barang ringan volume besar" },
  { c: "ACME", st: "Dalam Persiapan", d: 2, jam: "15:45", l: "LTL", a: "Jakarta", t: "Balikpapan", p: "Lestari", item: "Alat tulis kantor (30 karton)", kg: 210, koli: 30, trk: null, asr: null, ref: "PO-AC-2613", by: "client", claim: true },

  // --- Hold (1) ------------------------------------------------------------
  { c: "NUSA", st: "Hold", d: 1, jam: "16:10", l: "Regular", a: "Surabaya", t: "Palembang", p: "Reza", item: "Spare part mesin (12 palet)", kg: 740, koli: 12, trk: null, asr: 65_000_000, ref: "PO-NU-2608", by: "admin", hold: "Menunggu konfirmasi pembayaran invoice INV/2026/10/0088 sebelum barang diproses." },

  // --- Berangkat (3) -------------------------------------------------------
  { c: "ACME", st: "Berangkat", d: 1, jam: "07:30", l: "LTL", a: "Jakarta", t: "Yogyakarta", p: "Indah", item: "Elektronik konsumen (24 karton)", kg: 260, koli: 24, trk: 0, asr: null, ref: "PO-AC-2609", by: "admin" },
  { c: "GRDA", st: "Berangkat", d: 2, jam: "06:45", l: "Darat", a: "Semarang", t: "Bandung", p: "Yudi", item: "Tekstil dan garmen (14 roll)", kg: 390, koli: 14, trk: 5, asr: null, ref: "PO-GR-2603", by: "admin" },
  { c: "SMBR", st: "Berangkat", d: 1, jam: "08:15", l: "Express", a: "Bandung", t: "Jakarta", p: "Tania", item: "Komponen otomotif (9 palet)", kg: 540, koli: 9, trk: 1, asr: 88_000_000, ref: "PO-SM-2602", by: "admin" },

  // --- Transit (4) ---------------------------------------------------------
  { c: "ACME", st: "Transit", d: 3, jam: "09:10", l: "LTL", a: "Jakarta", t: "Denpasar", p: "Bayu", item: "Furniture knock-down (22 koli)", kg: 610, koli: 22, trk: 2, asr: null, ref: "PO-AC-2607", by: "admin" },
  { c: "NUSA", st: "Transit", d: 3, jam: "10:25", l: "Kargo", a: "Surabaya", t: "Manado", p: "Wulan", item: "Makanan kemasan (80 karton)", kg: 960, koli: 80, trk: 3, mitra: "MITRA01", asr: null, ref: "PO-NU-2605", by: "admin" },
  { c: "ACME", st: "Transit", d: 4, jam: "13:40", l: "Regular", a: "Jakarta", t: "Makassar", p: "Arif", item: "Elektronik konsumen (32 karton)", kg: 430, koli: 32, trk: 0, asr: 150_000_000, ref: "PO-AC-2605", by: "admin" },
  { c: "GRDA", st: "Transit", d: 4, jam: "15:05", l: "LTL", a: "Semarang", t: "Medan", p: "Mega", item: "Tekstil dan garmen (30 roll)", kg: 720, koli: 30, trk: 5, mitra: "MITRA02", asr: null, ref: "PO-GR-2602", by: "admin" },

  // --- Dalam Perjalanan (3) ------------------------------------------------
  { c: "ACME", st: "Dalam Perjalanan", d: 3, jam: "06:20", l: "Express", a: "Jakarta", t: "Surabaya", p: "Rizky", item: "Produk perawatan tubuh (26 karton)", kg: 190, koli: 26, trk: 0, asr: null, ref: "PO-AC-2604", by: "client" },
  { c: "NUSA", st: "Dalam Perjalanan", d: 3, jam: "07:55", l: "Regular", a: "Surabaya", t: "Balikpapan", p: "Galih", item: "Spare part mesin (7 palet)", kg: 380, koli: 7, trk: 2, asr: 72_500_000, ref: "PO-NU-2604", by: "admin" },
  { c: "SMBR", st: "Dalam Perjalanan", d: 2, jam: "08:40", l: "Kargo", a: "Bandung", t: "Palembang", p: "Nadia", item: "Alat tulis kantor (44 karton)", kg: 350, koli: 44, trk: 1, asr: null, ref: "PO-SM-2601", by: "admin" },

  // --- Kendala (2) ---------------------------------------------------------
  { c: "ACME", st: "Kendala", d: 5, jam: "10:30", l: "LTL", a: "Jakarta", t: "Batam", p: "Hendra", item: "Furniture knock-down (16 koli)", kg: 470, koli: 16, trk: 2, asr: null, ref: "PO-AC-2602", by: "admin", note: "Kapal tujuan Batam delay cuaca, dijadwalkan ulang." },
  { c: "NUSA", st: "Kendala", d: 6, jam: "14:20", l: "Express", a: "Surabaya", t: "Makassar", p: "Putri", item: "Elektronik konsumen (12 karton)", kg: 160, koli: 12, trk: 3, asr: 95_000_000, ref: "PO-NU-2602", by: "admin", note: "Alamat penerima tidak ditemukan, menunggu konfirmasi customer." },

  // --- Tiba di Tujuan (2) --------------------------------------------------
  { c: "ACME", st: "Tiba di Tujuan", d: 4, jam: "08:05", l: "Regular", a: "Jakarta", t: "Semarang", p: "Sigit", item: "Alat tulis kantor (20 karton)", kg: 180, koli: 20, trk: 0, asr: null, ref: "PO-AC-2603", by: "admin" },
  { c: "GRDA", st: "Tiba di Tujuan", d: 5, jam: "11:15", l: "Darat", a: "Semarang", t: "Yogyakarta", p: "Ayu", item: "Tekstil dan garmen (18 roll)", kg: 460, koli: 18, trk: 5, asr: 60_000_000, ref: "PO-GR-2601", by: "client" },

  // --- Selesai / Terkirim (6) ---------------------------------------------
  { c: "ACME", st: "Selesai / Terkirim", d: 7, jam: "09:00", l: "Express", a: "Jakarta", t: "Bandung", p: "BudiP", item: "Elektronik konsumen (15 karton)", kg: 120, koli: 15, trk: 0, asr: 25_000_000, ref: "PO-AC-2601", by: "admin", pod: "Diterima oleh resepsionis, kondisi karton baik.", rating: 5, comment: "Pengiriman cepat, barang sampai dengan aman." },
  { c: "ACME", st: "Selesai / Terkirim", d: 10, jam: "10:40", l: "LTL", a: "Jakarta", t: "Surabaya", p: "Sari", item: "Produk perawatan tubuh (38 karton)", kg: 280, koli: 38, trk: 2, asr: null, ref: "PO-AC-2598", by: "client", pod: "Diterima oleh staf gudang penerima.", rating: 4, comment: "Barang lengkap, estimasi tiba sesuai." },
  { c: "NUSA", st: "Selesai / Terkirim", d: 12, jam: "08:30", l: "Kargo", a: "Surabaya", t: "Makassar", p: "Dimas", item: "Makanan kemasan (70 karton)", kg: 840, koli: 70, trk: 3, mitra: "MITRA01", asr: 40_000_000, ref: "PO-NU-2597", by: "admin", pod: "Diterima oleh kepala gudang cabang Makassar.", rating: 5, comment: "Tracking jelas, tim CS responsif." },
  { c: "NUSA", st: "Selesai / Terkirim", d: 15, jam: "13:20", l: "Regular", a: "Surabaya", t: "Jakarta", p: "Nurul", item: "Komponen otomotif (11 palet)", kg: 690, koli: 11, trk: 6, asr: 180_000_000, ref: "PO-NU-2595", by: "admin", pod: "Diterima oleh teknisi bengkel mitra.", rating: 4, comment: "Packing rapi, pengiriman tepat waktu." },
  { c: "SMBR", st: "Selesai / Terkirim", d: 18, jam: "09:50", l: "Darat", a: "Bandung", t: "Semarang", p: "Fajar", item: "Tekstil dan garmen (22 roll)", kg: 510, koli: 22, trk: 1, asr: null, ref: "PO-SM-2594", by: "client", pod: "Diterima oleh penerima langsung.", rating: 5, comment: "Driver komunikatif dan membantu bongkar muat." },
  { c: "GRDA", st: "Selesai / Terkirim", d: 22, jam: "11:10", l: "FTL", a: "Semarang", t: "Surabaya", p: "Lestari", item: "Furniture knock-down (40 koli)", kg: 1_250, koli: 40, trk: 3, asr: null, ref: "PO-GR-2592", by: "admin", pod: "Diterima oleh tim ekspedisi gudang penerima." },

  // --- Dibatalkan (2) ------------------------------------------------------
  { c: "ACME", st: "Dibatalkan", d: 9, jam: "14:35", l: "LTL", a: "Jakarta", t: "Manado", p: "Indah", item: "Elektronik konsumen (10 karton)", kg: 90, koli: 10, trk: null, asr: null, ref: "PO-AC-2596", by: "client", cancelReason: "Pesanan ganda dari customer (duplikat PO-AC-2594)." },
  { c: "SMBR", st: "Dibatalkan", d: 20, jam: "16:00", l: "Regular", a: "Bandung", t: "Batam", p: "Arif", item: "Alat tulis kantor (12 karton)", kg: 110, koli: 12, trk: null, asr: null, ref: "PO-SM-2590", by: "admin", cancelReason: "Customer membatalkan PO sebelum barang dipickup." },
];

const CHAIN = {
  "Dalam Persiapan": [["Barang Diterima", 0]],
  Hold: [["Barang Diterima", 0]],
  Berangkat: [["Barang Diterima", 0], ["Berangkat", 3]],
  Transit: [["Barang Diterima", 0], ["Berangkat", 3], ["Transit", 27]],
  "Dalam Perjalanan": [["Barang Diterima", 0], ["Berangkat", 3], ["Transit", 27], ["Dalam Perjalanan", 41]],
  Kendala: [["Barang Diterima", 0], ["Berangkat", 3], ["Transit", 27], ["Dalam Perjalanan", 41], ["Kendala", 52]],
  "Tiba di Tujuan": [["Barang Diterima", 0], ["Berangkat", 3], ["Transit", 27], ["Dalam Perjalanan", 41], ["Tiba di Tujuan", 55]],
  "Selesai / Terkirim": [["Barang Diterima", 0], ["Berangkat", 3], ["Transit", 27], ["Dalam Perjalanan", 41], ["Tiba di Tujuan", 55], ["Selesai / Terkirim", 60]],
  Dibatalkan: [["Barang Diterima", 0]],
};

const EVENT_NOTE = {
  "Barang Diterima": (kota) => `Barang diterima di gudang ${kota} dan siap dikirim.`,
  Berangkat: (kota) => `Armada berangkat dari hub ${kota} menuju kota tujuan.`,
  Transit: () => "Barang tiba di hub transit dan menunggu armada lanjutan.",
  "Dalam Perjalanan": () => "Barang dalam perjalanan menuju kota tujuan.",
  Kendala: () => "",
  "Tiba di Tujuan": (kota) => `Barang tiba di hub ${kota}, menunggu proses pengantaran.`,
  "Selesai / Terkirim": (kota) => `Barang diserahkan dan diterima di ${kota}.`,
};

/* ---------------------------------------------------------------- build --- */
const userRows = [];
const users = [
  ["u-superadmin", "Rudi Hartono", "superadmin@gms-demo.id", "Superadmin", null, null],
  ["u-admin", "Sinta Maharani", "admin@gms-demo.id", "Admin", null, null],
  ["u-admin2", "Bayu Pratama", "ops@gms-demo.id", "Admin", null, null],
  ["u-viewer", "Dewi Lestari", "viewer@gms-demo.id", "Viewer", null, null],
  ["u-client", "Andi Wijaya", "client@gms-demo.id", "Client", "ACME", null],
  ["u-client2", "Rina Kartika", "client2@gms-demo.id", "Client", "NUSA", null],
  ["u-driver", "Joko Susilo", "driver@gms-demo.id", "Driver", null, null],
  ["u-mitra", "Hendra Gunawan", "mitra@gms-demo.id", "Mitra", null, "MITRA01"],
];
const hashes = {};
for (const u of users) hashes[u[2]] = await hashPassword(PASSWORD);

const nowIso = NOW.toISOString();
for (const [id, nama, email, role, cust, mitra] of users) {
  userRows.push([id, nama, email, hashes[email], role, 1, null, role === "Superadmin" ? nowIso : null, nowIso, nowIso, "u-superadmin", "u-superadmin", cust, mitra]);
}

const clientRows = CLIENTS.map((c) => [c.id, c.nama, isoAt("2026-01-05", "09:00"), "u-superadmin", c.kota, c.aktif, c.kontrak, c.aktif ? null : null]);
const mitraRows = MITRAS.map((m) => [m.kode, m.nama, m.pic, m.telepon, m.email, m.alamat, m.area, m.aktif, isoAt("2026-01-05", "09:00"), "u-superadmin", nowIso, "u-superadmin"]);
const driverRows = DRIVERS.map(([id, nama, telepon, user]) => [id, nama, telepon, nowIso, nowIso, user]);
const truckRows = TRUCKS.map(([id, nomor, jenis, kap, drv, status, ket]) => [id, nomor, jenis, kap, drv, status, ket, nowIso, nowIso, "u-superadmin", "u-superadmin"]);
const locRows = LOCATIONS.map(([id, kota, kode, prov, jenis, titik, area]) => [id, kota, kode, prov, jenis, 1, nowIso, nowIso, "u-superadmin", "u-superadmin", titik, area]);
const layananRows = LAYANAN.map(([nama, desk]) => [`layanan-${nama.toLowerCase()}`, nama, 1, nowIso, nowIso, desk]);

const shipmentRows = [];
const timelineRows = [];
const podRows = [];
const holdRows = [];
const cancelRows = [];
const recoveryRows = [];
const notificationRows = [];
const feedbackRows = [];
const seqByClient = {};
const creator = { admin: ["u-admin", "Admin", "Sinta Maharani"], admin2: ["u-admin2", "Admin", "Bayu Pratama"], client: ["u-client", "Client", "Andi Wijaya"] };

SPECS.forEach((s, idx) => {
  const client = CLIENTS.find((c) => c.id === s.c);
  const created = moment(s.d, s.jam);
  const seq = (seqByClient[s.c] = (seqByClient[s.c] ?? 0) + 1);
  const awb = `${s.c}${String(seq).padStart(4, "0")}`;
  const layanan = s.l;
  const sla = SLA[layanan] ?? 5;
  const eta = new Date(created.date.getTime() + sla * 86_400_000);
  const senderFinal = [client.pic, client.telp, client.email];
  const recv = PEOPLE[s.p];
  const chain = CHAIN[s.st];
  const lastEvent = plusHours(created.date, chain[chain.length - 1][1]);
  const truckId = s.trk === null || s.trk === undefined ? null : TRUCKS[s.trk][0];
  const createdBy = creator[s.by] ?? creator.admin;
  const emailSent = s.st === "Selesai / Terkirim" ? 1 : 0;

  shipmentRows.push([
    awb, created.tanggal, s.jam, s.st,
    senderFinal[0], senderFinal[1], senderFinal[2],
    recv[0], recv[1], recv[2],
    CITY_ADDR[s.a], s.a, CITY_ADDR[s.t], s.t,
    s.item, layanan, s.kg, s.koli, truckId,
    emailSent, emailSent ? plusHours(created.date, 62).iso : null,
    wib(eta).tanggal,
    created.iso, (s.st === "Selesai / Terkirim" ? plusHours(created.date, 60).iso : lastEvent.iso),
    createdBy[0], createdBy[0], sla, "Hari",
    s.claim ? "pending" : null, s.claim ? "drv-joko" : null, s.claim ? plusHours(created.date, 7).iso : null,
    client.id, s.mitra ?? null,
    null, createdBy[1], createdBy[2],
    s.ref, s.asr ? 1 : 0, s.asr ? `${62001 + idx}, ${62002 + idx}` : null, s.asr ?? null,
  ]);

  chain.forEach(([type, hours], i) => {
    const at = plusHours(created.date, hours);
    const kota = type === "Transit" ? "Semarang" : type === "Dalam Perjalanan" ? "Semarang" : type === "Tiba di Tujuan" || type === "Selesai / Terkirim" ? s.t : s.a;
    const titik = LOC_BY_CITY[kota] ?? LOC_BY_CITY[s.a];
    const note = type === "Kendala" ? s.note ?? "Kendala operasional, tim sedang menangani." : EVENT_NOTE[type](kota);
    timelineRows.push([
      `tl-${awb}-${i + 1}`, awb, i + 1, type, kota === s.a && type === "Barang Diterima" ? `Gudang ${s.a}` : kota,
      titik, at.tanggal, at.jam, note, truckId, null,
      type === "Barang Diterima" ? createdBy[0] : "u-admin", type === "Barang Diterima" ? createdBy[2] : "Sinta Maharani",
      at.iso, at.iso,
    ]);
  });

  if (s.st === "Selesai / Terkirim") {
    const done = plusHours(created.date, 60);
    podRows.push([awb, done.tanggal, done.jam, CITY_ADDR[s.t], s.pod ? recv[0] : recv[0], s.pod ?? null, done.iso, done.iso]);
  }
  if (s.hold) {
    holdRows.push([`hold-${awb}`, awb, "Dalam Persiapan", s.hold, created.iso, "u-admin", "Sinta Maharani", "Admin", null, null, null, null, null]);
  }
  if (s.st === "Dibatalkan") {
    cancelRows.push([`cr-${awb}`, awb, client.id, "APPROVED", "Dalam Persiapan", s.cancelReason, "u-client", client.pic, "Client", plusHours(created.date, 4).iso, "u-admin", "Sinta Maharani", "Admin", plusHours(created.date, 6).iso, "Disetujui, order dibatalkan sebelum pickup."]);
  }
  if (s.ref === "PO-AC-2596") {
    recoveryRows.push([`rr-${awb}`, awb, client.id, "PENDING", "Order dibatalkan karena salah input alamat, mohon diaktifkan kembali.", "u-client", client.pic, plusHours(created.date, 30).iso, null, null, null, null, null]);
  }

  // Notifications: AWB created for every shipment, SELESAI for delivered.
  notificationRows.push([`nt-${awb}-1`, awb, "AWB_CREATED", `Resi ${awb} telah dibuat`, recv[2], recv[0], "penerima", created.iso, idx % 3 === 0 ? 0 : 1, idx % 3 === 0 ? null : plusHours(created.date, 1).iso]);
  if (s.st === "Selesai / Terkirim") {
    const done = plusHours(created.date, 60);
    notificationRows.push([`nt-${awb}-2`, awb, "SELESAI", `Resi ${awb} telah diterima`, recv[2], recv[0], "penerima", done.iso, idx % 2 === 0 ? 1 : 0, idx % 2 === 0 ? done.iso : null]);
  }
  if (s.rating) {
    feedbackRows.push([`fb-${awb}`, awb, client.pic, s.rating, s.comment ?? null, plusHours(created.date, 66).iso]);
  }
});

// One client-requested cancellation still waiting for an admin decision.
cancelRows.push([
  "cr-ACME0002", "ACME0002", "ACME", "PENDING", "Dalam Persiapan",
  "Customer meminta pembatalan karena perubahan kebutuhan stok.",
  "u-client", "Andi Wijaya", "Client", moment(0, "11:00").iso,
  null, null, null, null, null,
]);

const settingsRows = [
  ["stagnant_threshold_days", "3"],
  ["email_sending_enabled", "false"],
  ["help_phone_number", "6281122334455"],
  ["help_whatsapp_admin", "6281122334455"],
  ["help_whatsapp_superadmin", "6281199887766"],
  ["contact_phone", "021-2200-8899"],
  ["contact_email", "cs@gms-logistics.co.id"],
  ["contact_hours", "Senin - Sabtu, 08.00 - 18.00 WIB"],
  ["office_head", "Jl. Rungkut Industri III No. 42, Surabaya"],
].map(([k, v]) => [k, v, nowIso, "u-superadmin"]);

const assignmentRows = [
  ["fca-01", "trk-01", "ACME", "ACTIVE", "u-superadmin", "Rudi Hartono", "Superadmin", moment(40, "09:00").iso, "Armada dedicated kontrak Acme Retail 2026."],
  ["fca-02", "trk-06", "NUSA", "ACTIVE", "u-admin", "Sinta Maharani", "Admin", moment(30, "10:00").iso, "Armada dedicated distribusi Nusantara."],
].map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], null, null, null, null, null]);

const quotationRows = [
  ["qr-01", "Fajar Nugraha", "PT Sinar Abadi", "fajar@sinar-abadi.contoh.id", "0813-9000-1101", "LTL", "Jakarta", "Makassar", "Butuh pengiriman rutin 2 kali seminggu, estimasi 300 kg per kiriman.", "127.0.0.1", moment(3, "10:20").iso],
  ["qr-02", "Clara Wijaya", "CV Mitra Boga", "clara@mitraboga.contoh.id", "0813-9000-1102", "FTL", "Bandung", "Surabaya", "Sewa tronton untuk pengiriman bahan baku bulanan.", "127.0.0.1", moment(6, "14:05").iso],
  ["qr-03", "Teguh Santoso", "PT Karya Logam", "teguh@karyalogam.contoh.id", "0813-9000-1103", "Kargo", "Semarang", "Medan", "Mohon penawaran untuk 1 ton spare part.", "127.0.0.1", moment(11, "09:35").iso],
];

const auditRows = [];
const auditSeed = [
  ["LOGIN_SUCCESS", "LOGIN SUCCESS", "Auth", "Sinta Maharani berhasil login.", "u-admin", "Sinta Maharani", "Admin", 0.2],
  ["SHIPMENT_CREATED", "SHIPMENT CREATED", "Shipment", "Order ACME0002 dibuat untuk PT Acme Retail Indonesia.", "u-admin", "Sinta Maharani", "Admin", 0.4],
  ["TRACKING_UPDATED", "TRACKING UPDATED", "Tracking", "Status ACME0004 diperbarui menjadi Berangkat.", "u-admin", "Sinta Maharani", "Admin", 1.2],
  ["LOGIN_SUCCESS", "LOGIN SUCCESS", "Auth", "Joko Susilo berhasil login melalui Portal Driver.", "u-driver", "Joko Susilo", "Driver", 1.6],
  ["SHIPMENT_CREATED", "SHIPMENT CREATED", "Shipment", "Order NUSA0007 dibuat oleh client.", "u-client2", "Rina Kartika", "Client", 2.1],
  ["SHIPMENT_HELD", "SHIPMENT HELD", "Hold", "Order NUSA0002 di-Hold: menunggu konfirmasi pembayaran.", "u-admin", "Sinta Maharani", "Admin", 2.4],
  ["TRACKING_UPDATED", "TRACKING UPDATED", "Tracking", "Status GRDA0003 diperbarui menjadi Transit.", "u-admin2", "Bayu Pratama", "Admin", 3.5],
  ["LOGIN_FAILED", "LOGIN FAILED", "Auth", "Percobaan login gagal untuk viewer@gms-demo.id.", null, "Tidak dikenal", "-", 4.0],
  ["CANCELLATION_APPROVED", "CANCELLATION APPROVED", "Cancellation", "Pembatalan ACME0012 disetujui.", "u-admin", "Sinta Maharani", "Admin", 5.2],
  ["SETTINGS_UPDATED", "SETTINGS UPDATED", "Settings", "Batas pengiriman macet diubah menjadi 3 hari.", "u-superadmin", "Rudi Hartono", "Superadmin", 6.1],
  ["FLEET_ASSIGNED", "FLEET ASSIGNED", "Fleet", "Armada B 9012 KCD di-assign ke Acme Retail.", "u-superadmin", "Rudi Hartono", "Superadmin", 7.3],
  ["LOGIN_SUCCESS", "LOGIN SUCCESS", "Auth", "Andi Wijaya berhasil login.", "u-client", "Andi Wijaya", "Client", 8.0],
  ["SHIPMENT_CREATED", "SHIPMENT CREATED", "Shipment", "Order SMBR0005 dibuat.", "u-admin", "Sinta Maharani", "Admin", 9.4],
  ["TRACKING_UPDATED", "TRACKING UPDATED", "Tracking", "Status ACME0010 diperbarui menjadi Selesai / Terkirim.", "u-admin", "Sinta Maharani", "Admin", 10.2],
  ["FEEDBACK_RECEIVED", "FEEDBACK RECEIVED", "Feedback", "Feedback 5 bintang diterima untuk ACME0010.", null, "Sistem", "-", 10.5],
  ["LOGIN_SUCCESS", "LOGIN SUCCESS", "Auth", "Hendra Gunawan berhasil login.", "u-mitra", "Hendra Gunawan", "Mitra", 12.0],
  ["CLIENT_CREATED", "CLIENT CREATED", "Client", "Client PT Garuda Tekstil Nusantara ditambahkan.", "u-superadmin", "Rudi Hartono", "Superadmin", 14.5],
  ["MITRA_CREATED", "MITRA CREATED", "Mitra", "Mitra CV Samudra Cargo Medan ditambahkan.", "u-superadmin", "Rudi Hartono", "Superadmin", 16.2],
  ["SHIPMENT_CREATED", "SHIPMENT CREATED", "Shipment", "Order GRDA0001 dibuat.", "u-client", "Maya Anggraini", "Client", 18.4],
  ["TRACKING_UPDATED", "TRACKING UPDATED", "Tracking", "Status NUSA0006 diperbarui menjadi Selesai / Terkirim.", "u-admin2", "Bayu Pratama", "Admin", 20.1],
];
auditSeed.forEach(([action, label, module, desc, uid, uname, role, hoursAgo], i) => {
  const at = new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString();
  auditRows.push([`aud-${String(i + 1).padStart(3, "0")}`, at, uid, uname, role, action, label, module, null, desc, "127.0.0.1"]);
});

/* ------------------------------------------------------------- SQL out ---- */
const seqRows = Object.entries(seqByClient).map(([cid, n]) => [cid, n, nowIso]);

let sql = `-- GMS Demo clone - fictional demo data. Generated by
-- api-worker/scripts/generate-demo-seed.mjs on ${nowIso}.
-- Password for every demo account: ${PASSWORD}
PRAGMA defer_foreign_keys = ON;

DELETE FROM sessions;
DELETE FROM audit_log;
DELETE FROM notifications;
DELETE FROM feedback;
DELETE FROM order_recovery_requests;
DELETE FROM cancellation_requests;
DELETE FROM shipment_holds;
DELETE FROM shipment_pod;
DELETE FROM shipment_timeline_events;
DELETE FROM shipments;
DELETE FROM files;
DELETE FROM driver_position_reports;
DELETE FROM fleet_client_assignments;
DELETE FROM trucks;
DELETE FROM drivers;
DELETE FROM users;
DELETE FROM mitras;
DELETE FROM clients;
DELETE FROM locations;
DELETE FROM awb_sequences;
DELETE FROM quotation_requests;
DELETE FROM demo_files;
DELETE FROM settings WHERE key IN ('stagnant_threshold_days','email_sending_enabled','help_phone_number','help_whatsapp_admin','help_whatsapp_superadmin','contact_phone','contact_email','contact_hours','office_head');

`;
sql += rows("clients", ["customer_id", "nama", "created_at", "created_by", "kota", "aktif", "kontrak_no_pelanggan", "deleted_at"], clientRows);
sql += rows("mitras", ["kode_mitra", "nama", "pic", "telepon", "email", "alamat", "area", "aktif", "created_at", "created_by", "updated_at", "updated_by"], mitraRows);
sql += rows("users", ["id", "nama", "email", "password_hash", "role", "aktif", "foto_file_id", "last_login_at", "created_at", "updated_at", "created_by", "updated_by", "customer_id", "mitra_id"], userRows);
sql += rows("drivers", ["id", "nama", "telepon", "created_at", "updated_at", "user_id"], driverRows);
sql += rows("trucks", ["id", "nomor_unit", "jenis", "kapasitas", "driver_id", "status", "keterangan", "created_at", "updated_at", "created_by", "updated_by"], truckRows);
sql += rows("locations", ["id", "nama_kota", "kode_kota", "provinsi", "jenis", "aktif", "created_at", "updated_at", "created_by", "updated_by", "nama_titik", "nama_area"], locRows);
sql += `INSERT OR IGNORE INTO layanans (id, nama, aktif, created_at, updated_at, deskripsi) VALUES\n` +
  LAYANAN.map(([nama, desk], i) => `  ('${`layanan-${nama.toLowerCase()}`}', ${q(nama)}, 1, ${q(nowIso)}, ${q(nowIso)}, ${q(desk)})`).join(",\n") + ";\n";
for (const [nama, desk] of LAYANAN) sql += `UPDATE layanans SET deskripsi = ${q(desk)} WHERE nama = ${q(nama)};\n`;
sql += rows("settings", ["key", "value", "updated_at", "updated_by"], settingsRows);
sql += rows("awb_sequences", ["client_id", "last_seq", "updated_at"], seqRows);
sql += rows("fleet_client_assignments", ["id", "truck_id", "customer_id", "status", "assigned_by_user_id", "assigned_by_name", "assigned_by_role", "assigned_at", "assignment_reason", "unassigned_by_user_id", "unassigned_by_name", "unassigned_by_role", "unassigned_at", "unassignment_reason"], assignmentRows);
sql += rows("shipments", [
  "awb", "tanggal_dibuat", "jam_dibuat", "status",
  "pengirim_nama", "pengirim_telepon", "pengirim_email",
  "penerima_nama", "penerima_telepon", "penerima_email",
  "alamat_asal", "kota_asal", "alamat_tujuan", "kota_tujuan",
  "deskripsi_barang", "layanan", "berat_kg", "jumlah_koli", "truck_id",
  "email_terkirim", "email_terkirim_at", "estimasi_tiba",
  "created_at", "updated_at", "created_by", "updated_by",
  "sla_value", "sla_unit", "claim_status", "claim_driver_id", "claim_requested_at",
  "customer_id", "mitra_id", "deleted_at", "created_by_role", "created_by_name",
  "reference", "asuransi", "koli_asuransi", "nilai_asuransi",
], shipmentRows);
sql += rows("shipment_timeline_events", [
  "id", "awb", "seq", "type", "lokasi", "titik_id", "tanggal", "jam", "keterangan",
  "truck_id", "truck_sebelumnya_id", "input_by_user_id", "input_by_name", "input_at", "created_at",
], timelineRows);
sql += rows("shipment_pod", ["awb", "tanggal", "jam", "lokasi", "nama_penerima", "catatan", "delivered_at", "updated_at"], podRows);
sql += rows("shipment_holds", ["id", "awb", "previous_status", "hold_reason", "hold_at", "hold_by_user_id", "hold_by_name", "hold_by_role", "released_at", "released_by_user_id", "released_by_name", "released_by_role", "release_reason"], holdRows);
sql += rows("cancellation_requests", ["id", "awb", "customer_id", "status", "order_status_at_request", "reason", "requested_by_user_id", "requested_by_name", "requested_by_role", "requested_at", "decided_by_user_id", "decided_by_name", "decided_by_role", "decided_at", "decision_reason"], cancelRows);
sql += rows("order_recovery_requests", ["id", "awb", "customer_id", "status", "reason", "requested_by_user_id", "requested_by_name", "requested_at", "reviewed_by_user_id", "reviewed_by_name", "reviewed_at", "rejection_reason", "restored_status"], recoveryRows);
sql += rows("notifications", ["id", "awb", "trigger_type", "subject", "to_email", "to_name", "recipient_role", "created_at", "is_read", "read_at"], notificationRows);
sql += rows("feedback", ["id", "awb", "customer_name", "rating", "comment", "submitted_at"], feedbackRows);
sql += rows("audit_log", ["id", "timestamp", "user_id", "user_name", "role", "action", "action_label", "module", "awb", "description", "ip"], auditRows);
sql += rows("quotation_requests", ["id", "nama", "perusahaan", "email", "telepon", "jenis_pengiriman", "asal", "tujuan", "pesan", "ip", "created_at"], quotationRows);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, sql, "utf8");
console.log(`Wrote ${OUT}`);
console.log(`  users=${userRows.length} clients=${clientRows.length} mitras=${mitraRows.length} drivers=${driverRows.length} trucks=${truckRows.length}`);
console.log(`  locations=${locRows.length} shipments=${shipmentRows.length} timeline=${timelineRows.length} pod=${podRows.length}`);
console.log(`  notifications=${notificationRows.length} feedback=${feedbackRows.length} audit=${auditRows.length}`);
