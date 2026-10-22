import { QRCodeSVG } from "qrcode.react";

interface QRCodeProps {
  data: string;
  size?: number;
  className?: string;
}

/**
 * Renders the QR code entirely client-side (no network call). Previously
 * this hotlinked an external image API, which meant the QR code silently
 * failed to appear whenever that third-party service was slow, blocked, or
 * unreachable - this has no such failure mode.
 */
export function QRCode({ data, size = 180, className = "" }: QRCodeProps) {
  return (
    <div
      role="img"
      aria-label={`QR Code menuju ${data}`}
      className={`inline-flex rounded-lg border border-slate-200 bg-white p-2 ${className}`}
    >
      <QRCodeSVG value={data} size={size} marginSize={0} />
    </div>
  );
}
