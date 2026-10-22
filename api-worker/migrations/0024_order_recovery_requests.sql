-- Request Pemulihan Order: a Client asks GMS to restore a cancelled shipment;
-- GMS Admin / Superadmin approve or reject. This is a PROCESS table - the order's
-- own status stays in shipments.status ("Dibatalkan" until an approval restores it).
-- Additive only: no existing table is touched.
CREATE TABLE IF NOT EXISTS order_recovery_requests (
  id TEXT PRIMARY KEY,
  awb TEXT NOT NULL REFERENCES shipments(awb),
  customer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reason TEXT,
  requested_by_user_id TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  reviewed_by_name TEXT,
  reviewed_at TEXT,
  rejection_reason TEXT,
  restored_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_recovery_awb ON order_recovery_requests(awb, requested_at);
CREATE INDEX IF NOT EXISTS idx_recovery_status ON order_recovery_requests(status, requested_at);
-- DB-level guard: at most one PENDING request per order, even under concurrent calls.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_one_pending ON order_recovery_requests(awb) WHERE status = 'PENDING';
