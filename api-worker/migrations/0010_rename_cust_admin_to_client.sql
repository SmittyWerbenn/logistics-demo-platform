-- Rename role "Cust-Admin" → "Client" in the users table.
-- SQLite/D1 cannot ALTER a CHECK constraint, so we recreate the table.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Superadmin','Admin','Driver','Viewer','Client')),
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
  SELECT id, nama, email, password_hash,
         CASE WHEN role = 'Cust-Admin' THEN 'Client' ELSE role END,
         aktif, foto_file_id, last_login_at, created_at, updated_at, created_by, updated_by, customer_id
  FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_customer_id ON users(customer_id);

PRAGMA foreign_keys=ON;