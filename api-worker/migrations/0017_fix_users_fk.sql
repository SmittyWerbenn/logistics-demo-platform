-- Fix foreign keys left dangling by 0016_mitra.sql.
--
-- 0016 widened users.role by renaming the old table to users_legacy_pre_mitra
-- and creating a new users table. SQLite rewrites FOREIGN KEY references in
-- every child table when their parent is renamed, so these six tables now
-- reference users_legacy_pre_mitra(id) instead of users(id):
--   audit_log, driver_position_reports, drivers, files, sessions,
--   shipment_timeline_events
-- Consequence: any user created after 0016 is missing from the legacy table,
-- so inserting a session (login) / audit row / file for that user fails with
-- "FOREIGN KEY constraint failed".
--
-- Fix: rebuild each of the six tables so its REFERENCES points at users(id).
-- No data is deleted or modified - every row is copied across verbatim.
--
--  * audit_log, driver_position_reports, files, sessions,
--    shipment_timeline_events have no child tables of their own, so the old
--    table is just RENAMED to <name>_legacy_0017 and kept (never dropped).
--    The old named indexes travel with the renamed table, so they are
--    dropped first and recreated on the new one.
--
--  * drivers IS referenced by trucks.driver_id and shipments.claim_driver_id.
--    Renaming it would rewrite those references (the exact bug being fixed
--    here), so it is rebuilt in place: rows are copied into
--    drivers_backup_0017, drivers is dropped and recreated, and the rows are
--    copied back. defer_foreign_keys postpones the foreign-key check to
--    COMMIT (unlike PRAGMA foreign_keys=OFF, it is honoured inside the
--    transaction wrangler wraps around a migration file); by COMMIT every
--    driver row exists again, so no violation remains. If anything is still
--    inconsistent the whole migration rolls back untouched.
--
-- Backup/legacy tables are intentionally left in place; they can be dropped
-- manually once the result has been verified.

PRAGMA defer_foreign_keys = ON;

-- ---------------------------------------------------------------- sessions
ALTER TABLE sessions RENAME TO sessions_legacy_0017;
DROP INDEX IF EXISTS idx_sessions_expires_at;
DROP INDEX IF EXISTS idx_sessions_token_hash;
DROP INDEX IF EXISTS idx_sessions_user_id;

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
INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at, user_agent, ip)
  SELECT id, user_id, token_hash, created_at, expires_at, revoked_at, user_agent, ip FROM sessions_legacy_0017;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE UNIQUE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- --------------------------------------------------------------- audit_log
ALTER TABLE audit_log RENAME TO audit_log_legacy_0017;
DROP INDEX IF EXISTS idx_audit_action;
DROP INDEX IF EXISTS idx_audit_awb;
DROP INDEX IF EXISTS idx_audit_module;
DROP INDEX IF EXISTS idx_audit_timestamp;
DROP INDEX IF EXISTS idx_audit_user_id;

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
INSERT INTO audit_log (id, timestamp, user_id, user_name, role, action, action_label, module, awb, description, ip)
  SELECT id, timestamp, user_id, user_name, role, action, action_label, module, awb, description, ip FROM audit_log_legacy_0017;
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_awb ON audit_log(awb);
CREATE INDEX idx_audit_module ON audit_log(module);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_user_id ON audit_log(user_id);

-- ------------------------------------------------------------------- files
ALTER TABLE files RENAME TO files_legacy_0017;
DROP INDEX IF EXISTS idx_files_entity;
DROP INDEX IF EXISTS idx_files_object_key;

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
INSERT INTO files (id, object_key, filename, mime_type, size_bytes, uploaded_by, entity_type, entity_id, created_at)
  SELECT id, object_key, filename, mime_type, size_bytes, uploaded_by, entity_type, entity_id, created_at FROM files_legacy_0017;
CREATE INDEX idx_files_entity ON files(entity_type, entity_id);
CREATE UNIQUE INDEX idx_files_object_key ON files(object_key);

-- ------------------------------------------------- driver_position_reports
ALTER TABLE driver_position_reports RENAME TO driver_position_reports_legacy_0017;
DROP INDEX IF EXISTS idx_driver_position_reports_awb;
DROP INDEX IF EXISTS idx_driver_position_reports_driver;

CREATE TABLE driver_position_reports (
  id TEXT PRIMARY KEY,
  awb TEXT NOT NULL REFERENCES shipments(awb),
  driver_user_id TEXT NOT NULL REFERENCES users(id),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  created_at TEXT NOT NULL
);
INSERT INTO driver_position_reports (id, awb, driver_user_id, latitude, longitude, accuracy, created_at)
  SELECT id, awb, driver_user_id, latitude, longitude, accuracy, created_at FROM driver_position_reports_legacy_0017;
CREATE INDEX idx_driver_position_reports_awb ON driver_position_reports(awb, created_at);
CREATE INDEX idx_driver_position_reports_driver ON driver_position_reports(driver_user_id, created_at);

-- -------------------------------------------------- shipment_timeline_events
ALTER TABLE shipment_timeline_events RENAME TO shipment_timeline_events_legacy_0017;
DROP INDEX IF EXISTS idx_timeline_awb;

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
INSERT INTO shipment_timeline_events (id, awb, seq, type, lokasi, titik_id, tanggal, jam, keterangan, truck_id, truck_sebelumnya_id, input_by_user_id, input_by_name, input_at, created_at)
  SELECT id, awb, seq, type, lokasi, titik_id, tanggal, jam, keterangan, truck_id, truck_sebelumnya_id, input_by_user_id, input_by_name, input_at, created_at FROM shipment_timeline_events_legacy_0017;
CREATE INDEX idx_timeline_awb ON shipment_timeline_events(awb, seq);

-- ----------------------------------------------------------------- drivers
-- Referenced by trucks / shipments: rebuild in place (see header).
CREATE TABLE drivers_backup_0017 AS SELECT id, nama, telepon, created_at, updated_at, user_id FROM drivers;
DROP TABLE drivers;
CREATE TABLE drivers (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  telepon TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id)
);
INSERT INTO drivers (id, nama, telepon, created_at, updated_at, user_id)
  SELECT id, nama, telepon, created_at, updated_at, user_id FROM drivers_backup_0017;
CREATE UNIQUE INDEX idx_drivers_user_id ON drivers(user_id);
