import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./apiClient";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;
const SIZE_KEY = "gms-page-size";

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function readSize(key = SIZE_KEY, fallback = DEFAULT_PAGE_SIZE): number {
  try {
    const n = Number(localStorage.getItem(key));
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

/** Persisted rows-per-page choice, shared by every table. */
export function usePageSize(): [number, (n: number) => void] {
  const [size, setSizeState] = useState<number>(readSize);
  function setSize(n: number) {
    try {
      localStorage.setItem(SIZE_KEY, String(n));
    } catch {
      /* ignore */
    }
    setSizeState(n);
  }
  return [size, setSize];
}

export type PagedParams = Record<string, string | number | undefined | null>;

function toQuery(params: PagedParams): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") q.set(k, String(v));
  }
  return q;
}

/**
 * Server-side paged list. Filter / search / sort go to the API as query
 * params (FILTER -> SORT -> LIMIT/OFFSET happens in the database); the page
 * resets to 1 whenever `params` or the page size changes. A stale answer
 * never overwrites a newer one, and a page past the end (after a delete, or
 * a filter that shrank the result) snaps back to the last valid page.
 */
export function usePagedList<Raw, T = Raw>(
  endpoint: string,
  params: PagedParams,
  map?: (r: Raw) => T,
  opts: { enabled?: boolean; /** Own default + remembered choice for this table (instead of the shared one). */ pageSizeKey?: string; defaultPageSize?: number } = {},
) {
  const enabled = opts.enabled ?? true;
  const sizeKey = opts.pageSizeKey ? `${SIZE_KEY}:${opts.pageSizeKey}` : SIZE_KEY;
  const [pageSize, setPageSizeState] = useState<number>(() => readSize(sizeKey, opts.defaultPageSize));
  const filterKey = `${endpoint}|${toQuery(params).toString()}|${pageSize}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = useCallback((p: number) => setPageState({ key: filterKey, page: Math.max(1, p) }), [filterKey]);

  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  // Anything else the endpoint returns next to items/meta (e.g. a summary).
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const latest = useRef(0);
  const mapRef = useRef(map);
  mapRef.current = map;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const q = toQuery(paramsRef.current);
      q.set("page", String(page));
      q.set("limit", String(pageSize));
      const res = await api.get<{ items: Raw[]; meta: PageMeta } & Record<string, unknown>>(`${endpoint}?${q.toString()}`);
      if (id !== latest.current) return;
      if (res.meta.total > 0 && page > res.meta.totalPages) {
        setPageState({ key: filterKey, page: res.meta.totalPages });
        return;
      }
      const m = mapRef.current;
      setItems(res.items.map((r) => (m ? m(r) : (r as unknown as T))));
      setMeta(res.meta);
      const { items: _i, meta: _m, ...rest } = res;
      setExtra(rest);
    } catch (err) {
      if (id === latest.current) setError(err instanceof ApiError ? err.message : "Gagal memuat data.");
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [enabled, endpoint, filterKey, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  function setPageSize(n: number) {
    try {
      localStorage.setItem(sizeKey, String(n));
    } catch {
      /* ignore */
    }
    setPageSizeState(n);
  }

  /** Every row matching the current filters (all pages, 100 per request) - for exports. */
  async function fetchAll(maxPages = 200): Promise<T[]> {
    const all: T[] = [];
    for (let p = 1; p <= maxPages; p++) {
      const q = toQuery(paramsRef.current);
      q.set("page", String(p));
      q.set("limit", "100");
      const res = await api.get<{ items: Raw[]; meta: PageMeta }>(`${endpoint}?${q.toString()}`);
      const m = mapRef.current;
      all.push(...res.items.map((r) => (m ? m(r) : (r as unknown as T))));
      if (p >= res.meta.totalPages) break;
    }
    return all;
  }

  return { items, extra, meta, page, setPage, pageSize, setPageSize, loading, error, reload: load, fetchAll };
}

/** Debounce a fast-changing value (search box) so each keystroke isn't a request. */
export function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
