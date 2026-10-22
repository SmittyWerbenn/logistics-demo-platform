import { useEffect, useState } from "react";
import { api } from "./apiClient";
import { useDebounced } from "./usePagedList";

export interface LocationSuggestion {
  nama: string;
  provinsi?: string | null;
  jenis?: string | null;
}

const cache = new Map<string, LocationSuggestion[]>();

/** Server-searched suggestions (<= 20) for a city ("kota") or Nama Area ("area")
 * input - replaces shipping the whole master list to the browser. */
export function useLocationSuggest(kind: "kota" | "area", text: string): LocationSuggestion[] {
  const q = useDebounced(text.trim(), 300);
  const key = `${kind}|${q.toLowerCase()}`;
  const [items, setItems] = useState<LocationSuggestion[]>(() => cache.get(key) ?? []);
  useEffect(() => {
    const hit = cache.get(key);
    if (hit) {
      setItems(hit);
      return;
    }
    let live = true;
    api
      .get<{ items: LocationSuggestion[] }>(`/api/public/locations/suggest?kind=${kind}&q=${encodeURIComponent(q)}&limit=20`, { auth: false })
      .then((res) => {
        cache.set(key, res.items);
        if (live) setItems(res.items);
      })
      .catch(() => {
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, [key, kind, q]);
  return items;
}
