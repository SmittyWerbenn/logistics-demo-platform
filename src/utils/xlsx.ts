/** Writes a real .xlsx (not CSV) and triggers a browser download. A comma CSV
 * opens as a single column in Excel with Indonesian regional settings (list
 * separator ";"), which defeats files meant to be edited and re-imported, so
 * master-data exports use .xlsx. The library is loaded lazily - it is only
 * needed when the user actually exports. */
export async function downloadXlsx(
  filename: string,
  headers: readonly string[],
  rows: string[][],
  columnWidths?: number[],
): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/universal");
  const sheet = [headers.map((h) => ({ value: h, fontWeight: "bold" as const })), ...rows];
  const blob = await writeXlsxFile(sheet, {
    columns: columnWidths?.map((width) => ({ width })),
  }).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
