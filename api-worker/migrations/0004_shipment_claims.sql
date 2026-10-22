-- Lets an unassigned shipment (truck_id IS NULL) be claimed by a driver,
-- pending admin confirmation, instead of always being assigned directly.
ALTER TABLE shipments ADD COLUMN claim_status TEXT;
ALTER TABLE shipments ADD COLUMN claim_driver_id TEXT REFERENCES drivers(id);
ALTER TABLE shipments ADD COLUMN claim_requested_at TEXT;
