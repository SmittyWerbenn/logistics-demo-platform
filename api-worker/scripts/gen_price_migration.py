"""Generates api-worker/migrations/0023_price_tariffs.sql from
assets/HARGA KARGO PUBLISH DOMESTIK.xlsx (the Harga Publish reference file).

The Excel is read-only input; prices are copied as-is (base price, never
marked up). Province headings are only tidied for display (typos/abbreviations).
Run: python3 api-worker/scripts/gen_price_migration.py   (needs openpyxl)
"""
import re
import openpyxl

SRC = "assets/HARGA KARGO PUBLISH DOMESTIK.xlsx"
OUT = "api-worker/migrations/0023_price_tariffs.sql"

PROVINSI = {
    "JAWA TENGAH": "Jawa Tengah", "JAWA BARAT": "Jawa Barat", "JAWA TMIUR": "Jawa Timur",
    "BALI": "Bali", "NTB": "Nusa Tenggara Barat", "NTT": "Nusa Tenggara Timur",
    "LAMPUNG": "Lampung", "BENGKULU": "Bengkulu", "SUMATRA SELATAN": "Sumatera Selatan",
    "JAMBI": "Jambi", "BANGKA BELITUNG": "Kepulauan Bangka Belitung", "PEKANBARU /RIAU": "Riau",
    "KEPULAUAN RIAU": "Kepulauan Riau", "SUMATRA BARAT": "Sumatera Barat", "SUMATRA UTARA": "Sumatera Utara",
    "ACEH": "Aceh", "KALBAR": "Kalimantan Barat", "KALSEL": "Kalimantan Selatan", "KALTENG": "Kalimantan Tengah",
    "KALTIM": "Kalimantan Timur", "KALTARA": "Kalimantan Utara", "SULAWESI SELATAN": "Sulawesi Selatan",
    "SULAWESI TENGAH": "Sulawesi Tengah", "SULAWESI BARAT": "Sulawesi Barat", "SULAWESI TENGGARA": "Sulawesi Tenggara",
    "SULAWESI UTARA": "Sulawesi Utara", "GORONTALO": "Gorontalo", "MALUKU": "Maluku", "MALUKU UTARA": "Maluku Utara",
    "PAPUA KOTA": "Papua Kota", "PAPUA BARAT": "Papua Barat", "PAPUA BARAT DAYA SORONG": "Papua Barat Daya (Sorong)",
    "PAPUA TENGAH ( NABIRE/TIMIKA)": "Papua Tengah (Nabire/Timika)", "PAPUA PEGUNUNGAN WAMENA": "Papua Pegunungan (Wamena)",
    "PAPUA SELATAN (MAUREKE)": "Papua Selatan (Merauke)", "JAKARTA": "DKI Jakarta", "BANTEN": "Banten",
    "DIY JOGJAKARTA": "DI Yogyakarta",
}
JAWA = {"DKI Jakarta", "Banten", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur"}
# Jabodetabek = all of DKI Jakarta + these Kab/Kota (matched by master name).
JABODETABEK_KAB = {
    ("Banten", "Kota Tangerang"), ("Banten", "Kab. Tangerang"), ("Banten", "Kota Tangerang Selatan"),
    ("Jawa Barat", "Kab. Bogor"), ("Jawa Barat", "Kota Bogor"), ("Jawa Barat", "Kota Depok"),
    ("Jawa Barat", "Kab. Bekasi"), ("Jawa Barat", "Kota Bekasi"),
}

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

def norm(s):
    return re.sub(r"\s+", " ", str(s)).strip()

def kategori(prov, kab):
    if prov == "DKI Jakarta" or (prov, kab) in JABODETABEK_KAB:
        return "JABODETABEK"
    return "JAWA" if prov in JAWA else "LUAR_JAWA"

ws = openpyxl.load_workbook(SRC, data_only=True).active
regions, rows, cur = {}, {}, None
for r in ws.iter_rows(values_only=True):
    a, b, c, d, e = (r + (None,) * 5)[:5]
    if a is None and b is None and d is None:
        continue
    if a and b is None and d is None:
        cur = PROVINSI[norm(a).upper()]
        continue
    if norm(a) == "Kabupaten / Kota":
        continue
    kab = norm(a)
    regions.setdefault((cur, kab), len(regions) + 1)
    kec = norm(b)
    m = re.match(r"(\d+)\D+(\d+)", str(e))
    rows.setdefault((cur, kab, kec), (norm(c), int(d), norm(e).replace("–", "-") if False else norm(e), int(m.group(1)), int(m.group(2))))

out = ["""-- Master Harga Publish (domestik), imported from
-- assets/HARGA KARGO PUBLISH DOMESTIK.xlsx by api-worker/scripts/gen_price_migration.py.
--
-- tarif_per_kg is the BASE (publish) price per kg, Jabodetabek-origin. It is never
-- stored marked up: the origin markup (0% / 15% / 25%) is applied at calculation
-- time from price_regions.kategori_origin of the ORIGIN region.
--  * price_regions: one row per Provinsi + Kabupaten/Kota (the master wilayah used
--    for both origin and destination in Cek Ongkir) and its origin category.
--  * price_tariffs: one row per Kecamatan (destination) with tarif, area category
--    and lead time exactly as in the Excel.
-- Additive only: no existing table is touched.
CREATE TABLE IF NOT EXISTS price_regions (
  id INTEGER PRIMARY KEY,
  provinsi TEXT NOT NULL,
  kabupaten_kota TEXT NOT NULL,
  kategori_origin TEXT NOT NULL CHECK (kategori_origin IN ('JABODETABEK','JAWA','LUAR_JAWA')),
  UNIQUE (provinsi, kabupaten_kota)
);
CREATE TABLE IF NOT EXISTS price_tariffs (
  id INTEGER PRIMARY KEY,
  region_id INTEGER NOT NULL REFERENCES price_regions(id),
  kecamatan TEXT NOT NULL,
  kategori_area TEXT NOT NULL,
  tarif_per_kg INTEGER NOT NULL,
  lead_time TEXT NOT NULL,
  lead_min INTEGER NOT NULL,
  lead_max INTEGER NOT NULL,
  UNIQUE (region_id, kecamatan)
);
CREATE INDEX IF NOT EXISTS idx_price_tariffs_region ON price_tariffs(region_id);
"""]
rv = [f"({i},{q(p)},{q(k)},{q(kategori(p,k))})" for (p, k), i in regions.items()]
out.append("INSERT INTO price_regions (id, provinsi, kabupaten_kota, kategori_origin) VALUES\n" + ",\n".join(rv) + ";\n")
tv = [f"({regions[(p,k)]},{q(kec)},{q(cat)},{t},{q(lt)},{lo},{hi})" for (p, k, kec), (cat, t, lt, lo, hi) in rows.items()]
for i in range(0, len(tv), 100):
    out.append("INSERT OR IGNORE INTO price_tariffs (region_id, kecamatan, kategori_area, tarif_per_kg, lead_time, lead_min, lead_max) VALUES\n" + ",\n".join(tv[i:i+100]) + ";\n")
open(OUT, "w").write("\n".join(out))
print(len(regions), "regions,", len(rows), "kecamatan")
