-- Recycle Bin (soft delete) for Superadmin.
--
-- Entities that can be moved to the bin get a nullable deleted_at marker
-- (NULL = active). The marker alone decides visibility; everything else
-- about the deletion (who, why, when it expires, restore / purge history)
-- lives in the central recycle_bin table. Unique constraints are left as-is
-- on purpose: a binned row keeps reserving its identifier (email, nomor
-- unit, AWB, ...) so a restore can never collide with a newer active row.
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE trucks ADD COLUMN deleted_at TEXT;
ALTER TABLE locations ADD COLUMN deleted_at TEXT;
ALTER TABLE layanans ADD COLUMN deleted_at TEXT;
ALTER TABLE mitras ADD COLUMN deleted_at TEXT;
ALTER TABLE shipments ADD COLUMN deleted_at TEXT;

CREATE TABLE IF NOT EXISTS recycle_bin (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  label TEXT NOT NULL,
  sublabel TEXT,
  snapshot TEXT,
  status TEXT NOT NULL DEFAULT 'IN_BIN' CHECK (status IN ('IN_BIN','RESTORED','PURGED')),
  deleted_by TEXT,
  deleted_by_name TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  delete_reason TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  restored_by TEXT,
  restored_by_name TEXT,
  restored_at TEXT,
  restore_reason TEXT,
  purged_by TEXT,
  purged_by_name TEXT,
  purged_at TEXT,
  purge_reason TEXT,
  purge_error TEXT
);
-- One live bin record per entity: the guard against two Superadmins
-- deleting the same row at once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recycle_one_live ON recycle_bin(entity_type, entity_id) WHERE status = 'IN_BIN';
CREATE INDEX IF NOT EXISTS idx_recycle_status_deleted ON recycle_bin(status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_recycle_expires ON recycle_bin(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_shipments_deleted ON shipments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);
