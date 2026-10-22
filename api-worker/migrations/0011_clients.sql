-- Master data Client. Before this, a "client" only existed implicitly as a
-- customer_id string on Client accounts / shipments. This table lets an
-- admin create a Client (Client ID + name) up front, then pick it from a
-- dropdown when adding a Client/Viewer user or creating shipments.
CREATE TABLE IF NOT EXISTS clients (
  customer_id TEXT PRIMARY KEY COLLATE NOCASE,
  nama TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

-- Backfill every Client ID already in use so nothing disappears from the
-- list. Name = the first Client account's name for that ID, else the ID.
INSERT OR IGNORE INTO clients (customer_id, nama, created_at)
  SELECT u.customer_id,
         (SELECT u2.nama FROM users u2 WHERE u2.customer_id = u.customer_id AND u2.role = 'Client' ORDER BY u2.created_at ASC LIMIT 1),
         MIN(u.created_at)
  FROM users u WHERE u.customer_id IS NOT NULL AND u.role = 'Client'
  GROUP BY u.customer_id;

INSERT OR IGNORE INTO clients (customer_id, nama, created_at)
  SELECT s.customer_id, s.customer_id, MIN(s.created_at)
  FROM shipments s WHERE s.customer_id IS NOT NULL
  GROUP BY s.customer_id;
