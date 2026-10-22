-- Custom CAPTCHA (public Contact quotation + Tracking). Short-lived rows only:
-- challenges live 5 min, human passes 15 min, both purged by the daily cron.
-- The answer is never stored in plaintext: only SHA-256(id:CODE).
CREATE TABLE IF NOT EXISTS captcha_challenges (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_captcha_expires ON captcha_challenges(expires_at);

-- Issued after a CAPTCHA is solved on Tracking; required by the public AWB lookup.
CREATE TABLE IF NOT EXISTS human_passes (
  token_hash TEXT PRIMARY KEY,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_human_passes_expires ON human_passes(expires_at);

-- Fixed-window request counters shared by every Worker isolate (the in-memory limiters are per-isolate).
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Quotation requests accepted through the Contact form.
CREATE TABLE IF NOT EXISTS quotation_requests (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  perusahaan TEXT,
  email TEXT NOT NULL,
  telepon TEXT NOT NULL,
  jenis_pengiriman TEXT NOT NULL,
  asal TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  pesan TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotation_created ON quotation_requests(created_at);
