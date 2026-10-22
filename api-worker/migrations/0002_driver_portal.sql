-- Links a Driver-role login account (users.id) to its truck-driver master
-- record (drivers.id), which previously had no relationship at all - this
-- is what lets the driver portal scope shipments to "mine only".
ALTER TABLE drivers ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE UNIQUE INDEX idx_drivers_user_id ON drivers(user_id);

-- Manual, button-press position reports from the driver portal (not
-- continuous/polled tracking).
CREATE TABLE driver_position_reports (
  id TEXT PRIMARY KEY,
  awb TEXT NOT NULL REFERENCES shipments(awb),
  driver_user_id TEXT NOT NULL REFERENCES users(id),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_driver_position_reports_awb ON driver_position_reports(awb, created_at);
CREATE INDEX idx_driver_position_reports_driver ON driver_position_reports(driver_user_id, created_at);
