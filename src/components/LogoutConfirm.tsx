import { LogOut } from "lucide-react";
import { useEffect } from "react";

/** Confirmation popup shown before signing out (admin and driver portals). */
export function LogoutConfirm({
  open,
  nama,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  nama?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Esc closes the popup.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <LogOut size={22} />
        </div>
        <h2 id="logout-title" className="mt-4 text-lg font-semibold text-slate-900">
          Logout dari akun?
        </h2>
        <p id="logout-desc" className="mt-1.5 text-sm text-slate-500">
          {nama ? `${nama}, Anda` : "Anda"} akan keluar dari sesi ini dan perlu login lagi untuk melanjutkan.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Ya, Logout
          </button>
        </div>
      </div>
    </div>
  );
}
