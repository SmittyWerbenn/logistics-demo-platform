-- Master Layanan.
--
-- 1) layanans: the managed list of shipment services. Seeded with the five
--    services shipments already use (Darat, Express, Kargo, Regular,
--    Charter), all active. LTL / FTL are deliberately NOT seeded - an admin
--    adds them from Master Layanan. (LTL is also the fallback service for
--    orders that arrive with an unknown/inactive layanan; the API warns when
--    it isn't configured.)
--
-- 2) shipments.layanan used to carry CHECK (layanan IN ('Darat','Express',
--    'Kargo','Regular','Charter')), which would reject LTL/FTL/custom
--    services. The valid set now lives in layanans and is enforced by the
--    API, so the CHECK is dropped. The five existing values stay valid, and
--    no shipment row is modified.
--
--    SQLite can't drop a CHECK in place, so shipments is rebuilt. It is
--    referenced by feedback, notifications, shipment_pod,
--    shipment_timeline_events and driver_position_reports, so (like
--    drivers in 0017) it is rebuilt in place under defer_foreign_keys: rows
--    are copied into shipments_backup_0018, shipments is dropped and
--    recreated, and the rows are copied back. The foreign-key check is
--    postponed to COMMIT, by which time every shipment row exists again;
--    if anything were inconsistent the whole migration rolls back untouched.
--    The backup table is intentionally kept; drop it manually after
--    verifying.

PRAGMA defer_foreign_keys = ON;

-- ---------------------------------------------------------------- layanans
CREATE TABLE IF NOT EXISTS layanans (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE COLLATE NOCASE,
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT OR IGNORE INTO layanans (id, nama, aktif, created_at, updated_at) VALUES
  ('layanan-darat',   'Darat',   1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('layanan-express', 'Express', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('layanan-kargo',   'Kargo',   1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('layanan-regular', 'Regular', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('layanan-charter', 'Charter', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- --------------------------------------------- shipments (drop layanan CHECK)
CREATE TABLE shipments_backup_0018 AS SELECT * FROM shipments;
DROP TABLE shipments;

CREATE TABLE shipments (
  awb TEXT PRIMARY KEY,
  tanggal_dibuat TEXT NOT NULL,
  jam_dibuat TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Dalam Persiapan','Berangkat','Transit','Dalam Perjalanan','Kendala','Tiba di Tujuan','Selesai / Terkirim','Dibatalkan')),
  pengirim_nama TEXT NOT NULL,
  pengirim_telepon TEXT NOT NULL,
  pengirim_email TEXT NOT NULL,
  penerima_nama TEXT NOT NULL,
  penerima_telepon TEXT NOT NULL,
  penerima_email TEXT NOT NULL,
  alamat_asal TEXT NOT NULL,
  kota_asal TEXT NOT NULL,
  alamat_tujuan TEXT NOT NULL,
  kota_tujuan TEXT NOT NULL,
  deskripsi_barang TEXT NOT NULL DEFAULT '',
  layanan TEXT NOT NULL,
  berat_kg REAL NOT NULL,
  jumlah_koli INTEGER NOT NULL,
  truck_id TEXT REFERENCES trucks(id),
  email_terkirim INTEGER NOT NULL DEFAULT 0,
  email_terkirim_at TEXT,
  estimasi_tiba TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  sla_value INTEGER,
  sla_unit TEXT,
  claim_status TEXT,
  claim_driver_id TEXT REFERENCES drivers(id),
  claim_requested_at TEXT,
  customer_id TEXT,
  mitra_id TEXT REFERENCES mitras(kode_mitra)
);

INSERT INTO shipments (
  awb, tanggal_dibuat, jam_dibuat, status,
  pengirim_nama, pengirim_telepon, pengirim_email,
  penerima_nama, penerima_telepon, penerima_email,
  alamat_asal, kota_asal, alamat_tujuan, kota_tujuan,
  deskripsi_barang, layanan, berat_kg, jumlah_koli, truck_id,
  email_terkirim, email_terkirim_at, estimasi_tiba,
  created_at, updated_at, created_by, updated_by,
  sla_value, sla_unit, claim_status, claim_driver_id, claim_requested_at,
  customer_id, mitra_id
)
SELECT
  awb, tanggal_dibuat, jam_dibuat, status,
  pengirim_nama, pengirim_telepon, pengirim_email,
  penerima_nama, penerima_telepon, penerima_email,
  alamat_asal, kota_asal, alamat_tujuan, kota_tujuan,
  deskripsi_barang, layanan, berat_kg, jumlah_koli, truck_id,
  email_terkirim, email_terkirim_at, estimasi_tiba,
  created_at, updated_at, created_by, updated_by,
  sla_value, sla_unit, claim_status, claim_driver_id, claim_requested_at,
  customer_id, mitra_id
FROM shipments_backup_0018;

CREATE INDEX idx_shipments_customer_id ON shipments(customer_id);
CREATE INDEX idx_shipments_kota_asal ON shipments(kota_asal);
CREATE INDEX idx_shipments_kota_tujuan ON shipments(kota_tujuan);
CREATE INDEX idx_shipments_mitra_id ON shipments(mitra_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tanggal_dibuat ON shipments(tanggal_dibuat);
CREATE INDEX idx_shipments_truck_id ON shipments(truck_id);
