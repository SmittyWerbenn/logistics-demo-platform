import { Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../store/LanguageContext";
import { FeedbackForm } from "./FeedbackForm";

const IDLE_MS = 10_000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "scroll", "touchstart", "click"] as const;

/**
 * Shows the delivery-feedback form as a popup instead of a static block at
 * the bottom of the page: it opens on its own after IDLE_MS of no user
 * activity, and stays reachable afterwards via a small floating button so
 * closing it doesn't lose the feature.
 */
export function FeedbackPopup({
  awb,
  customerName,
  alreadyRated,
}: {
  awb: string;
  customerName: string;
  alreadyRated: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [dismissedOnce, setDismissedOnce] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (alreadyRated || dismissedOnce || open) return;

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setOpen(true), IDLE_MS);
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alreadyRated, dismissedOnce, open]);

  // Once rated, render nothing - unless the popup is still open (the user
  // just submitted through it), so the "Terima kasih" confirmation inside
  // FeedbackForm gets a chance to show instead of vanishing instantly.
  if (alreadyRated && !open) return null;

  function close() {
    setOpen(false);
    setDismissedOnce(true);
  }

  return (
    <>
      {!open && !alreadyRated && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-blue-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-800"
        >
          <Star size={16} className="fill-amber-400 text-amber-400" />
          {t.feedback.floatingButton}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            className="relative w-full max-w-sm animate-[fadeIn_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label={t.feedback.close}
              className="absolute -top-3 -right-3 z-10 rounded-full bg-white p-1.5 text-slate-500 shadow-md hover:text-slate-800"
            >
              <X size={16} />
            </button>
            <FeedbackForm awb={awb} customerName={customerName} />
          </div>
        </div>
      )}
    </>
  );
}
