-- Demo clone only: uploaded images kept in D1 when DEMO_MODE=true, so the
-- demo runs without MinIO/Docker. Never used by the production GMS worker.
CREATE TABLE IF NOT EXISTS demo_files (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  body BLOB NOT NULL,
  created_at TEXT NOT NULL
);
