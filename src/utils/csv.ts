// Generic CSV helpers shared by every bulk-import/export feature (shipments,
// locations, ...) so parsing/writing logic isn't duplicated per feature.

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ").replace(/[()]/g, "");
}

/** Simple RFC4180-ish CSV parser: handles quoted fields, embedded commas/quotes/newlines. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/^﻿/, ""); // strip BOM

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadCsv(filename: string, headers: readonly string[], rows: string[][]) {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Reads an uploaded .csv or .xlsx File into a raw 2D table of cell values. */
export async function readTableFromFile(file: File): Promise<string[][]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
  if (isCsv) {
    const text = await file.text();
    return parseCsvText(text);
  }
  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  return rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
}
