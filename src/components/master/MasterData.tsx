import { Plus, Search, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { RefreshButton } from "../RefreshButton";

/**
 * Shared building blocks for every Master Data page (Master Armada, Kota &
 * Titik Transit, Rate Publish, Master Layanan, plus Mitra/Clients/User Admin
 * under Manajemen User), so they all share one layout:
 *
 *   <MasterDataHeader />   title + description
 *   <MasterDataToolbar />  [ search + filters ........ ] [ Refresh ] [ + Tambah ]
 *   ...banners...
 *   <MasterTableCard />    the table
 *
 * Every control in the toolbar is h-10 so inputs, selects and buttons line up.
 */

const controlClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export function MasterDataHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description: ReactNode;
  /** Optional controls shown top-right (e.g. the single/bulk toggle while the
   * inline add form is open). */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** One row: filters/search on the left (taking the free space), Refresh and
 * the Tambah button on the right. On small screens the row stacks as
 * filters -> Refresh + Tambah, never clipping the buttons. Omit `onAdd` to
 * hide the Tambah button (e.g. for roles that can't edit). */
export function MasterDataToolbar({
  children,
  onRefresh,
  refreshing,
  addLabel,
  onAdd,
  secondary,
}: {
  children: ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
  addLabel: string;
  onAdd?: () => void;
  /** Optional extra action (e.g. a download button) shown before Refresh. */
  secondary?: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
        {secondary}
        <RefreshButton onClick={onRefresh} refreshing={refreshing} className="h-10" />
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            <Plus size={16} /> {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function MasterSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-[120px] flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${controlClass} w-full pl-9`}
      />
    </div>
  );
}

export function MasterFilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name; the first <option> should read like "Semua Status". */
  label: string;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`${controlClass} w-full sm:w-auto`}
    >
      {children}
    </select>
  );
}

/** "Reset" link shown only while at least one filter is active. */
export function MasterFilterReset({ visible, onReset }: { visible: boolean; onReset: () => void }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onReset}
      className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
    >
      <X size={14} /> Reset
    </button>
  );
}

/** Bordered card + horizontal scroll wrapper every Master Data table sits in. */
export function MasterTableCard({
  minWidth,
  fixed = false,
  children,
}: {
  minWidth: number;
  /** Fixed table layout: column widths come from a <colgroup> instead of the
   * cell contents (use it to get evenly spaced columns). */
  fixed?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className={`w-full text-left text-sm ${fixed ? "table-fixed" : ""}`} style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}

/** Loading / empty row used inside a Master Data table body. */
export function MasterTableMessage({
  colSpan,
  loading,
  loadingText,
  icon: Icon,
  title,
  description,
  action,
}: {
  colSpan: number;
  loading?: boolean;
  loadingText: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        {loading ? (
          <span className="text-sm text-slate-400">{loadingText}</span>
        ) : (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
            <Icon size={28} className="text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">{title}</p>
            {description && <p className="text-xs text-slate-500">{description}</p>}
            {action}
          </div>
        )}
      </td>
    </tr>
  );
}

/** Outline button matching the toolbar controls (h-10), for secondary actions
 * such as "Unduh Data". */
export function MasterToolbarButton({
  onClick,
  icon: Icon,
  label,
  disabled,
  busy,
}: {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon size={15} className={busy ? "animate-pulse" : ""} /> {label}
    </button>
  );
}

/** Primary button used inside an empty state ("Tambah ..."). */
export function MasterEmptyAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
    >
      <Plus size={15} /> {label}
    </button>
  );
}
