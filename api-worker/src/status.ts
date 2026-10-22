// Mirrors src/utils/status.ts on the frontend - kept here as the
// server-side source of truth so the forward-only pipeline rule can never
// be bypassed by a direct API call, even though the UI already enforces it.

export type ShipmentStatus =
  | "Dalam Persiapan"
  | "Berangkat"
  | "Transit"
  | "Dalam Perjalanan"
  | "Kendala"
  | "Tiba di Tujuan"
  | "Selesai / Terkirim"
  | "Dibatalkan"
  | "Re-route"
  | "Penarikan"
  | "Hold";

export type TimelineEventType =
  | "Barang Diterima"
  | "Berangkat"
  | "Transit"
  | "Dalam Perjalanan"
  | "Kendala"
  | "Transfer Unit"
  | "Tiba di Tujuan"
  | "Selesai / Terkirim"
  | "Re-route"
  | "Penarikan";

export const TIMELINE_EVENT_TYPES: TimelineEventType[] = [
  "Barang Diterima",
  "Berangkat",
  "Transit",
  "Dalam Perjalanan",
  "Kendala",
  "Transfer Unit",
  "Tiba di Tujuan",
  "Selesai / Terkirim",
  "Re-route",
  "Penarikan",
];

const PIPELINE_RANK: Record<string, number> = {
  "Dalam Persiapan": 0,
  "Barang Diterima": 0,
  Berangkat: 1,
  Transit: 2,
  "Dalam Perjalanan": 2,
  Kendala: 2,
  "Re-route": 2,
  Penarikan: 2,
  "Transfer Unit": 2,
  "Tiba di Tujuan": 3,
  "Selesai / Terkirim": 4,
};

export function pipelineRank(status: string): number {
  return PIPELINE_RANK[status] ?? 0;
}

export function eventTypeToShipmentStatus(type: TimelineEventType): ShipmentStatus {
  if (type === "Barang Diterima") return "Dalam Persiapan";
  if (type === "Transfer Unit") return "Dalam Perjalanan";
  return type as ShipmentStatus;
}

export function isForwardTransition(currentStatus: string, nextType: TimelineEventType): boolean {
  if (nextType === "Barang Diterima") return false;
  return pipelineRank(nextType) >= pipelineRank(currentStatus);
}
