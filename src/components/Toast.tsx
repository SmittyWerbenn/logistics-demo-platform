import { CheckCircle2 } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastFn = (message: string) => void;
const ToastContext = createContext<ToastFn>(() => {});

/** Minimal success toast (auto-dismiss). Used by Recycle Bin actions. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((m: string) => {
    window.clearTimeout(timer.current);
    setMessage(m);
    timer.current = window.setTimeout(() => setMessage(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[80] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastContext);
}
