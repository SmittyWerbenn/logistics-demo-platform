export interface PageParams {
  page: number;
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(url: URL): PageParams {
  let page = Number(url.searchParams.get("page") ?? "1");
  let limit = Number(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT));
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit, offset: (page - 1) * limit };
}

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** True when the caller asked for a page (page/limit present); lets small lookup
 * lists keep returning everything for dropdowns while tables get real pages. */
export function wantsPaging(url: URL): boolean {
  return url.searchParams.has("page") || url.searchParams.has("limit");
}

/** `%term%` with LIKE wildcards in the term escaped (pair with `ESCAPE '\'`). */
export function likeTerm(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** ORDER BY from `sort`/`order` params, restricted to a whitelist of columns. */
export function orderBy(url: URL, allowed: Record<string, string>, fallback: string): string {
  const key = url.searchParams.get("sort") ?? "";
  const col = allowed[key];
  if (!col) return fallback;
  const dir = url.searchParams.get("order")?.toLowerCase() === "desc" ? "DESC" : "ASC";
  return `${col} ${dir}, ${fallback}`;
}
