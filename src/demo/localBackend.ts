/**
 * Browser-only backend for the static demo build.
 *
 * Instead of calling a deployed API, every request is dispatched to the REAL
 * GMS Cloudflare Worker (api-worker/src, imported as a module) running inside
 * the page. Its D1 binding is sql.js/SQLite persisted to IndexedDB, and files
 * are stored in the same database (DEMO_MODE in api-worker/src/storage.ts).
 *
 * Result: the demo is a plain static site (GitHub Pages friendly) with full
 * server-side behaviour - login, RBAC, validation, AWB numbering, audit log -
 * and no server or database to deploy.
 */
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { MIGRATIONS, SEED_SQL } from "./seedSql";
import { DemoD1 } from "./sqliteD1";

/**
 * The worker is its own TS project (Cloudflare types). Loading it through
 * import.meta.glob keeps `tsc -b` on the frontend project from compiling it,
 * while Vite still bundles the real worker module into the demo.
 */
const workerModules = import.meta.glob("../../api-worker/src/index.ts", { eager: true }) as Record<
  string,
  { default: { fetch(request: Request, env: unknown): Promise<Response> } }
>;
const workerApp = Object.values(workerModules)[0]?.default;

/** Bump when seed data or the schema changes, to force a fresh local DB. */
const DEMO_DB_VERSION = 1;
const IDB_NAME = "gms-demo";
const IDB_STORE = "kv";
const IDB_KEY = "database";

interface Backend {
  fetch(request: Request): Promise<Response>;
}

let backendPromise: Promise<Backend> | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function loadStored(): Promise<{ version: number; bytes: Uint8Array } | null> {
  const idb = await openIdb();
  if (!idb) return null;
  return new Promise((resolve) => {
    const tx = idb.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => {
      const value = req.result as { version?: number; bytes?: Uint8Array } | undefined;
      if (value?.version === DEMO_DB_VERSION && value.bytes) resolve({ version: value.version, bytes: value.bytes });
      else resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

async function saveStored(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb();
  if (!idb) return;
  await new Promise<void>((resolve) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ version: DEMO_DB_VERSION, bytes }, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

async function initBackend(): Promise<Backend> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  const params = new URLSearchParams(window.location.search);
  const reset = params.get("reset") === "1";
  const stored = reset ? null : await loadStored();

  let db = stored ? new SQL.Database(stored.bytes) : new SQL.Database();

  if (!stored) {
    for (const migration of MIGRATIONS) db.run(migration);
    db.run(SEED_SQL);
    await saveStored(db.export());
  }

  if (reset) {
    params.delete("reset");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
  }

  let saveTimer: number | undefined;
  const persist = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveStored(db.export());
    }, 300);
  };
  window.addEventListener("pagehide", () => {
    window.clearTimeout(saveTimer);
    void saveStored(db.export());
  });

  const d1 = new DemoD1(db, persist);
  const env = {
    DB: d1,
    ALLOWED_ORIGINS: window.location.origin,
    MINIO_ENDPOINT: "",
    MINIO_BUCKET: "",
    MINIO_ACCESS_KEY: "",
    MINIO_SECRET_KEY: "",
    SESSION_TTL_HOURS: "24",
    EMAIL_API_URL: "",
    REPORT_API_TOKEN: "",
    DAILY_REPORT_ENABLED: "false",
    DEMO_MODE: "true",
  };

  return {
    fetch: (request: Request) => {
      if (!workerApp) throw new Error("Demo worker gagal dimuat.");
      return workerApp.fetch(request, env);
    },
  };
}

export function getDemoBackend(): Promise<Backend> {
  backendPromise ??= initBackend();
  return backendPromise;
}

/** Replaces fetch() in src/utils/apiClient.ts when the demo build runs. */
export async function demoFetch(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: BodyInit | undefined,
): Promise<Response> {
  const backend = await getDemoBackend();
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Origin", window.location.origin);
  const request = new Request(`${window.location.origin}${path}`, {
    method,
    headers: requestHeaders,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
  return backend.fetch(request);
}
