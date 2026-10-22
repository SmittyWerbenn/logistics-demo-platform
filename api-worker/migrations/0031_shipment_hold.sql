-- Hold Pengiriman: adds the "Hold" shipment status plus the shipment_holds history.
--
-- Hold = the order/AWB exists and stays valid (e.g. for invoicing the buyer) but is
-- parked: it must not reach any Driver/Mitra operational flow until the creator
-- releases it. It is NOT a cancellation.
--
-- shipments.status has a CHECK listing the valid values and SQLite can't alter a
-- CHECK in place, so shipments is rebuilt exactly like 0025 did: rows copied to
-- shipments_backup_0031, table dropped and recreated (same columns/indexes, only the
-- status CHECK is wider), rows copied back with FK checking deferred to COMMIT.
-- If anything were inconsistent the whole migration rolls back untouched. The backup
-- table is intentionally kept - drop it manually after verifying.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE shipments_backup_0031 AS SELECT * FROM shipments;
DROP TABLE shipments;

CREATE TABLE shipments (
  awb TEXT PRIMARY KEY,
  tanggal_dibuat TEXT NOT NULL,
  jam_dibuat TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Dalam Persiapan','Berangkat','Transit','Dalam Perjalanan','Kendala','Tiba di Tujuan','Selesai / Terkirim','Dibatalkan','Re-route','Penarikan','Hold')),
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
  mitra_id TEXT REFERENCES mitras(kode_mitra),
  deleted_at TEXT,
  created_by_role TEXT,
  created_by_name TEXT
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
  customer_id, mitra_id, deleted_at, created_by_role, created_by_name
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
  customer_id, mitra_id, deleted_at, created_by_role, created_by_name
FROM shipments_backup_0031;

CREATE INDEX idx_shipments_customer_id ON shipments(customer_id);
CREATE INDEX idx_shipments_kota_asal ON shipments(kota_asal);
CREATE INDEX idx_shipments_kota_tujuan ON shipments(kota_tujuan);
CREATE INDEX idx_shipments_mitra_id ON shipments(mitra_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tanggal_dibuat ON shipments(tanggal_dibuat);
CREATE INDEX idx_shipments_truck_id ON shipments(truck_id);
CREATE INDEX idx_shipments_deleted ON shipments(deleted_at);
CREATE INDEX idx_shipments_deleted_created ON shipments(deleted_at, tanggal_dibuat, jam_dibuat);

-- One row per Hold episode (never overwritten): who/when/why it was held, which
-- status it must return to, and who/when/why it was released.
CREATE TABLE shipment_holds (
  id TEXT PRIMARY KEY,
  awb TEXT NOT NULL REFERENCES shipments(awb),
  previous_status TEXT NOT NULL,
  hold_reason TEXT NOT NULL,
  hold_at TEXT NOT NULL,
  hold_by_user_id TEXT,
  hold_by_name TEXT NOT NULL,
  hold_by_role TEXT NOT NULL,
  released_at TEXT,
  released_by_user_id TEXT,
  released_by_name TEXT,
  released_by_role TEXT,
  release_reason TEXT
);
CREATE INDEX idx_shipment_holds_awb ON shipment_holds(awb, hold_at);
-- A second simultaneous Hold hits this index: at most one open Hold per order.
CREATE UNIQUE INDEX idx_shipment_holds_one_open ON shipment_holds(awb) WHERE released_at IS NULL;
