import { RefreshCw } from "lucide-react";

/** Shared style for the manual "Refresh" action used across every admin and
 * driver-portal list/detail page - navy outline, spinning icon while the
 * refetch is in flight. Each page owns its own refreshing state and
 * refetch logic; this only standardizes the button itself. */
export function RefreshButton({
  onClick,
  refreshing,
  className = "",
}: {
  onClick: () => void;
  refreshing: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      title="Muat ulang data"
      className={`inline-flex items-center gap-1.5 rounded-lg border-2 border-blue-900 bg-white px-3.5 py-2 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-50 disabled:opacity-60 ${className}`}
    >
      <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
    </button>
  );
}
