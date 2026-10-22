import { useEffect, useState } from "react";

/**
 * useState that persists to localStorage, with crash-safe read/write (a
 * failed write - e.g. quota exceeded - is logged and ignored rather than
 * thrown, since the app already has this state in memory either way).
 */
export function usePersistedState<T>(key: string, initial: T | (() => T)) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // ignore corrupted storage, fall back to the initial value
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.error(`[usePersistedState] gagal menyimpan "${key}":`, err);
    }
  }, [key, state]);

  return [state, setState] as const;
}
