import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { useRef, useState } from "react";
import { useFleet } from "../store/FleetContext";
import type { ArmadaStatus } from "../types";
import { readTableFromFile } from "../utils/csv";
import {
  downloadBulkFleetTemplate,
  normalizeArmadaStatus,
  normalizeTruckJenis,
  tableToBulkFleetRows,
  type BulkFleetRowInput,
} from "../utils/fleetImport";
import { ARMADA_STATUS_OPTIONS } from "../utils/status";

interface BulkFleetRow extends BulkFleetRowInput {
  id: string;
  jenisValue: string;
  statusValue: ArmadaStatus;
}

let rowSeq = 0;
function newRowId() {
  rowSeq += 1;
  return `bulk-armada-${Date.now()}-${rowSeq}`;
}

function emptyRow(): BulkFleetRow {
  return {
    id: newRowId(),
    nomorUnit: "",
    jenis: "",
    jenisValue: "Wingbox",
    kapasitas: "",
    driverNama: "",
    driverTelepon: "",
    status: "",
    statusValue: "Available",
    keterangan: "",
  };
}

function fromInput(input: BulkFleetRowInput): BulkFleetRow {
  return {
    ...input,
    id: newRowId(),
    jenisValue: normalizeTruckJenis(input.jenis),
    statusValue: normalizeArmadaStatus(input.status),
  };
}

function isRowBlank(row: BulkFleetRow): boolean {
  return !row.nomorUnit.trim() && !row.kapasitas.trim() && !row.driverNama.trim();
}

function normalizeNomorUnit(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function rowErrors(row: BulkFleetRow, existingNomorUnit: string[], allRows: BulkFleetRow[]): string[] {
  const errs: string[] = [];
  if (!row.nomorUnit.trim()) errs.push("Nomor unit kosong");
  if (!row.kapasitas.trim()) errs.push("Kapasitas kosong");
  if (!row.driverNama.trim()) errs.push("Nama driver kosong");
  if (!row.driverTelepon.trim()) errs.push("No HP driver kosong");

  const normalized = normalizeNomorUnit(row.nomorUnit);
  if (normalized) {
    if (existingNomorUnit.includes(normalized)) {
      errs.push(`"${row.nomorUnit.trim()}" sudah ada di master data`);
    } else if (allRows.some((r) => r.id !== row.id && normalizeNomorUnit(r.nomorUnit) === normalized)) {
      errs.push(`"${row.nomorUnit.trim()}" duplikat di baris lain pada tabel ini`);
    }
  }
  return errs;
}

const cellInputClass =
  "w-full min-w-[140px] rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100";

export function BulkFleetImport({ existingNomorUnit = [] }: { existingNomorUnit?: string[] }) {
  const { createTruck } = useFleet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BulkFleetRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: string[]; skipped: number } | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  function updateRow<K extends keyof BulkFleetRow>(id: string, key: K, value: BulkFleetRow[K]) {
    setResult(null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
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
      const { rows: parsed, headerError } = tableToBulkFleetRows(table);
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
    const withErrors = rows.map((r) => ({ row: r, errors: rowErrors(r, existingNomorUnit, rows) }));
    const validRows = withErrors.filter((r) => r.errors.length === 0).map((r) => r.row);
    let skipped = rows.length - validRows.length;
    if (validRows.length === 0) return;

    setSubmitting(true);
    setImportError(null);
    const created: string[] = [];
    for (const row of validRows) {
      try {
        await createTruck({
          nomorUnit: row.nomorUnit.trim(),
          jenis: row.jenisValue,
          kapasitas: row.kapasitas.trim(),
          driverNama: row.driverNama.trim(),
          driverTelepon: row.driverTelepon.trim(),
          status: row.statusValue,
          keterangan: row.keterangan.trim() || undefined,
        });
        created.push(row.nomorUnit.trim());
      } catch {
        skipped += 1;
      }
    }
    setResult({ created, skipped });
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setSubmitting(false);
  }

  const rowsWithErrors = rows.map((r) => ({ row: r, errors: rowErrors(r, existingNomorUnit, rows) }));
  const validCount = rowsWithErrors.filter((r) => r.errors.length === 0).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Bulk Input / Import Excel</h2>
            <p className="mt-1 text-xs text-slate-500">
              Isi beberapa baris sekaligus, atau import dari file Excel (.xlsx) / CSV sesuai template. Kolom:
              Nomor Unit, Jenis, Kapasitas, Nama Driver, No HP Driver, Status, Keterangan (Opsional).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadBulkFleetTemplate}
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[920px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-2.5 py-2.5">Status</th>
              <th className="px-2.5 py-2.5">Nomor Unit</th>
              <th className="px-2.5 py-2.5">Jenis</th>
              <th className="px-2.5 py-2.5">Kapasitas</th>
              <th className="px-2.5 py-2.5">Nama Driver</th>
              <th className="px-2.5 py-2.5">No HP Driver</th>
              <th className="px-2.5 py-2.5">Status Armada</th>
              <th className="px-2.5 py-2.5">Keterangan</th>
              <th className="px-2.5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rowsWithErrors.map(({ row, errors }) => (
              <tr key={row.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="relative px-2.5 py-2">
                  {errors.length === 0 ? (
                    <span title="Baris valid" className="inline-flex text-emerald-600">
                      <CheckCircle2 size={16} />
                    </span>
                  ) : (
                    <div className="inline-block">
                      <span
                        onMouseEnter={() => setHoveredRowId(row.id)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        onFocus={() => setHoveredRowId(row.id)}
                        onBlur={() => setHoveredRowId(null)}
                        tabIndex={0}
                        className="inline-flex cursor-help text-amber-500 focus:outline-none"
                      >
                        <AlertTriangle size={16} />
                      </span>
                      {hoveredRowId === row.id && (
                        <div className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded-lg border border-slate-200 bg-white p-3 text-left normal-case leading-relaxed text-slate-600 shadow-lg">
                          <p className="mb-1.5 text-[11px] font-semibold text-slate-800">
                            Baris ini belum lengkap:
                          </p>
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
                <td className="px-2.5 py-2">
                  <input
                    className={`${cellInputClass} min-w-[120px]`}
                    value={row.nomorUnit}
                    onChange={(e) => updateRow(row.id, "nomorUnit", e.target.value)}
                    placeholder="B 9123 XYZ"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    list="jenis-truck-suggestions"
                    className={cellInputClass}
                    value={row.jenisValue}
                    onChange={(e) => updateRow(row.id, "jenisValue", e.target.value)}
                    placeholder="Contoh: Wingbox"
                    autoComplete="off"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.kapasitas}
                    onChange={(e) => updateRow(row.id, "kapasitas", e.target.value)}
                    placeholder="8 Ton"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.driverNama}
                    onChange={(e) => updateRow(row.id, "driverNama", e.target.value)}
                    placeholder="Nama driver"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.driverTelepon}
                    onChange={(e) => updateRow(row.id, "driverTelepon", e.target.value)}
                    placeholder="08xx"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <select
                    className={cellInputClass}
                    value={row.statusValue}
                    onChange={(e) => updateRow(row.id, "statusValue", e.target.value as ArmadaStatus)}
                  >
                    {ARMADA_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={`${cellInputClass} min-w-[160px]`}
                    value={row.keterangan}
                    onChange={(e) => updateRow(row.id, "keterangan", e.target.value)}
                    placeholder="Opsional"
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
            ))}
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
          </p>
          <button
            type="button"
            onClick={handleSubmitAll}
            disabled={submitting || validCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
            Simpan {validCount > 0 ? validCount : ""} Armada
          </button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={18} />
            <p className="text-sm font-semibold">
              {result.created.length} armada berhasil ditambahkan
              {result.skipped > 0 ? `, ${result.skipped} baris dilewati karena tidak valid.` : "."}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {result.created.map((nomor, i) => (
              <span key={`${nomor}-${i}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                {nomor}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
