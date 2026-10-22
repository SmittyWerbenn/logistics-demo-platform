import { useState, type ReactNode } from "react";
import { notConfiguredMessage } from "../utils/helpWhatsApp";
import { useHelpTarget } from "../utils/useHelpTarget";
import { whatsappUrl } from "../utils/whatsapp";

/**
 * Driver "Hubungi Kendala": opens WhatsApp Admin (the destination for this
 * role + topic is decided by the API from the Pengaturan numbers). Renders an
 * <a> only when a valid number exists; otherwise a button that explains the
 * number has not been configured - never an empty/invalid link.
 */
export function DriverHelpLink({
  message,
  className,
  children,
}: {
  message: string;
  className: string;
  children: ReactNode;
}) {
  const state = useHelpTarget("kendala");
  const [showMissing, setShowMissing] = useState(false);

  const url = state.status === "ready" && state.info.configured ? whatsappUrl(state.info.number, message) : null;
  const missingText =
    state.status === "ready"
      ? notConfiguredMessage(state.info)
      : state.status === "error"
        ? "Gagal memuat nomor WhatsApp Admin. Coba muat ulang halaman."
        : "Memuat nomor WhatsApp Admin...";

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setShowMissing(true)} className={className}>
        {children}
      </button>
      {showMissing && (
        <p role="alert" className="mt-1 w-full text-xs font-medium text-red-600">
          {missingText}
        </p>
      )}
    </>
  );
}
