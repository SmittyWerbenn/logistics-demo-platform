import { usePageSize } from "./usePagedList";
import { useCallback, useEffect, useRef, useState } from "react";
import { toAppUser, type UserRow } from "../store/UserManagementContext";
import type { AppUser } from "../types";
import { ApiError, api } from "./apiClient";

/** "driver" = Management User Driver (Driver accounts only);
 * "staff" = Management User (every other role). */
export type UserGroup = "driver" | "staff";

export interface UserFilters {
  nama: string;
  email: string;
  nopol: string;
  /** Role value, "" = all. Only used by the staff list. */
  role: string;
  status: "" | "aktif" | "nonaktif";
}

export const EMPTY_USER_FILTERS: UserFilters = { nama: "", email: "", nopol: "", role: "", status: "" };

interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function buildQuery(group: UserGroup, f: UserFilters, page: number, limit: number): string {
  const q = new URLSearchParams({ group, page: String(page), limit: String(limit) });
  if (f.nama.trim()) q.set("nama", f.nama.trim());
  if (f.email.trim()) q.set("email", f.email.trim());
  if (f.nopol.trim()) q.set("nopol", f.nopol.trim());
  if (f.role) q.set("role", f.role);
  if (f.status) q.set("status", f.status);
  return q.toString();
}

/**
 * Server-side user list: every filter is sent to the API (so it searches all
 * users, not only the page on screen). `draft` is what the inputs show;
 * `apply()` (the Cari button / Enter) commits it, `reset()` clears everything.
 * The API sorts Aktif first, then Nonaktif, then by name.
 */
export function useUserList(group: UserGroup) {
  const [draft, setDraft] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const [applied, setApplied] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = usePageSize();
  const [items, setItems] = useState<AppUser[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: UserRow[]; meta: PageMeta }>(
        `/api/users?${buildQuery(group, applied, page, pageSize)}`,
      );
      if (id !== latest.current) return; // a newer request superseded this one
      setItems(res.items.map(toAppUser));
      setMeta(res.meta);
    } catch (err) {
      if (id === latest.current) setError(err instanceof ApiError ? err.message : "Gagal memuat daftar user.");
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [group, applied, page, pageSize]);

  // The page vanished (last row on it deleted): fall back to the last valid page.
  useEffect(() => {
    if (meta.total > 0 && page > meta.totalPages) setPage(meta.totalPages);
  }, [meta.total, meta.totalPages, page]);

  function setPageSize(n: number) {
    setPageSizeRaw(n);
    setPage(1);
  }

  useEffect(() => {
    void load();
  }, [load]);

  function apply() {
    setApplied(draft);
    setPage(1);
  }

  function reset() {
    setDraft(EMPTY_USER_FILTERS);
    setApplied(EMPTY_USER_FILTERS);
    setPage(1);
  }

  /** Every user matching the applied filters (all pages) - for the export. */
  async function fetchAll(): Promise<AppUser[]> {
    const all: AppUser[] = [];
    for (let p = 1; p <= 100; p++) {
      const res = await api.get<{ items: UserRow[]; meta: PageMeta }>(`/api/users?${buildQuery(group, applied, p, 100)}`);
      all.push(...res.items.map(toAppUser));
      if (p >= res.meta.totalPages) break;
    }
    return all;
  }

  const hasFilter = Object.entries(applied).some(([, v]) => v !== "");
  return { draft, setDraft, applied, hasFilter, apply, reset, page, setPage, pageSize, setPageSize, items, meta, loading, error, reload: load, fetchAll };
}

/** True when another account already uses this email (the API compares
 * case-insensitively). `excludeId` is the account being edited, whose own
 * email is of course allowed. */
export async function isEmailTaken(email: string, excludeId?: string | null): Promise<boolean> {
  const q = new URLSearchParams({ emailExact: email.trim().toLowerCase(), limit: "5" });
  const res = await api.get<{ items: { id: string }[] }>(`/api/users?${q.toString()}`);
  return res.items.some((u) => u.id !== excludeId);
}
