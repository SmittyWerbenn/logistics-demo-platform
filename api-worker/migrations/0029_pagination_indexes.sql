-- Indexes backing the server-side paginated lists (filter -> sort -> LIMIT/OFFSET).
CREATE INDEX IF NOT EXISTS idx_audit_user_name ON audit_log(user_name);
CREATE INDEX IF NOT EXISTS idx_shipments_deleted_created ON shipments(deleted_at, tanggal_dibuat, jam_dibuat);
CREATE INDEX IF NOT EXISTS idx_locations_deleted_jenis ON locations(deleted_at, jenis);
CREATE INDEX IF NOT EXISTS idx_locations_nama_area ON locations(nama_area);
CREATE INDEX IF NOT EXISTS idx_feedback_submitted ON feedback(submitted_at);
CREATE INDEX IF NOT EXISTS idx_trucks_deleted_nomor ON trucks(deleted_at, nomor_unit);
