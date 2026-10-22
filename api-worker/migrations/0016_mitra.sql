-- Adds the "Mitra" role (third-party partner agent accounts) plus a
-- Master Mitra table. A Mitra account logs in through the existing
-- admin login/dashboard (no separate portal) and only ever sees
-- shipments explicitly forwarded/assigned to its own Mitra via
-- shipments.mitra_id - mirrors how Client accounts are scoped by
-- customer_id.
--
-- users.role has a CHECK constraint that SQLite/D1 cannot alter in
-- place, so the table must be rebuilt to widen it (same underlying
-- need as migrations 0007/0010).
--
-- IMPORTANT - why this does NOT use the 0007/0010 "DROP TABLE users"
-- pattern: six tables carry a live `REFERENCES users(id)` with real
-- production rows (sessions, audit_log, drivers, shipment_timeline_
-- events, files, driver_position_reports). PRAGMA foreign_keys=OFF is
-- a documented no-op once a transaction is already open
-- (sqlite.org/pragma.html#pragma_foreign_keys), and
-- `wrangler d1 migrations apply` wraps the whole file in one implicit
-- transaction - so a straight DROP TABLE users here fails with
-- FOREIGN KEY constraint failed (confirmed against production).
-- 0007/0010 rebuilt the same table successfully in the past only
-- because they were never run through `migrations apply` (neither is
-- recorded in d1_migrations) - almost certainly applied via a plain
-- `wrangler d1 execute --remote --file=...`, which does not wrap in a
-- transaction and so let the pragma actually take effect.
--
-- Instead of depending on that same pragma/transaction behavior, this
-- migration avoids ever dropping a table with live incoming FK
-- references at all: the old `users` table is renamed out of the way
-- (a rename never deletes rows, so it can never violate a FK,
-- regardless of transaction/pragma state) and permanently left in
-- place as `users_legacy_pre_mitra` rather than dropped. The app never
-- runs `PRAGMA foreign_keys=ON` for normal queries (checked: no such
-- pragma anywhere outside migration files), so the now-stale
-- REFERENCES clauses in those six tables (still structurally pointing
-- at the renamed-away table, per SQLite's default reference-rewrite-
-- on-rename behavior) are never actually enforced at runtime - this is
-- purely a safe, inert leftover. This lets the whole file run through
-- the normal `wrangler d1 migrations apply --remote` with no special
-- execution method and no manual d1_migrations bookkeeping.

CREATE TABLE IF NOT EXISTS mitras (
  kode_mitra TEXT PRIMARY KEY COLLATE NOCASE,
  nama TEXT NOT NULL,
  pic TEXT,
  telepon TEXT,
  email TEXT,
  alamat TEXT,
  area TEXT,
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_mitras_aktif ON mitras(aktif);

CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Superadmin','Admin','Driver','Viewer','Client','Mitra')),
  aktif INTEGER NOT NULL DEFAULT 1,
  foto_file_id TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  customer_id TEXT,
  mitra_id TEXT REFERENCES mitras(kode_mitra)
);

INSERT INTO users_new (id, nama, email, password_hash, role, aktif, foto_file_id, last_login_at, created_at, updated_at, created_by, updated_by, customer_id, mitra_id)
  SELECT id, nama, email, password_hash, role, aktif, foto_file_id, last_login_at, created_at, updated_at, created_by, updated_by, customer_id, NULL
  FROM users;

-- Rename (never drop) the old table - see note above.
ALTER TABLE users RENAME TO users_legacy_pre_mitra;
ALTER TABLE users_new RENAME TO users;

-- The old named indexes (idx_users_email/role/customer_id) stayed
-- attached to the renamed-away legacy table, which still "owns" those
-- names in sqlite_master - drop them there (index drops are always
-- FK-safe) so the names are free for the new `users` table below.
-- Otherwise `CREATE INDEX IF NOT EXISTS` would silently no-op, leaving
-- the live `users` table without them.
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_customer_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id);
CREATE INDEX IF NOT EXISTS idx_users_mitra_id ON users(mitra_id);

-- Which Mitra (if any) a shipment has been forwarded/assigned to -
-- separate from truck_id (the Driver/unit assignment). Chain is
-- Client -> Shipment -> Mitra -> Driver: a shipment can have a mitra_id
-- and/or a truck_id independently.
ALTER TABLE shipments ADD COLUMN mitra_id TEXT REFERENCES mitras(kode_mitra);
CREATE INDEX IF NOT EXISTS idx_shipments_mitra_id ON shipments(mitra_id);
