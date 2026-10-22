-- Tracks whether a notification has been seen in the admin notification
-- center, so the bell badge can reflect an actual unread count instead of
-- the total. Shared read state (not per-admin-user) - matches the small
-- admin team this app is built for.
ALTER TABLE notifications ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN read_at TEXT;
