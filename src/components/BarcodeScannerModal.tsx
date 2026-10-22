import { AlertTriangle, Loader2, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { useLanguage } from "../store/LanguageContext";
import { extractAwb } from "../utils/extractAwb";

interface BarcodeScannerModalProps {
  onClose: () => void;
  onDetected: (awb: string) => void;
}

export function BarcodeScannerModal({ onClose, onDetected }: BarcodeScannerModalProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const firedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "scanning" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  // Mount-once: the camera should start exactly once when the modal opens
  // and stop on unmount, regardless of how often the parent re-renders (an
  // unstable onDetected reference must not restart the stream each time).
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (result && !firedRef.current) {
              const awb = extractAwb(result.getText());
              if (awb) {
                firedRef.current = true;
                onDetectedRef.current(awb);
              }
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("scanning");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError(t.scanner.cameraError);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ScanLine size={17} className="text-blue-900" /> {t.scanner.title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.scanner.close}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative aspect-square bg-slate-950">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-xs">{t.scanner.openingCamera}</p>
            </div>
          )}

          {status === "scanning" && (
            <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70" />
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 px-6 text-center text-white">
              <AlertTriangle size={24} className="text-amber-400" />
              <p className="text-xs">{error}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          <p className="text-center text-xs text-slate-500">
            {t.scanner.instructions}
          </p>
        </div>
      </div>
    </div>
  );
}
