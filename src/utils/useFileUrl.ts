import { useEffect, useState } from "react";
import { api } from "./apiClient";

/** Resolves a single file id (e.g. a user's avatar) into a short-lived
 * signed view URL. Returns null while loading, missing, or on error. */
export function useFileUrl(fileId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    api
      .get<{ url: string }>(`/api/files/${fileId}`)
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return url;
}
