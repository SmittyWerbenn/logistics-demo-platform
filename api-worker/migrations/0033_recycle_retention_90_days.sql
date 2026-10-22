-- Recycle Bin retention is now 90 days (was 30). Rows already in the bin get their expiry recalculated
-- from their own deleted_at so nothing already binned is purged on the old 30-day schedule.
UPDATE recycle_bin
SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at, '+90 days')
WHERE status = 'IN_BIN';
