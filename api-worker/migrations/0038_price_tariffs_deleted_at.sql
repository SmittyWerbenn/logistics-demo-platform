-- Recycle Bin for Rate Publish (price_tariffs): NULL = active.
ALTER TABLE price_tariffs ADD COLUMN deleted_at TEXT;
