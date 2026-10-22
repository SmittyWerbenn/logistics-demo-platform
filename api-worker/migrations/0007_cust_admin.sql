-- Adds the "Cust-Admin" role (a restricted, customer-scoped account: same
-- base permissions as Viewer + can create shipments, but only ever sees
-- shipments tagged with its own customer_id) and a customer_id tag on both
-- users and shipments.
--
-- users.role has a CHECK constraint that SQLite/D1 cannot alter in place,
-- so the table is recreated with the widened CHECK (verified safe against
-- a throwaway sandbox table pair first - PRAGMA foreign_keys=OFF is
-- required for the DROP TABLE step to succeed while other tables still
-- have FK columns referencing users(id); the FK relationships resolve
-- correctly again once the table is renamed back to "users").

PRAGMA foreign_keys=OFF;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Superadmin','Admin','Driver','Viewer','Cust-Admin')),
  aktif INTEGER NOT NULL DEFAULT 1,
  foto_file_id TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  customer_id TEXT
);

INSERT INTO users_new (id, nama, email, password_hash, role, aktif, foto_file_id, last_login_at, created_at, updated_at, created_by, updated_by, customer_id)
  SELECT id, nama, email, password_hash, role, aktif, foto_file_id, last_login_at, created_at, updated_at, created_by, updated_by, NULL
  FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_customer_id ON users(customer_id);

PRAGMA foreign_keys=ON;

-- Free-text tag (no separate master table for now - just a consistent
-- identifier string, e.g. "IDTMDI001") copied onto every shipment so a
-- Cust-Admin's visibility can be filtered by it.
ALTER TABLE shipments ADD COLUMN customer_id TEXT;
CREATE INDEX idx_shipments_customer_id ON shipments(customer_id);
