-- Adds "Dibatalkan" (Cancelled) as a valid shipments.status value, for the
-- new self-service cancel-order feature. SQLite can't ALTER a CHECK
-- constraint directly, so this rebuilds shipments with the widened CHECK,
-- preserving every column added by prior migrations (0003 SLA/ETA, 0004
-- claims, 0007 customer_id) and every row unchanged (awb values are kept
-- identical, so every FK-referencing child table - shipment_timeline_events,
-- shipment_pod, notifications, feedback, driver_position_reports - stays
-- valid across the rebuild).

PRAGMA foreign_keys=OFF;

CREATE TABLE shipments_new (
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
  layanan TEXT NOT NULL CHECK (layanan IN ('Darat','Express','Kargo','Regular','Charter')),
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
  customer_id TEXT
);

INSERT INTO shipments_new SELECT
  awb, tanggal_dibuat, jam_dibuat, status,
  pengirim_nama, pengirim_telepon, pengirim_email,
  penerima_nama, penerima_telepon, penerima_email,
  alamat_asal, kota_asal, alamat_tujuan, kota_tujuan,
  deskripsi_barang, layanan, berat_kg, jumlah_koli, truck_id,
  email_terkirim, email_terkirim_at, estimasi_tiba,
  created_at, updated_at, created_by, updated_by,
  sla_value, sla_unit, claim_status, claim_driver_id, claim_requested_at,
  customer_id
FROM shipments;

DROP TABLE shipments;
ALTER TABLE shipments_new RENAME TO shipments;

CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tanggal_dibuat ON shipments(tanggal_dibuat);
CREATE INDEX idx_shipments_truck_id ON shipments(truck_id);
CREATE INDEX idx_shipments_kota_asal ON shipments(kota_asal);
CREATE INDEX idx_shipments_kota_tujuan ON shipments(kota_tujuan);
CREATE INDEX idx_shipments_customer_id ON shipments(customer_id);

PRAGMA foreign_keys=ON;
