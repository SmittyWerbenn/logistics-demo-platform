-- Per-Client AWB sequence. New AWBs are "{CLIENT_ID}{0000}" with a 4-digit
-- number that counts independently for every Client ID, e.g.
--   TATA0001, TATA0002 ...   and   AGHM0001, AGHM0002 ...
-- The counter is incremented with a single atomic UPDATE ... RETURNING, so two
-- shipments created at the same moment can never get the same number.
-- Existing AWBs (the old "G+YYMMDD+NNN" format) are NOT touched: this only
-- seeds each counter with the highest number already used for that Client ID,
-- so the next shipment continues after it.
CREATE TABLE IF NOT EXISTS awb_sequences (
  client_id TEXT PRIMARY KEY COLLATE NOCASE,
  last_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

-- Seed from existing AWBs that already follow "{CLIENT_ID}{digits}".
INSERT INTO awb_sequences (client_id, last_seq, updated_at)
SELECT s.customer_id,
       COALESCE(MAX(CAST(substr(s.awb, length(s.customer_id) + 1) AS INTEGER)), 0),
       datetime('now')
FROM shipments s
WHERE s.customer_id IS NOT NULL
  AND substr(s.awb, 1, length(s.customer_id)) = s.customer_id
  AND length(s.awb) > length(s.customer_id)
  AND substr(s.awb, length(s.customer_id) + 1) NOT GLOB '*[^0-9]*'
GROUP BY s.customer_id
ON CONFLICT(client_id) DO UPDATE SET
  last_seq = MAX(awb_sequences.last_seq, excluded.last_seq);
