import type { TitikJenis, TitikLokasi } from "../types";
import { normalizeHeader } from "./csv";
import { downloadXlsx } from "./xlsx";

/** Template / export layout, in the same order as the listing table (Kode, Nama Area,
 * Jenis Titik, Provinsi, Kota / Kabupaten, Status). Only Kota / Kabupaten is
 * required; Jenis defaults to Transit and Status to Aktif. Import matches
 * headers by name, so files in the old column order still load (an old "Nama
 * Titik Transit" column is ignored). */
export const LOCATION_TEMPLATE_HEADERS = ["Kode", "Nama Area", "Jenis Titik", "Provinsi", "Kota / Kabupaten", "Status"] as const;

export interface BulkLocationRowInput {
  namaKota: string;
  provinsi: string;
  kodeKota: string;
  namaArea: string;
  jenis: string;
  aktif: string;
  /** Row number in the source file (header = row 1), for error messages. */
  sourceRow: number;
}

type Field = Exclude<keyof BulkLocationRowInput, "sourceRow">;

/** Header names accepted per field (compared case/spacing-insensitively).
 * Kota and Kabupaten are one column now, so every spelling of it maps to the
 * same field; the old "Nama Kota" / "Kode Kota" names keep working. */
const HEADER_ALIASES: Record<Field, string[]> = {
  namaKota: ["Kota / Kabupaten", "Kota/Kabupaten", "Kota", "Kabupaten", "Nama Kota"],
  provinsi: ["Provinsi"],
  kodeKota: ["Kode", "Kode Kota"],
  namaArea: ["Nama Area", "Area"],
  jenis: ["Jenis", "Jenis Titik"],
  aktif: ["Aktif", "Status"],
};

const HEADER_LOOKUP = new Map<string, Field>();
for (const [field, names] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
  for (const n of names) HEADER_LOOKUP.set(normalizeHeader(n), field);
}

const REQUIRED_FIELDS: { field: Field; label: string }[] = [
  { field: "namaKota", label: "Kota / Kabupaten" },
];

/**
 * Converts a raw 2D table (CSV or read-excel-file) into row objects, matching
 * the header row by name (case/spacing-insensitive), so column order doesn't
 * matter. Fails with a clear message when a required column is missing. If a
 * file has both a "Kota" and a "Kabupaten" column, the first non-empty value
 * of the two is used.
 */
export function tableToBulkLocationRows(table: unknown[][]): {
  rows: BulkLocationRowInput[];
  headerError?: string;
} {
  if (table.length === 0) return { rows: [], headerError: "File kosong." };

  const headerRow = table[0].map((c) => normalizeHeader(String(c ?? "")));
  const fieldByColumn = headerRow.map((h) => HEADER_LOOKUP.get(h));
  const present = new Set(fieldByColumn.filter((f): f is Field => !!f));

  if (present.size === 0) {
    return { rows: [], headerError: "Header kolom tidak dikenali. Gunakan template yang disediakan (Kode, Jenis Titik, Provinsi, Kota / Kabupaten, Status)." };
  }
  const missing = REQUIRED_FIELDS.filter((r) => !present.has(r.field)).map((r) => r.label);
  if (missing.length > 0) {
    return { rows: [], headerError: `Kolom wajib tidak ditemukan di file: ${missing.join(", ")}. Gunakan template yang disediakan.` };
  }

  const rows: BulkLocationRowInput[] = [];
  for (let r = 1; r < table.length; r++) {
    const raw = table[r];
    if (!raw || raw.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;

    const record: Partial<Record<Field, string>> = {};
    fieldByColumn.forEach((field, colIndex) => {
      if (!field) return;
      const cell = raw[colIndex];
      const value = cell === null || cell === undefined ? "" : String(cell).trim();
      if (!record[field]) record[field] = value;
    });

    rows.push({
      namaKota: record.namaKota ?? "",
      provinsi: record.provinsi ?? "",
      kodeKota: record.kodeKota ?? "",
      namaArea: record.namaArea ?? "",
      jenis: record.jenis ?? "",
      aktif: record.aktif ?? "",
      sourceRow: r + 1,
    });
  }

  return { rows };
}

const JENIS_VALUES: TitikJenis[] = ["Gudang", "Hub", "Transit", "Cabang", "Tujuan"];

export function normalizeJenis(value: string): TitikJenis {
  const v = value.trim().toLowerCase();
  const match = JENIS_VALUES.find((j) => j.toLowerCase() === v);
  return match ?? "Transit";
}

/** Blank/"ya"/"aktif"/"true"/"1" all read as active; anything else (e.g.
 * "tidak", "nonaktif", "0") reads as inactive. Export writes "Aktif"/"Nonaktif". */
export function normalizeAktif(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === "") return true;
  return ["ya", "aktif", "true", "1", "yes", "active"].includes(v);
}

/** Case/whitespace-insensitive identity of a location (Provinsi + Kota /
 * Kabupaten) - the same rule the API uses for duplicates. */
export function locationIdentity(kota: string, provinsi: string): string {
  return [kota, provinsi].map((s) => s.trim().replace(/\s+/g, " ").toLowerCase()).join("\u0001");
}

const COLUMN_WIDTHS = [10, 24, 14, 24, 30, 10];

/** Downloads every Kota & Titik Transit as .xlsx in the same layout the import
 * reads, so the file can be completed and uploaded back as-is. */
export async function exportLocationsXlsx(titik: TitikLokasi[]): Promise<void> {
  const sorted = [...titik].sort(
    (a, b) =>
      a.provinsi.localeCompare(b.provinsi, "id") ||
      a.namaKota.localeCompare(b.namaKota, "id"),
  );
  const today = new Date().toISOString().slice(0, 10);
  await downloadXlsx(
    `kota-titik-transit-${today}.xlsx`,
    LOCATION_TEMPLATE_HEADERS,
    sorted.map((t) => [t.kodeKota, t.namaArea, t.jenis, t.provinsi, t.namaKota, t.aktif ? "Aktif" : "Nonaktif"]),
    COLUMN_WIDTHS,
  );
}

export async function downloadBulkLocationTemplate(): Promise<void> {
  await downloadXlsx(
    "template-kota-titik-transit.xlsx",
    LOCATION_TEMPLATE_HEADERS,
    [
      ["JKT", "Jakarta Timur Area 1", "Transit", "DKI Jakarta", "Jakarta Timur", "Aktif"],
      ["SMG", "Semarang Raya", "Hub", "Jawa Tengah", "Kabupaten Semarang", "Aktif"],
    ],
    COLUMN_WIDTHS,
  );
}
