import type { Shipment } from "../types";

export interface StagnantInfo {
  shipment: Shipment;
  daysSinceUpdate: number;
  lastUpdateDate: string;
  lastUpdateTime: string;
}

/**
 * AWBs that haven't had a status update in `thresholdDays` or more, and
 * aren't already finished. Threshold is configurable via SettingsContext
 * (Admin -> Pengaturan -> Tracking) rather than hard-coded.
 */
export function getStagnantShipments(
  shipments: Shipment[],
  thresholdDays: number,
  now: Date = new Date(),
): StagnantInfo[] {
  return shipments
    .filter((s) => s.status !== "Selesai / Terkirim")
    .map((s) => {
      const last = s.timeline[s.timeline.length - 1];
      const lastDate = new Date(`${last.tanggal}T${last.jam}:00+07:00`);
      const daysSinceUpdate = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return { shipment: s, daysSinceUpdate, lastUpdateDate: last.tanggal, lastUpdateTime: last.jam };
    })
    .filter((info) => info.daysSinceUpdate >= thresholdDays)
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
}
