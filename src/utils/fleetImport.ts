import type { ArmadaStatus } from "../types";
import { downloadCsv, normalizeHeader } from "./csv";

export const FLEET_TEMPLATE_HEADERS = [
  "Nomor Unit",
  "Jenis",
  "Kapasitas",
  "Nama Driver",
  "No HP Driver",
  "Status",
  "Keterangan (Opsional)",
] as const;

export interface BulkFleetRowInput {
  nomorUnit: string;
  jenis: string;
  kapasitas: string;
  driverNama: string;
  driverTelepon: string;
  status: string;
  keterangan: string;
}

const FIELD_ORDER: (keyof BulkFleetRowInput)[] = [
  "nomorUnit",
  "jenis",
  "kapasitas",
  "driverNama",
  "driverTelepon",
  "status",
  "keterangan",
];

const HEADER_LOOKUP = new Map(FLEET_TEMPLATE_HEADERS.map((h, i) => [normalizeHeader(h), FIELD_ORDER[i]]));

/**
 * Converts a raw 2D table (from CSV parsing or read-excel-file) into row
 * objects, matching the header row against FLEET_TEMPLATE_HEADERS
 * (case/spacing-insensitive) so column order in the uploaded file doesn't
 * matter as long as the header names match.
 */
export function tableToBulkFleetRows(table: unknown[][]): {
  rows: BulkFleetRowInput[];
  headerError?: string;
} {
  if (table.length === 0) return { rows: [], headerError: "File kosong." };

  const headerRow = table[0].map((c) => normalizeHeader(String(c ?? "")));
  const fieldByColumn = headerRow.map((h) => HEADER_LOOKUP.get(h));
  const matchedCount = fieldByColumn.filter(Boolean).length;

  if (matchedCount === 0) {
    return {
      rows: [],
      headerError: "Header kolom tidak dikenali. Gunakan template yang disediakan.",
    };
  }

  const rows: BulkFleetRowInput[] = [];
  for (let r = 1; r < table.length; r++) {
    const raw = table[r];
    if (!raw || raw.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;

    const record: Partial<BulkFleetRowInput> = {};
    fieldByColumn.forEach((field, colIndex) => {
      if (!field) return;
      const cell = raw[colIndex];
      record[field] = cell === null || cell === undefined ? "" : String(cell).trim();
    });

    rows.push({
      nomorUnit: record.nomorUnit ?? "",
      jenis: record.jenis ?? "",
      kapasitas: record.kapasitas ?? "",
      driverNama: record.driverNama ?? "",
      driverTelepon: record.driverTelepon ?? "",
      status: record.status ?? "",
      keterangan: record.keterangan ?? "",
    });
  }

  return { rows };
}

const TRUCK_TYPES = ["Wingbox", "CDD", "Box", "Pickup", "Fuso", "Tronton"];

export function normalizeTruckJenis(value: string): string {
  const v = value.trim().toLowerCase();
  const match = TRUCK_TYPES.find((j) => j.toLowerCase() === v);
  return match ?? (value.trim() || "Wingbox");
}

const STATUS_VALUES: ArmadaStatus[] = ["Available", "On Trip", "Maintenance", "Inactive"];

export function normalizeArmadaStatus(value: string): ArmadaStatus {
  const v = value.trim().toLowerCase();
  const match = STATUS_VALUES.find((s) => s.toLowerCase() === v);
  return match ?? "Available";
}

export function downloadBulkFleetTemplate() {
  downloadCsv("template-bulk-armada.csv", FLEET_TEMPLATE_HEADERS, [
    ["B 9123 XYZ", "CDD", "5 Ton", "Agus Setiawan", "0812-0000-1111", "Available", ""],
    ["B 8821 ABC", "Wingbox", "10 Ton", "Budi Hartono", "0813-2222-3333", "Available", "Servis rutin tiap 3 bulan"],
  ]);
}
