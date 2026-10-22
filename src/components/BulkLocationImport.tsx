import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  MapPinned,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocations, type TitikImportFailure } from "../store/LocationContext";
import type { TitikJenis } from "../types";
import { readTableFromFile } from "../utils/csv";
import {
  downloadBulkLocationTemplate,
  normalizeAktif,
  normalizeJenis,
  tableToBulkLocationRows,
  type BulkLocationRowInput,
} from "../utils/locationImport";

interface BulkLocationRow extends Omit<BulkLocationRowInput, "sourceRow"> {
  id: string;
  /** Row number in the imported file; undefined for rows typed in by hand. */
  sourceRow?: number;
  jenisValue: TitikJenis;
  aktifValue: boolean;
  /** Reason the server refused this row on the last save (cleared on edit). */
  serverError?: string;
}

const JENIS_OPTIONS: TitikJenis[] = ["Gudang", "Hub", "Transit", "Cabang", "Tujuan"];

let rowSeq = 0;
function newRowId() {
  rowSeq += 1;
  return `bulk-lokasi-${Date.now()}-${rowSeq}`;
}

function emptyRow(): BulkLocationRow {
  return {
    id: newRowId(),
    namaKota: "",
    provinsi: "",
    kodeKota: "",
    namaArea: "",
    jenis: "",
    jenisValue: "Transit",
    aktif: "",
    aktifValue: true,
  };
}

function fromInput(input: BulkLocationRowInput): BulkLocationRow {
  const { sourceRow, ...rest } = input;
  return {
    ...rest,
    id: newRowId(),
    sourceRow,
    jenisValue: normalizeJenis(input.jenis),
    aktifValue: normalizeAktif(input.aktif),
  };
}

function isRowBlank(row: BulkLocationRow): boolean {
  return !row.namaKota.trim() && !row.provinsi.trim() && !row.kodeKota.trim() && !row.namaArea.trim();
}

/** Validation for every row at once (duplicates inside the table need the
 * whole list): Kota / Kabupaten is required, and Nama Area + Jenis Titik must not
 * repeat - against existing data or an earlier row. The same Kota / Kabupaten may
 * appear any number of times, and the same Nama Area with a different Jenis Titik
 * is fine. Returns row id -> list of problems. */
function validateRows(rows: BulkLocationRow[], existingAreas: Map<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const seenAreas = new Map<string, number>(); // area+jenis -> position of the first row using it
  let position = 0;
  for (const row of rows) {
    position += 1;
    const errs: string[] = [];
    if (!row.namaKota.trim()) errs.push("Kota / Kabupaten wajib diisi");
    const area = row.namaArea.trim().toLowerCase();
    if (area) {
      const key = `${area}\u0001${row.jenisValue}`;
      const owner = existingAreas.get(key);
      const firstRow = seenAreas.get(key);
      if (owner) errs.push(`Nama Area "${row.namaArea.trim()}" dengan Jenis Titik ${row.jenisValue} sudah ada di master data (dipakai oleh ${owner})`);
      else if (firstRow !== undefined) errs.push(`Nama Area "${row.namaArea.trim()}" dengan Jenis Titik ${row.jenisValue} duplikat dengan baris tabel #${firstRow}`);
      else seenAreas.set(key, position);
    }
    if (row.serverError) errs.push(`Ditolak server: ${row.serverError}`);
    out.set(row.id, errs);
  }
  return out;
}

/** "Baris 12" for rows from the file, "Baris tabel #3" for hand-typed ones. */
function rowLabel(row: BulkLocationRow, position: number): string {
  return row.sourceRow ? `Baris ${row.sourceRow}` : `Baris tabel #${position}`;
}

const cellInputClass =
  "w-full min-w-[140px] rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100";

export function BulkLocationImport({ existingAreas = [], onImported }: { /** "area\u0001jenis\u0001Kota" entries already in master data (area lower-cased). */ existingAreas?: string[]; onImported?: () => void }) {
  const { importTitik } = useLocations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BulkLocationRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    notSubmitted: number;
    failed: (TitikImportFailure & { label: string })[];
  } | null>(null);
  // Tooltip is positioned with `fixed` from the icon's rect so the scrollable
  // table container can't clip it (rows near the bottom used to be cut off).
  const [hovered, setHovered] = useState<{ id: string; left: number; top: number; above: boolean } | null>(null);
  function showTip(id: string, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const above = r.bottom + 150 > window.innerHeight;
    setHovered({ id, left: Math.max(8, Math.min(r.left, window.innerWidth - 272)), top: above ? r.top - 6 : r.bottom + 6, above });
  }

  const areaMap = useMemo(() => new Map(existingAreas.map((e) => { const [a, j, k] = e.split("\u0001"); return [`${a}\u0001${j}`, k] as [string, string]; })), [existingAreas]);
  const errorsById = useMemo(() => validateRows(rows, areaMap), [rows, areaMap]);

  function updateRow<K extends keyof BulkLocationRow>(id: string, key: K, value: BulkLocationRow[K]) {
    setResult(null);
    // Editing a row clears the server's earlier verdict on it.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value, serverError: undefined } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    setImporting(true);
    setResult(null);
    try {
      const table = await readTableFromFile(file);
      const { rows: parsed, headerError } = tableToBulkLocationRows(table);
      if (headerError) {
        setImportError(headerError);
        return;
      }
      if (parsed.length === 0) {
        setImportError("Tidak ada baris data yang terbaca dari file.");
        return;
      }
      const imported = parsed.map(fromInput);
      setRows((prev) => {
        const withoutBlanks = prev.filter((r) => !isRowBlank(r));
        return [...withoutBlanks, ...imported];
      });
    } catch (err) {
      setImportError(
        err instanceof Error
          ? `Gagal membaca file: ${err.message}`
          : "Gagal membaca file. Pastikan formatnya .xlsx atau .csv.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmitAll() {
    const submittable = rows.filter((r) => (errorsById.get(r.id) ?? []).length === 0);
    if (submittable.length === 0) return;

    setSubmitting(true);
    setImportError(null);
    try {
      // row = position in this submission; mapped back to the table row below.
      const res = await importTitik(
        submittable.map((r, i) => ({
          row: i + 1,
          namaKota: r.namaKota.trim(),
          provinsi: r.provinsi.trim(),
          kodeKota: r.kodeKota.trim().toUpperCase(),
          namaArea: r.namaArea.trim(),
          jenis: r.jenisValue,
          aktif: r.aktifValue,
        })),
      );
      onImported?.();
      const failedByRow = new Map(res.failed.map((f) => [f.row, f.message]));
      const okIds = new Set<string>();
      const failedRows: (TitikImportFailure & { label: string })[] = [];
      const serverErrorById = new Map<string, string>();
      submittable.forEach((r, i) => {
        const msg = failedByRow.get(i + 1);
        if (msg === undefined) {
          okIds.add(r.id);
        } else {
          serverErrorById.set(r.id, msg);
          failedRows.push({
            row: i + 1,
            kota: r.namaKota,
            provinsi: r.provinsi,
            message: msg,
            label: rowLabel(r, rows.findIndex((x) => x.id === r.id) + 1),
          });
        }
      });
      // Saved rows leave the table; rows that still need attention (invalid,
      // or refused by the server) stay so they can be fixed and sent again.
      const remaining = rows
        .filter((r) => !okIds.has(r.id))
        .map((r) => (serverErrorById.has(r.id) ? { ...r, serverError: serverErrorById.get(r.id) } : r));
      setRows(remaining.length > 0 ? remaining : [emptyRow(), emptyRow(), emptyRow()]);
      setResult({
        created: res.created,
        notSubmitted: rows.length - submittable.length,
        failed: failedRows,
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Gagal menyimpan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const validCount = rows.filter((r) => (errorsById.get(r.id) ?? []).length === 0).length;
  const invalidCount = rows.filter((r) => !isRowBlank(r) && (errorsById.get(r.id) ?? []).length > 0).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Bulk Input / Import Excel</h2>
            <p className="mt-1 text-xs text-slate-500">
              Isi beberapa baris sekaligus, atau import dari file Excel (.xlsx) / CSV. Urutan kolom: Kode, Nama Area,
              Jenis Titik, Provinsi, Kota / Kabupaten, Status. Kolom wajib:{" "}
              <span className="font-semibold text-slate-700">Kota / Kabupaten</span>. Kolom opsional: Kode, Nama Area, Jenis Titik
              (Gudang/Hub/Transit/Cabang/Tujuan, default Transit), Provinsi, Status (Aktif/Nonaktif, default Aktif). Baris
              yang sama persis (Provinsi + Kota / Kabupaten) tidak akan dibuat dobel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadBulkLocationTemplate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Download size={14} />
              Unduh Template
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-60"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              Import Excel / CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
        {importError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {importError}
          </div>
        )}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[940px] border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-2.5 py-2.5">Cek</th>
              <th className="px-2.5 py-2.5">Baris</th>
              <th className="px-2.5 py-2.5">Kode</th>
              <th className="px-2.5 py-2.5">Nama Area</th>
              <th className="px-2.5 py-2.5">Jenis Titik</th>
              <th className="px-2.5 py-2.5">Provinsi</th>
              <th className="px-2.5 py-2.5">Kota / Kabupaten</th>
              <th className="px-2.5 py-2.5">Status Aktif</th>
              <th className="px-2.5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const errors = errorsById.get(row.id) ?? [];
              return (
                <tr key={row.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="relative px-2.5 py-2">
                    {errors.length === 0 ? (
                      <span title="Baris valid" className="inline-flex text-emerald-600">
                        <CheckCircle2 size={16} />
                      </span>
                    ) : (
                      <div className="inline-block">
                        <span
                          onMouseEnter={(e) => showTip(row.id, e.currentTarget)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={(e) => showTip(row.id, e.currentTarget)}
                          onBlur={() => setHovered(null)}
                          tabIndex={0}
                          aria-label={`Masalah: ${errors.join("; ")}`}
                          className="inline-flex cursor-help text-amber-500 focus:outline-none"
                        >
                          <AlertTriangle size={16} />
                        </span>
                        {hovered?.id === row.id && (
                          <div
                            style={{ left: hovered.left, top: hovered.top, transform: hovered.above ? "translateY(-100%)" : undefined }}
                            className="fixed z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left normal-case leading-relaxed text-slate-600 shadow-lg"
                          >
                            <p className="mb-1.5 text-[11px] font-semibold text-slate-800">Baris ini bermasalah:</p>
                            <ul className="list-disc space-y-0.5 pl-3.5 text-[11px]">
                              {errors.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 text-[11px] text-slate-400">
                    {row.sourceRow ?? `#${index + 1}`}
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      className={`${cellInputClass} min-w-[80px] uppercase`}
                      value={row.kodeKota}
                      onChange={(e) => updateRow(row.id, "kodeKota", e.target.value)}
                      placeholder="JKT"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      className={`${cellInputClass} min-w-[140px]`}
                      value={row.namaArea}
                      onChange={(e) => updateRow(row.id, "namaArea", e.target.value)}
                      placeholder="Nama area"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <select
                      className={cellInputClass}
                      value={row.jenisValue}
                      onChange={(e) => updateRow(row.id, "jenisValue", e.target.value as TitikJenis)}
                    >
                      {JENIS_OPTIONS.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      className={cellInputClass}
                      value={row.provinsi}
                      onChange={(e) => updateRow(row.id, "provinsi", e.target.value)}
                      placeholder="DKI Jakarta"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      className={cellInputClass}
                      value={row.namaKota}
                      onChange={(e) => updateRow(row.id, "namaKota", e.target.value)}
                      placeholder="Jakarta Pusat"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      type="checkbox"
                      checked={row.aktifValue}
                      onChange={(e) => updateRow(row.id, "aktifValue", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      title="Hapus baris"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Plus size={14} />
          Tambah Baris
        </button>

        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{validCount}</span> dari {rows.length} baris valid
            {invalidCount > 0 && <span className="text-amber-600"> · {invalidCount} bermasalah</span>}
          </p>
          <button
            type="button"
            onClick={handleSubmitAll}
            disabled={submitting || validCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <MapPinned size={16} />}
            Simpan {validCount > 0 ? validCount : ""} Titik
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`rounded-xl border p-5 shadow-sm ${
            result.failed.length > 0 || result.notSubmitted > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              result.failed.length > 0 || result.notSubmitted > 0 ? "text-amber-900" : "text-emerald-800"
            }`}
          >
            {result.failed.length > 0 || result.notSubmitted > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <p className="text-sm font-semibold">
              {result.created} titik lokasi berhasil ditambahkan
              {result.failed.length > 0 ? `, ${result.failed.length} baris ditolak server` : ""}
              {result.notSubmitted > 0 ? `, ${result.notSubmitted} baris belum valid dan tidak dikirim` : ""}.
            </p>
          </div>
          {(result.failed.length > 0 || result.notSubmitted > 0) && (
            <p className="mt-1.5 text-xs text-amber-800">
              Baris yang bermasalah tetap ada di tabel di atas. Perbaiki lalu simpan lagi.
            </p>
          )}
          {result.failed.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="bg-amber-100/60 text-[11px] uppercase tracking-wide text-amber-900">
                  <tr>
                    <th className="px-3 py-2">Baris</th>
                    <th className="px-3 py-2">Provinsi</th>
                    <th className="px-3 py-2">Kota / Kabupaten</th>
                    <th className="px-3 py-2">Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-slate-700">
                  {result.failed.map((f) => (
                    <tr key={`${f.row}-${f.label}`}>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{f.label}</td>
                      <td className="px-3 py-2">{f.provinsi || "-"}</td>
                      <td className="px-3 py-2">{f.kota || "-"}</td>
                      <td className="px-3 py-2 text-red-700">{f.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
