-- Ekspedisi Order & Price Management (Phase 1): customer master, route master,
-- living price table (+ change log), orders (+ status history), PAD receivables.

CREATE TABLE IF NOT EXISTS ep_customers (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  npwp TEXT,
  pic TEXT,
  telepon TEXT,
  email TEXT,
  alamat TEXT,
  payment_scheme TEXT NOT NULL DEFAULT 'PAD',   -- PAD | TOP | CASH
  term_days INTEGER NOT NULL DEFAULT 30,
  preferences TEXT,                              -- customer-specific know-how
  notes TEXT,
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS ep_routes (
  id TEXT PRIMARY KEY,
  asal TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  publish_rate INTEGER,                          -- default public rate
  unit TEXT NOT NULL DEFAULT 'kg',               -- kg | koli | flat
  transit_days INTEGER,
  notes TEXT,
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS ep_prices (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  sender_id TEXT,
  receiver_id TEXT,
  payer_id TEXT,
  goods_type TEXT,
  min_weight REAL,
  price INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ep_prices_route ON ep_prices(route_id);

CREATE TABLE IF NOT EXISTS ep_price_log (
  id TEXT PRIMARY KEY,
  price_id TEXT NOT NULL,
  old_price INTEGER,
  new_price INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'applied',        -- applied | pending | rejected
  requested_by TEXT,
  requested_at TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ep_price_log_price ON ep_price_log(price_id);

CREATE TABLE IF NOT EXISTS ep_orders (
  id TEXT PRIMARY KEY,
  resi TEXT NOT NULL UNIQUE,
  order_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Baru',
  route_id TEXT,
  sender_id TEXT,
  receiver_id TEXT,
  payer_id TEXT,
  goods_type TEXT,
  koli INTEGER,
  weight REAL,
  price INTEGER,
  price_unit TEXT,
  price_source TEXT,                             -- exact | route_sender | publish | manual
  total INTEGER,
  internal_note TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ep_orders_date ON ep_orders(order_date);

CREATE TABLE IF NOT EXISTS ep_order_status (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  at TEXT NOT NULL,
  by_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_ep_order_status_order ON ep_order_status(order_id);

CREATE TABLE IF NOT EXISTS ep_receivables (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  customer_id TEXT,
  invoice_no TEXT,
  amount INTEGER NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Belum Ditagih',  -- Belum Ditagih | Ditagih | Lunas
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ep_receivables_status ON ep_receivables(status);

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('ep.resi_format', 'EXP-{YYYY}-{NNNNN}', datetime('now')),
  ('ep.invoice_header', 'PT Sinartrans Logistics', datetime('now')),
  ('ep.invoice_bank', 'Bank BCA 000-000-0000 a.n. PT Sinartrans Logistics', datetime('now')),
  ('ep.invoice_footer', 'Terima kasih atas kepercayaan Anda.', datetime('now')),
  ('ep.pad_default_days', '30', datetime('now')),
  ('ep.price_approval', 'false', datetime('now'));
