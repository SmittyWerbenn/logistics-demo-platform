/**
 * The SQL that builds the browser-side demo database: the same migration
 * files and generated seed the local Worker uses, bundled as raw text.
 */
const migrationModules = import.meta.glob("../../api-worker/migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const seedModules = import.meta.glob("../../api-worker/seed/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** Sorted by filename (= migration order). */
export const MIGRATIONS: string[] = Object.entries(migrationModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, sql]) => sql);

export const SEED_SQL: string = Object.values(seedModules)[0] ?? "";
