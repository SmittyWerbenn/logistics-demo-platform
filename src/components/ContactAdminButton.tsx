import { Loader2, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../utils/apiClient";
import { fetchLupaPasswordTarget, notConfiguredMessage, type HelpTargetInfo } from "../utils/helpWhatsApp";
import { whatsappUrl } from "../utils/whatsapp";

/**
 * "Lupa Password" / "Hubungi Admin" on the login pages. Nobody is signed in
 * yet, so the WhatsApp number is looked up from the typed email: GMS-Admin
 * accounts go to WhatsApp Superadmin, everyone else to WhatsApp Admin (numbers
 * come from Pengaturan, the mapping lives in the API). When the number is not
 * configured it says so instead of opening an invalid link.
 *
 * When `confirmFirst` is set (used for the "Lupa Password?" link), clicking
 * opens a confirmation modal first; only after the user confirms does the
 * component actually fetch the target and open WhatsApp.
 */
export function ContactAdminButton({
  email,
  message,
  label = "Hubungi Admin",
  variant = "solid",
  confirmFirst = false,
}: {
  email: string;
  /** Builds the WhatsApp text once the destination (Admin/Superadmin) is known. */
  message: (info: HelpTargetInfo) => string;
  label?: string;
  variant?: "solid" | "link";
  /** Show a confirmation modal before redirecting to WhatsApp. */
  confirmFirst?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** Validate email — returns the trimmed email or sets error & returns null. */
  function validate(): string | null {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) { setError("Email wajib diisi"); return null; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("Format email tidak valid"); return null; }
    return trimmed;
  }

  /** The actual WhatsApp-opening logic, extracted so both direct click and confirm path can call it. */
  async function doOpenWhatsApp(validEmail: string) {
    setBusy(true);
    setError(null);
    setFallbackUrl(null);
    try {
      const info = await fetchLupaPasswordTarget(validEmail);
      const url = info.configured ? whatsappUrl(info.number, message(info)) : null;
      if (!url) {
        setError(notConfiguredMessage(info));
        return;
      }
      const win = window.open(url, "_blank");
      if (win) win.opener = null;
      else setFallbackUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyiapkan WhatsApp. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  function handleClick() {
    const valid = validate();
    if (!valid) return;
    if (confirmFirst) {
      setConfirmOpen(true);
      return;
    }
    void doOpenWhatsApp(valid);
  }

  async function handleConfirm() {
    const valid = validate();
    if (!valid) return;
    setConfirmOpen(false);
    await doOpenWhatsApp(valid);
  }

  const btnClass =
    variant === "link"
      ? "inline-flex items-center gap-1 text-xs font-semibold text-blue-800 hover:underline disabled:opacity-60"
      : "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60";

  return (
    <>
      <div className={variant === "link" ? "" : "flex flex-col gap-1.5"}>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className={btnClass}
        >
          {busy ? <Loader2 size={variant === "link" ? 12 : 16} className="animate-spin" /> : variant === "solid" && <MessageCircle size={16} />}
          {label}
        </button>
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">
            {error}
          </p>
        )}
        {fallbackUrl && (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <MessageCircle size={12} /> Buka WhatsApp
          </a>
        )}
      </div>

      {/* Confirmation modal (only shown when confirmFirst is true) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <div className="px-6 pb-6 pt-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Lupa Password?</h2>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-center text-sm leading-6 text-slate-600">
                Hubungi admin untuk bantuan pemulihan kata sandi Anda.
              </p>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-pink-100 px-5 py-2.5 text-sm font-semibold text-rose-800 shadow-sm transition-all duration-200 hover:bg-pink-200 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0B192C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#0D1B2A] disabled:opacity-60"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                  Hubungi Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}