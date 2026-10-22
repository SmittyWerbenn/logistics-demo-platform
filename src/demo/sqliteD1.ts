/**
 * Minimal D1Database shim backed by sql.js (SQLite compiled to WASM).
 *
 * The demo has no server: the real GMS Cloudflare Worker code is imported
 * into the browser and this shim stands in for the D1 binding, so every API
 * route (RBAC, validation, AWB numbering, audit log, ...) runs exactly as in
 * production - just against an in-memory SQLite database that is persisted to
 * IndexedDB.
 */
import type { Database } from "sql.js";

type Param = number | string | Uint8Array | null;

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: true;
  meta: { duration: number; changes: number; last_row_id: number; rows_read: number; rows_written: number };
}

function toParam(value: unknown): Param {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return value as Param;
}

const META = { duration: 0, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 };

export class DemoStatement {
  private owner: DemoD1;
  private sql: string;
  private params: unknown[];

  constructor(owner: DemoD1, sql: string, params: unknown[] = []) {
    this.owner = owner;
    this.sql = sql;
    this.params = params;
  }

  bind(...params: unknown[]) {
    return new DemoStatement(this.owner, this.sql, params);
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const rows = this.owner.select(this.sql, this.params);
    if (rows.length === 0) return null;
    const row = rows[0];
    return (column ? row[column] : row) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const rows = this.owner.select(this.sql, this.params) as T[];
    return { results: rows, success: true, meta: { ...META, rows_read: rows.length } };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const changes = this.owner.execute(this.sql, this.params);
    this.owner.mutated();
    return { results: [], success: true, meta: { ...META, changes, rows_written: changes } };
  }

  /** Used by DemoD1.batch (no per-statement persistence). */
  runNoPersist(): D1Result {
    const changes = this.owner.execute(this.sql, this.params);
    return { results: [], success: true, meta: { ...META, changes, rows_written: changes } };
  }
}

export class DemoD1 {
  readonly db: Database;
  private onMutate: () => void;

  constructor(db: Database, onMutate: () => void) {
    this.db = db;
    this.onMutate = onMutate;
  }

  prepare(sql: string): DemoStatement {
    return new DemoStatement(this, sql);
  }

  select(sql: string, params: unknown[]): Record<string, unknown>[] {
    const stmt = this.db.prepare(sql);
    try {
      if (params.length) stmt.bind(params.map(toParam));
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>);
      return rows;
    } finally {
      stmt.free();
    }
  }

  execute(sql: string, params: unknown[]): number {
    this.db.run(sql, params.map(toParam));
    return this.db.getRowsModified();
  }

  async batch<T = Record<string, unknown>>(statements: DemoStatement[]): Promise<D1Result<T>[]> {
    // D1 batches are transactional; mirror that so a failed migration/seed
    // statement never leaves half-written data.
    this.db.run("BEGIN");
    try {
      const results = statements.map((s) => s.runNoPersist() as D1Result<T>);
      this.db.run("COMMIT");
      this.mutated();
      return results;
    } catch (err) {
      this.db.run("ROLLBACK");
      throw err;
    }
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.db.run(sql);
    this.mutated();
    return { count: 0, duration: 0 };
  }

  mutated() {
    this.onMutate();
  }
}
