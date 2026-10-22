-- Rate Publish maintenance from the Portal Admin. price_tariffs stays THE rate storage used by Cek Ongkir
-- (no pricing logic changes); this only adds "who/when" on each tariff and a per-record before/after history.
ALTER TABLE price_tariffs ADD COLUMN updated_at TEXT;
ALTER TABLE price_tariffs ADD COLUMN updated_by_name TEXT;

CREATE TABLE IF NOT EXISTS price_tariff_history (
  id TEXT PRIMARY KEY,
  tariff_id INTEGER NOT NULL,
  old_tarif INTEGER NOT NULL,
  new_tarif INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('EDIT','BULK')),
  batch_id TEXT,
  changed_at TEXT NOT NULL,
  changed_by_user_id TEXT,
  changed_by_name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_tariff_history_tariff ON price_tariff_history(tariff_id, changed_at);
