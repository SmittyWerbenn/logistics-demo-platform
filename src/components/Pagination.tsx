import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS, type PageMeta } from "../utils/usePagedList";

/** Page numbers to show: 1 ... (page-2..page+2) ... last. <= 7 pages: all of them, no ellipsis. */
function pageWindow(page: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  let from = Math.max(2, page - 2);
  let to = Math.min(last - 1, Math.max(page + 2, 3));
  if (from === 3) from = 2; // don't hide a single page behind "…"
  if (to === last - 2) to = last - 1;
  const out: (number | "…")[] = [1];
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < last - 1) out.push("…");
  out.push(last);
  return out;
}

const navBase =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40";
const nav = `${navBase} border-slate-300 bg-white text-slate-600 hover:bg-slate-50`;
const navActive = `${navBase} border-blue-900 bg-blue-900 text-white`;

/** Shared footer for every server-paged table/list. Hidden when there is no data. */
export function Pagination({
  meta,
  page,
  pageSize,
  loading,
  onPage,
  onPageSize,
  unit = "data",
}: {
  meta: PageMeta;
  page: number;
  pageSize: number;
  loading?: boolean;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  unit?: string;
}) {
  if (meta.total === 0) return null;
  const last = Math.max(1, meta.totalPages);
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const nf = (n: number) => n.toLocaleString("id-ID");

  return (
    <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Menampilkan <span className="font-semibold text-slate-700">{nf(from)}–{nf(to)}</span> dari{" "}
          <span className="font-semibold text-slate-700">{nf(meta.total)}</span> {unit}
        </span>
        <label className="inline-flex items-center gap-1.5">
          <span className="sr-only sm:not-sr-only">Per halaman</span>
          <select
            aria-label="Jumlah data per halaman"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-lg border border-slate-300 bg-white px-1.5 text-xs font-semibold text-slate-700"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button type="button" aria-label="Halaman pertama" disabled={page <= 1 || loading} onClick={() => onPage(1)} className={nav}>
          <ChevronsLeft size={14} />
        </button>
        <button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} className={nav}>
          <ChevronLeft size={14} />
        </button>
        {/* Phones: "2 / 63"; wider screens: numbered window. */}
        <span className="px-2 sm:hidden">
          {page} / {last}
        </span>
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, last).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} aria-hidden className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-label={`Halaman ${p}`}
                aria-current={p === page ? "page" : undefined}
                disabled={loading}
                onClick={() => onPage(p)}
                className={p === page ? navActive : nav}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <button type="button" aria-label="Halaman berikutnya" disabled={page >= last || loading} onClick={() => onPage(page + 1)} className={nav}>
          <ChevronRight size={14} />
        </button>
        <button type="button" aria-label="Halaman terakhir" disabled={page >= last || loading} onClick={() => onPage(last)} className={nav}>
          <ChevronsRight size={14} />
        </button>
      </div>
    </nav>
  );
}
