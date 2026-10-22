-- Recycle Bin for Clients (see 0026): NULL = active.
ALTER TABLE clients ADD COLUMN deleted_at TEXT;
