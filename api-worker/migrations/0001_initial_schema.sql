-- Initial production schema for GMS Tracking & Resi Digital.
-- Deterministic: safe to run against an empty D1 database.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Superadmin','Admin','Driver','Viewer')),
  aktif INTEGER NOT NULL DEFAULT 1,
  foto_file_id TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip TEXT
);
CREATE UNIQUE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  nama_kota TEXT NOT NULL,
  kode_kota TEXT NOT NULL,
  provinsi TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('Gudang','Hub','Transit','Cabang','Tujuan')),
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX idx_locations_aktif ON locations(aktif);
CREATE INDEX idx_locations_nama_kota ON locations(nama_kota);

CREATE TABLE drivers (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  telepon TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE trucks (
  id TEXT PRIMARY KEY,
  nomor_unit TEXT NOT NULL,
  jenis TEXT NOT NULL,
  kapasitas TEXT NOT NULL,
  driver_id TEXT REFERENCES drivers(id),
  status TEXT NOT NULL CHECK (status IN ('Available','On Trip','Maintenance','Inactive')),
  keterangan TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);
CREATE UNIQUE INDEX idx_trucks_nomor_unit ON trucks(nomor_unit);
CREATE INDEX idx_trucks_status ON trucks(status);

CREATE TABLE shipments (
  awb TEXT PRIMARY KEY,
  tanggal_dibuat TEXT NOT NULL,
  jam_dibuat TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Dalam Persiapan','Berangkat','Transit','Dalam Perjalanan','Kendala','Tiba di Tujuan','Selesai / Terkirim')),
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
  updated_by TEXT
);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tanggal_dibuat ON shipments(tanggal_dibuat);
CREATE INDEX idx_shipments_truck_id ON shipments(truck_id);
CREATE INDEX idx_shipments_kota_asal ON shipments(kota_asal);
CREATE INDEX idx_shipments_kota_tujuan ON shipments(kota_tujuan);

CREATE TABLE shipment_timeline_events (
  id TEXT PRIMARY KEY,
  awb TEXT NOT NULL REFERENCES shipments(awb),
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  lokasi TEXT NOT NULL,
  titik_id TEXT REFERENCES locations(id),
  tanggal TEXT NOT NULL,
  jam TEXT NOT NULL,
  keterangan TEXT NOT NULL DEFAULT '',
  truck_id TEXT REFERENCES trucks(id),
  truck_sebelumnya_id TEXT REFERENCES trucks(id),
  input_by_user_id TEXT REFERENCES users(id),
  input_by_name TEXT,
  input_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_timeline_awb ON shipment_timeline_events(awb, seq);

CREATE TABLE shipment_pod (
  awb TEXT PRIMARY KEY REFERENCES shipments(awb),
  tanggal TEXT NOT NULL,
  jam TEXT NOT NULL,
  lokasi TEXT NOT NULL,
  nama_penerima TEXT NOT NULL,
  catatan TEXT,
  delivered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  awb TEXT NOT NULL REFERENCES shipments(awb),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('AWB_CREATED','KENDALA','SELESAI')),
  subject TEXT NOT NULL,
  to_email TEXT NOT NULL,
  to_name TEXT NOT NULL,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('penerima','pengirim')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notifications_awb ON notifications(awb);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  awb TEXT NOT NULL REFERENCES shipments(awb),
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  submitted_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_feedback_awb ON feedback(awb);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  user_name TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  action_label TEXT NOT NULL,
  module TEXT NOT NULL,
  awb TEXT,
  description TEXT NOT NULL,
  ip TEXT
);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_module ON audit_log(module);
CREATE INDEX idx_audit_awb ON audit_log(awb);
CREATE INDEX idx_audit_user_id ON audit_log(user_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- Generic file metadata (section 3 of the production spec): the actual
-- bytes live in MinIO/R2-compatible object storage, D1 only ever stores
-- pointers to them.
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_files_object_key ON files(object_key);
CREATE INDEX idx_files_entity ON files(entity_type, entity_id);
