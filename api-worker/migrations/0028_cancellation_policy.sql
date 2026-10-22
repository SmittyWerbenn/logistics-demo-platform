-- Controlled order cancellation.
--
-- 1) shipments.created_by_role / created_by_name: who created the order and in which
--    role, frozen at creation time (created_by already holds the user id). The
--    cancel rules follow the CREATOR, not the user clicking the button. Existing
--    orders are backfilled from users; rows whose creator can't be resolved stay
--    NULL and are treated as Client-owned (the strict path) when they have a
--    customer_id.
-- 2) cancellation_requests: GMS staff asking a Client to cancel one of the
--    Client's orders. The order status is never touched until the Client approves.
ALTER TABLE shipments ADD COLUMN created_by_role TEXT;
ALTER TABLE shipments ADD COLUMN created_by_name TEXT;

UPDATE shipments SET
  created_by_role = (SELECT u.role FROM users u WHERE u.id = shipments.created_by),
  created_by_name = (SELECT u.nama FROM users u WHERE u.id = shipments.created_by)
WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id TEXT PRIMARY KEY,
  awb TEXT NOT NULL REFERENCES shipments(awb),
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN','EXPIRED')),
  order_status_at_request TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_by_user_id TEXT,
  decided_by_name TEXT,
  decided_by_role TEXT,
  decided_at TEXT,
  decision_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_cancel_req_awb ON cancellation_requests(awb, requested_at);
CREATE INDEX IF NOT EXISTS idx_cancel_req_customer ON cancellation_requests(customer_id, status);
-- Two simultaneous requests for one order: the second one hits this index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cancel_req_one_pending ON cancellation_requests(awb) WHERE status = 'PENDING';
