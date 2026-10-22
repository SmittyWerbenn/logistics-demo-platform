-- SLA input by admin; estimasi_tiba (already exists, previously unused)
-- is the system-calculated ETA derived from it. Nullable - old shipments
-- and any shipment created without an SLA simply have no ETA to show.
ALTER TABLE shipments ADD COLUMN sla_value INTEGER;
ALTER TABLE shipments ADD COLUMN sla_unit TEXT;
