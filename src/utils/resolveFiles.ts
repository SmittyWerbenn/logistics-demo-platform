import { api } from "./apiClient";

export interface FileRef {
  id: string;
  entity_type: string;
  entity_id: string;
}

/** Resolves a list of file metadata refs (as returned alongside a shipment
 * detail payload) into short-lived signed view URLs, grouped by
 * "entityType:entityId" - callers take `[0]` for a single-photo field
 * (backend orders newest-first) or the full array for a photo gallery. */
export async function resolveFileUrls(files: FileRef[], isPublic = false): Promise<Map<string, string[]>> {
  const resolved = await Promise.all(
    files.map(async (f) => {
      try {
        const path = isPublic ? `/api/public/files/${f.id}` : `/api/files/${f.id}`;
        const { url } = await api.get<{ url: string }>(path, { auth: !isPublic });
        return { key: `${f.entity_type}:${f.entity_id}`, url };
      } catch {
        return null;
      }
    }),
  );

  const map = new Map<string, string[]>();
  for (const r of resolved) {
    if (!r) continue;
    const arr = map.get(r.key) ?? [];
    arr.push(r.url);
    map.set(r.key, arr);
  }
  return map;
}
