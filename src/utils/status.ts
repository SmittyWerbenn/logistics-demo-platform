import type { ArmadaStatus, ShipmentStatus, TimelineEventType } from "../types";

export interface StatusStyle {
  bg: string;
  text: string;
  dot: string;
  ring: string;
}

const STYLES: Record<string, StatusStyle> = {
  "Dalam Persiapan": {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-400",
    ring: "ring-slate-200",
  },
  "Berangkat": {
    bg: "bg-sky-100",
    text: "text-sky-700",
    dot: "bg-sky-500",
    ring: "ring-sky-200",
  },
  "Transit": {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-200",
  },
  "Dalam Perjalanan": {
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
    ring: "ring-blue-200",
  },
  "Kendala": {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
    ring: "ring-red-200",
  },
  "Re-route": {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
    ring: "ring-cyan-200",
  },
  "Penarikan": {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
    ring: "ring-orange-200",
  },
  "Transfer Unit": {
    bg: "bg-violet-100",
    text: "text-violet-700",
    dot: "bg-violet-500",
    ring: "ring-violet-200",
  },
  "Tiba di Tujuan": {
    bg: "bg-teal-100",
    text: "text-teal-700",
    dot: "bg-teal-500",
    ring: "ring-teal-200",
  },
  "Selesai / Terkirim": {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
  },
  "Barang Diterima": {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-400",
    ring: "ring-slate-200",
  },
  "Hold": {
    bg: "bg-orange-500",
    text: "text-white",
    dot: "bg-white",
    ring: "ring-orange-600",
  },
  "Dibatalkan": {
    bg: "bg-rose-100",
    text: "text-rose-700",
    dot: "bg-rose-500",
    ring: "ring-rose-200",
  },
};

export function getStatusStyle(status: ShipmentStatus | TimelineEventType): StatusStyle {
  return STYLES[status] ?? STYLES["Dalam Persiapan"];
}

export const SHIPMENT_STATUS_OPTIONS: ShipmentStatus[] = [
  "Dalam Persiapan",
  "Berangkat",
  "Transit",
  "Dalam Perjalanan",
  "Kendala",
  "Tiba di Tujuan",
  "Selesai / Terkirim",
  "Re-route",
  "Penarikan",
  "Hold",
  "Dibatalkan",
];

export const TIMELINE_EVENT_OPTIONS: TimelineEventType[] = [
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

/** Maps a timeline event type to the resulting shipment-level status. */
export function eventTypeToShipmentStatus(type: TimelineEventType): ShipmentStatus {
  if (type === "Barang Diterima") return "Dalam Persiapan";
  if (type === "Transfer Unit") return "Dalam Perjalanan";
  return type as ShipmentStatus;
}

/**
 * Position of each status in the shipment pipeline. Statuses that can occur
 * at any point during the active transit phase (Transit, Dalam Perjalanan,
 * Kendala, Transfer Unit) share a rank so admins can log any of them while
 * the shipment is en route, but the rank only ever moves forward overall -
 * an update can never send the pipeline backward.
 */
const PIPELINE_RANK: Record<string, number> = {
  "Dalam Persiapan": 0,
  "Barang Diterima": 0,
  "Berangkat": 1,
  "Transit": 2,
  "Dalam Perjalanan": 2,
  "Kendala": 2,
  "Transfer Unit": 2,
  "Re-route": 2,
  "Penarikan": 2,
  "Tiba di Tujuan": 3,
  "Selesai / Terkirim": 4,
};

export function getPipelineRank(status: ShipmentStatus | TimelineEventType): number {
  return PIPELINE_RANK[status] ?? 0;
}

/**
 * Timeline event types an admin may add next, given the shipment's current
 * status. Excludes anything that would move the pipeline backward, and
 * excludes "Barang Diterima" since that's only ever created automatically
 * when the shipment is first made.
 */
export function getAllowedNextEvents(currentStatus: ShipmentStatus): TimelineEventType[] {
  const currentRank = getPipelineRank(currentStatus);
  return TIMELINE_EVENT_OPTIONS.filter(
    (opt) => opt !== "Barang Diterima" && getPipelineRank(opt) >= currentRank,
  );
}

const ARMADA_STYLES: Record<ArmadaStatus, StatusStyle> = {
  Available: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
  },
  "On Trip": {
    bg: "bg-sky-100",
    text: "text-sky-700",
    dot: "bg-sky-500",
    ring: "ring-sky-200",
  },
  Maintenance: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-200",
  },
  Inactive: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    dot: "bg-slate-400",
    ring: "ring-slate-200",
  },
};

export function getArmadaStatusStyle(status: ArmadaStatus): StatusStyle {
  return ARMADA_STYLES[status];
}

export const ARMADA_STATUS_OPTIONS: ArmadaStatus[] = ["Available", "On Trip", "Maintenance", "Inactive"];
