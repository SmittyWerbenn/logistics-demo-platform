// AWB numbering is per Client: "{CLIENT_ID}{0000}", e.g. TATA0001, AGHM0001.
// The number is a 4-digit sequence that counts independently for every Client
// ID, so one client's numbering never affects another's. Past 9999 the number
// simply grows (TATA10000) - it is never truncated or reset, which would risk
// duplicates.
import type { D1Database } from "@cloudflare/workers-types";

/** Makes sure the counter row exists, starting at 0. Covers a Client that has
 * never had a shipment yet. */
const ENSURE_SQL = `INSERT OR IGNORE INTO awb_sequences (client_id, last_seq, updated_at)
  VALUES (?, 0, ?)`;

/** Raises the counter to the highest number already used by this Client, so a
 * client that already has TATA0003 continues at TATA0004 instead of restarting
 * at 0001.
 *
 * Grouping is by the shipment's own customer_id column - NOT by matching the
 * AWB prefix - so a client whose ID is the prefix of another one (TATA and
 * TATA2) never steals numbers from it. Only AWBs that start with the Client ID
 * and end in digits count, so AWBs of the previous format ("G260927001") are
 * ignored. MAX() keeps the higher of the stored and the derived value. */
const SEED_SQL = `UPDATE awb_sequences
     SET last_seq = MAX(last_seq, COALESCE((
           SELECT MAX(CAST(substr(awb, ?) AS INTEGER)) FROM shipments
            WHERE customer_id = ? COLLATE NOCASE
              AND substr(awb, 1, ?) = customer_id COLLATE NOCASE
              AND length(awb) > ?
              AND substr(awb, ?) NOT GLOB '*[^0-9]*'), 0)),
         updated_at = ?
   WHERE client_id = ?`;

/** Atomically reserves the next number. A single UPDATE statement, so
 * concurrent creates are serialized by the database and each one gets a
 * distinct number - two shipments can never receive the same AWB. */
const NEXT_SQL = `UPDATE awb_sequences
     SET last_seq = last_seq + 1, updated_at = ?
   WHERE client_id = ?
 RETURNING last_seq`;

export async function generateClientAwb(db: D1Database, clientId: string): Promise<string> {
  const prefix = clientId.trim().toUpperCase();
  if (!prefix) throw new Error("Client ID wajib diisi untuk membuat nomor AWB.");

  const now = new Date().toISOString();
  const len = prefix.length;

  await db.batch([
    db.prepare(ENSURE_SQL).bind(prefix, now),
    db.prepare(SEED_SQL).bind(len + 1, prefix, len, len, len + 1, now, prefix),
  ]);

  const row = await db.prepare(NEXT_SQL).bind(now, prefix).first<{ last_seq: number }>();
  if (!row || typeof row.last_seq !== "number") {
    throw new Error(`Gagal mengambil nomor AWB untuk Client ${prefix}.`);
  }

  // padStart keeps 4 digits (0001) and lets the number grow past 9999.
  return `${prefix}${String(row.last_seq).padStart(4, "0")}`;
}

/** True when the error is an AWB uniqueness violation. shipments.awb is the
 * PRIMARY KEY, so the database itself refuses a duplicate - this lets the
 * caller retry with the next number instead of failing the request. */
export function isDuplicateAwbError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed/i.test(message) && /awb/i.test(message);
}
