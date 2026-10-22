-- Armada Dedicated: GMS (Admin/Superadmin) assigns a Master Armada unit to ONE Client. A Client only
-- ever sees/uses its own ACTIVE assignments. Un-assigning flips the row to INACTIVE (never deleted), so
-- history stays intact; shipments keep their truck_id regardless of later assignment changes.
CREATE TABLE fleet_client_assignments (
  id TEXT PRIMARY KEY,
  truck_id TEXT NOT NULL REFERENCES trucks(id),
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  assigned_by_user_id TEXT,
  assigned_by_name TEXT NOT NULL,
  assigned_by_role TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  assignment_reason TEXT,
  unassigned_by_user_id TEXT,
  unassigned_by_name TEXT,
  unassigned_by_role TEXT,
  unassigned_at TEXT,
  unassignment_reason TEXT
);
CREATE INDEX idx_fca_customer ON fleet_client_assignments(customer_id, status);
CREATE INDEX idx_fca_truck ON fleet_client_assignments(truck_id, status);
-- Default rule: one dedicated unit -> one Client at a time. A second simultaneous assign hits this index.
CREATE UNIQUE INDEX idx_fca_one_active_per_truck ON fleet_client_assignments(truck_id) WHERE status = 'ACTIVE';
