import type { LayananPengiriman } from "../types";
import { downloadCsv, normalizeHeader } from "./csv";

export { parseCsvText } from "./csv";

export const BULK_TEMPLATE_HEADERS = [
  "Referensi",
  "Nama Pengirim",
  "No HP Pengirim",
  "Email Pengirim",
  "Nama Penerima",
  "No HP Penerima",
  "Email Penerima",
  "Kota Asal",
  "Alamat Asal",
  "Kota Tujuan",
  "Alamat Tujuan",
  "Layanan",
  "Berat Final (Kg)",
  "Jumlah Koli",
  "Deskripsi Barang",
  "Nomor Polisi Truck (Opsional)",
  "Target Pengiriman Hari (Opsional)",
  "Asuransi (Ya/Tidak)",
  "Koli Diasuransi",
  "Nilai Asuransi (Rp)",
] as const;

export interface BulkRowInput {
  /** Customer's own order id; the AWB the system issues is tied to it (never to the row position). */
  referensi: string;
  pengirimNama: string;
  pengirimTelepon: string;
  pengirimEmail: string;
  penerimaNama: string;
  penerimaTelepon: string;
  penerimaEmail: string;
  kotaAsal: string;
  alamatAsal: string;
  kotaTujuan: string;
  alamatTujuan: string;
  layanan: string;
  beratKg: string;
  jumlahKoli: string;
  deskripsiBarang: string;
  nomorPolisiTruck: string;
  slaValue: string;
  asuransi: string;
  koliAsuransi: string;
  nilaiAsuransi: string;
}

const FIELD_ORDER: (keyof BulkRowInput)[] = [
  "referensi",
  "pengirimNama",
  "pengirimTelepon",
  "pengirimEmail",
  "penerimaNama",
  "penerimaTelepon",
  "penerimaEmail",
  "kotaAsal",
  "alamatAsal",
  "kotaTujuan",
  "alamatTujuan",
  "layanan",
  "beratKg",
  "jumlahKoli",
  "deskripsiBarang",
  "nomorPolisiTruck",
  "slaValue",
  "asuransi",
  "koliAsuransi",
  "nilaiAsuransi",
];

const HEADER_LOOKUP = new Map(BULK_TEMPLATE_HEADERS.map((h, i) => [normalizeHeader(h), FIELD_ORDER[i]]));

// Backward-compatible aliases: old header names still resolve to the same field,
// so files exported with previous headers ("Berat (Kg)", "Berat Total (Kg)") keep working.
const HEADER_ALIASES: [string, keyof BulkRowInput][] = [
  [normalizeHeader("Berat (Kg)"), "beratKg"],
  [normalizeHeader("Berat Total (Kg)"), "beratKg"],
];
for (const [alias, field] of HEADER_ALIASES) {
  if (!HEADER_LOOKUP.has(alias)) HEADER_LOOKUP.set(alias, field);
}

/**
 * Converts a raw 2D table (from CSV parsing or read-excel-file) into row
 * objects, matching the header row against BULK_TEMPLATE_HEADERS
 * (case/spacing-insensitive) so column order in the uploaded file doesn't
 * matter as long as the header names match.
 */
export function tableToBulkRows(table: unknown[][]): {
  rows: BulkRowInput[];
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

  const rows: BulkRowInput[] = [];
  for (let r = 1; r < table.length; r++) {
    const raw = table[r];
    if (!raw || raw.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;

    const record: Partial<BulkRowInput> = {};
    fieldByColumn.forEach((field, colIndex) => {
      if (!field) return;
      const cell = raw[colIndex];
      record[field] = cell === null || cell === undefined ? "" : String(cell).trim();
    });

    rows.push({
      referensi: record.referensi ?? "",
      pengirimNama: record.pengirimNama ?? "",
      pengirimTelepon: record.pengirimTelepon ?? "",
      pengirimEmail: record.pengirimEmail ?? "",
      penerimaNama: record.penerimaNama ?? "",
      penerimaTelepon: record.penerimaTelepon ?? "",
      penerimaEmail: record.penerimaEmail ?? "",
      kotaAsal: record.kotaAsal ?? "",
      alamatAsal: record.alamatAsal ?? "",
      kotaTujuan: record.kotaTujuan ?? "",
      alamatTujuan: record.alamatTujuan ?? "",
      layanan: record.layanan ?? "",
      beratKg: record.beratKg ?? "",
      jumlahKoli: record.jumlahKoli ?? "",
      deskripsiBarang: record.deskripsiBarang ?? "",
      nomorPolisiTruck: record.nomorPolisiTruck ?? "",
      slaValue: record.slaValue ?? "",
      asuransi: record.asuransi ?? "",
      koliAsuransi: record.koliAsuransi ?? "",
      nilaiAsuransi: record.nilaiAsuransi ?? "",
    });
  }

  return { rows };
}

/** Matches an imported layanan against the ACTIVE Master Layanan names
 * (case/whitespace-insensitive) and returns the stored spelling; anything
 * unmatched gets `fallback` (LTL when it's active - same rule the API
 * applies when creating the order). */
export function normalizeLayanan(value: string, activeOptions: string[], fallback: string): LayananPengiriman {
  const v = value.trim().toLowerCase();
  return activeOptions.find((o) => o.toLowerCase() === v) ?? fallback;
}

export function downloadBulkShipmentTemplate() {
  downloadCsv("template-bulk-pengiriman.csv", BULK_TEMPLATE_HEADERS, [
    [
      "ORD-001",
      "Contoh Pengirim",
      "0812-3456-7890",
      "pengirim@email.com",
      "Contoh Penerima",
      "0813-9988-2211",
      "penerima@email.com",
      "Jakarta",
      "Jl. Raya Cakung No. 88",
      "Bandung",
      "Jl. Soekarno Hatta No. 210",
      "Regular",
      "10",
      "1",
      "Contoh isi paket, 1 dus (10kg)",
      "",
      "3",
      "Tidak",
      "",
      "",
    ],
  ]);
}
