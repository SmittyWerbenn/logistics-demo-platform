import { api } from "./apiClient";

export type RecycleEntity = "shipment" | "user" | "truck" | "location" | "layanan" | "mitra" | "client" | "tariff" | "client_logo";

export interface RecycleItemResult {
  id: string;
  ok: boolean;
  message?: string;
}

export interface RecycleSummary {
  succeeded: number;
  failed: number;
  results: RecycleItemResult[];
}

/** Move rows to the Recycle Bin (Superadmin only - the API enforces it). A single failed id throws an ApiError. */
export function moveToRecycleBin(entityType: RecycleEntity, ids: string[], reason: string) {
  return api.post<RecycleSummary>("/api/recycle/delete", { entityType, ids, reason });
}

/** Permanent delete a Rate Publish (tariff) directly, bypassing Recycle Bin. Superadmin only - API re-checks role. */
export function forceDeleteRatePublish(id: string, reason: string) {
  return api.post<{ ok: boolean }>(`/api/rate-publish/${id}/force-delete`, { reason });
}

export function restoreFromBin(ids: string[], reason: string) {
  return api.post<RecycleSummary>("/api/recycle/restore", { ids, reason });
}

/** What still references a row (warning before moving it to the bin). Nothing listed is deleted with it. */
export interface ImpactItem {
  count: number;
  label: string;
  /** "awb" samples are shipment numbers (linkable); "text" samples are shown as they are. */
  kind?: "awb" | "text";
  samples?: string[];
}

export function getDeleteImpact(entityType: RecycleEntity, id: string) {
  return api.get<{ items: ImpactItem[]; retentionDays: number }>(
    `/api/recycle/impact?entityType=${entityType}&id=${encodeURIComponent(id)}`,
  );
}

/** First failure message of a bulk result, for a one-line toast. */
export function summaryMessage(s: RecycleSummary, okText: string): string {
  if (s.failed === 0) return okText;
  const firstFail = s.results.find((r) => !r.ok)?.message;
  return `${s.succeeded} berhasil, ${s.failed} gagal${firstFail ? `: ${firstFail}` : ""}`;
}
