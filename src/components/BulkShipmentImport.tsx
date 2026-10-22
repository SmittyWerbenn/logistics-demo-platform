import { adminPath } from "../utils/urls";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { useFleet } from "../store/FleetContext";
import { useLayanan } from "../store/LayananContext";
import { useShipments } from "../store/ShipmentContext";
import type { LayananPengiriman } from "../types";
import { ApiError, api } from "../utils/apiClient";

/** Outcome of one imported row, tied to its Referensi (never to the row position). */
interface ImportResultRow {
  referensi: string;
  status: "Berhasil" | "Sudah ada" | "Gagal";
  awb?: string;
  keterangan: string;
  kotaAsal: string;
  kotaTujuan: string;
}
import { downloadCsv, readTableFromFile } from "../utils/csv";
import {
  downloadBulkShipmentTemplate,
  normalizeLayanan,
  tableToBulkRows,
  type BulkRowInput,
} from "../utils/shipmentImport";

interface BulkRow extends BulkRowInput {
  id: string;
  layananValue: LayananPengiriman;
}

let rowSeq = 0;
function newRowId() {
  rowSeq += 1;
  return `bulk-row-${Date.now()}-${rowSeq}`;
}

function emptyRow(): BulkRow {
  return {
    id: newRowId(),
    referensi: "",
    pengirimNama: "",
    pengirimTelepon: "",
    pengirimEmail: "",
    penerimaNama: "",
    penerimaTelepon: "",
    penerimaEmail: "",
    kotaAsal: "",
    alamatAsal: "",
    kotaTujuan: "",
    alamatTujuan: "",
    layanan: "",
    // "" = not chosen yet; resolves to the default active layanan (see layananOf).
    layananValue: "",
    beratKg: "",
    jumlahKoli: "",
    deskripsiBarang: "",
    nomorPolisiTruck: "",
    slaValue: "",
    asuransi: "",
    koliAsuransi: "",
    nilaiAsuransi: "",
  };
}

function fromInput(input: BulkRowInput, layananValue: LayananPengiriman): BulkRow {
  return {
    ...input,
    id: newRowId(),
    layananValue,
  };
}

/** Matches an imported city name against master data ignoring case/whitespace
 * differences, so e.g. "jakarta" or "JAKARTA " still resolves to "Jakarta".
 * Returns the original (trimmed) text unchanged if nothing matches, so the
 * dropdown can still show what was actually imported instead of going blank. */
function resolveKota(value: string, knownKota: string[]): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const exact = knownKota.find((k) => k === trimmed);
  if (exact) return exact;
  const loose = trimmed.toLowerCase().replace(/\s+/g, " ");
  return knownKota.find((k) => k.toLowerCase() === loose) ?? trimmed;
}

const normRef = (r: string) => r.trim().replace(/\s+/g, " ").toLowerCase();

function rowErrors(row: BulkRow, duplicateRows?: number[]): string[] {
  const errs: string[] = [];
  if (row.referensi.trim().length > 100) errs.push("Referensi maksimal 100 karakter");
  if (duplicateRows && duplicateRows.length > 1) {
    errs.push(`Referensi ${row.referensi.trim()} ditemukan lebih dari satu kali (baris ${duplicateRows.join(", ")})`);
  }
  if (!row.pengirimNama.trim()) errs.push("Nama pengirim kosong");
  if (!row.pengirimTelepon.trim()) errs.push("No HP pengirim kosong");
  if (!row.pengirimEmail.trim()) errs.push("Email pengirim kosong");
  if (!row.penerimaNama.trim()) errs.push("Nama penerima kosong");
  if (!row.penerimaTelepon.trim()) errs.push("No HP penerima kosong");
  if (!row.penerimaEmail.trim()) errs.push("Email penerima kosong");
  if (!row.kotaAsal.trim()) errs.push("Kota asal kosong");
  if (!row.alamatAsal.trim()) errs.push("Alamat asal kosong");
  if (!row.kotaTujuan.trim()) errs.push("Kota tujuan kosong");
  if (!row.alamatTujuan.trim()) errs.push("Alamat tujuan kosong");
  if (!row.deskripsiBarang.trim()) errs.push("Deskripsi barang kosong");
  const berat = Number(row.beratKg);
  if (!row.beratKg || !Number.isFinite(berat) || berat <= 0) errs.push("Berat Final tidak valid");
  const koli = Number(row.jumlahKoli);
  if (!row.jumlahKoli || !Number.isFinite(koli) || koli <= 0) errs.push("Jumlah koli tidak valid");
  if (row.slaValue.trim()) {
    const sla = Number(row.slaValue);
    if (!Number.isInteger(sla) || sla <= 0) errs.push("Target pengiriman harus angka bulat positif");
  }
  // Insurance: "Ya" requires koli + nilai.
  const asr = row.asuransi.trim().toLowerCase();
  const asrOn = asr === "ya" || asr === "y" || asr === "1";
  if (asr && !asrOn && asr !== "tidak" && asr !== "t" && asr !== "0" && asr !== "tidak") {
    errs.push("Asuransi harus diisi 'Ya' atau 'Tidak'");
  }
  if (asrOn) {
    if (!row.koliAsuransi.trim()) errs.push("Koli diasuransikan wajib diisi jika Asuransi = Ya");
    const nilai = Number(row.nilaiAsuransi);
    if (!row.nilaiAsuransi.trim() || !Number.isFinite(nilai) || nilai <= 0) errs.push("Nilai asuransi wajib diisi > 0 jika Asuransi = Ya");
  }
  return errs;
}

const cellInputClass =
  "w-full min-w-[140px] rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100";

export function BulkShipmentImport() {
  const { createShipment } = useShipments();
  const { trucksWithDriver } = useFleet();
  const { activeNames: layananOptions, refresh: refreshLayanan } = useLayanan();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCustAdmin = profile?.role === "Client";

  const [rows, setRows] = useState<BulkRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);

  useEffect(() => {
    refreshLayanan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Layanan for a row the user hasn't touched: Regular when active (as
  // before), else the first active Master Layanan entry.
  const defaultLayanan = layananOptions.includes("Regular") ? "Regular" : (layananOptions[0] ?? "");
  const layananOf = (row: BulkRow) => (layananOptions.includes(row.layananValue) ? row.layananValue : defaultLayanan);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ rows: ImportResultRow[]; skipped: number } | null>(null);
  const [hoveredStatusRowId, setHoveredStatusRowId] = useState<string | null>(null);
  // Bulk import applies one Client ID to the whole batch, rather than
  // a per-row column - keeps the import table/template unchanged.
  const [customerId, setCustomerId] = useState(isCustAdmin ? profile?.customerId ?? "" : "");
  const [customerIds, setCustomerIds] = useState<string[]>([]);

  useEffect(() => {
    if (isCustAdmin) return;
    api
      .get<{ items: string[] }>("/api/customer-ids")
      .then((res) => setCustomerIds(res.items))
      .catch(() => setCustomerIds([]));
  }, [isCustAdmin]);

  const truckOptions = trucksWithDriver.filter((t) => t.status !== "Inactive");

  function updateRow<K extends keyof BulkRow>(id: string, key: K, value: BulkRow[K]) {
    setResult(null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function isRowBlank(row: BulkRow): boolean {
    return FIELDS_TO_CHECK_BLANK.every((k) => !String(row[k]).trim());
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

      const { rows: parsed, headerError } = tableToBulkRows(table);
      if (headerError) {
        setImportError(headerError);
        return;
      }
      if (parsed.length === 0) {
        setImportError("Tidak ada baris data yang terbaca dari file.");
        return;
      }

      // An imported layanan that matches an active Master Layanan entry is
      // used; anything else falls back to LTL (the API applies the same
      // rule, this just shows it in the preview table first).
      const fallbackLayanan = layananOptions.includes("LTL") ? "LTL" : "";
      // Canonical city spelling comes from the API (one lookup for the whole file) rather than a downloaded master list.
      let knownKota: string[] = [];
      try {
        const res = await api.post<{ items: string[] }>(
          "/api/public/locations/match-kota",
          { names: parsed.flatMap((p) => [p.kotaAsal, p.kotaTujuan]) },
          { auth: false },
        );
        knownKota = res.items;
      } catch {
        /* keep the imported spelling as typed */
      }
      const imported = parsed.map((p) =>
        fromInput(
          {
            ...p,
            kotaAsal: resolveKota(p.kotaAsal, knownKota),
            kotaTujuan: resolveKota(p.kotaTujuan, knownKota),
          },
          normalizeLayanan(p.layanan, layananOptions, fallbackLayanan),
        ),
      );
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
    if (!customerId.trim()) {
      setImportError("Client ID wajib diisi sebelum menerbitkan resi.");
      return;
    }
    if (submitting) return;
    const withErrors = rowsWithErrors;
    const validRows = withErrors.filter((r) => r.errors.length === 0).map((r) => r.row);
    const skipped = rows.length - validRows.length;
    if (validRows.length === 0) return;

    setImportError(null);
    setSubmitting(true);
    // One request per row; the AWB comes back in THAT row's own response and is recorded against its Referensi.
    // A row that fails (or is a duplicate Referensi) never affects the others, and no AWB is borrowed from another row.
    const outcome: ImportResultRow[] = [];
    const failedIds = new Set<string>();
    for (const row of validRows) {
      const truck = truckOptions.find(
        (t) => t.nomorUnit.replace(/\s+/g, "").toLowerCase() === row.nomorPolisiTruck.replace(/\s+/g, "").toLowerCase(),
      );
      const base = { referensi: row.referensi.trim() || "-", kotaAsal: row.kotaAsal, kotaTujuan: row.kotaTujuan };
      try {
        const { awb } = await createShipment({
          reference: row.referensi.trim() || undefined,
          pengirim: { nama: row.pengirimNama, telepon: row.pengirimTelepon, email: row.pengirimEmail },
          penerima: { nama: row.penerimaNama, telepon: row.penerimaTelepon, email: row.penerimaEmail },
          alamatAsal: row.alamatAsal,
          kotaAsal: row.kotaAsal,
          alamatTujuan: row.alamatTujuan,
          kotaTujuan: row.kotaTujuan,
          deskripsiBarang: row.deskripsiBarang,
          layanan: layananOf(row),
          beratKg: Number(row.beratKg),
          jumlahKoli: Number(row.jumlahKoli),
          truckId: truck?.id ?? "",
          slaValue: row.slaValue.trim() ? Number(row.slaValue) : undefined,
          customerId: customerId.trim(),
          asuransi: row.asuransi.trim().toLowerCase() === "ya" || row.asuransi.trim().toLowerCase() === "y" || undefined,
          koliAsuransi: (row.asuransi.trim().toLowerCase() === "ya" || row.asuransi.trim().toLowerCase() === "y") ? row.koliAsuransi.trim() || undefined : undefined,
          nilaiAsuransi: (row.asuransi.trim().toLowerCase() === "ya" || row.asuransi.trim().toLowerCase() === "y") ? (row.nilaiAsuransi.trim() ? Number(row.nilaiAsuransi) : undefined) : undefined,
        });
        outcome.push({ ...base, status: "Berhasil", awb, keterangan: "AWB berhasil dibuat" });
      } catch (err) {
        if (err instanceof ApiError && err.code === "DUPLICATE_REFERENCE") {
          const existing = String(err.details?.existingAwb ?? "");
          outcome.push({ ...base, status: "Sudah ada", awb: existing || undefined, keterangan: "Referensi sudah pernah dibuat, AWB tidak dibuat ulang" });
        } else {
          outcome.push({ ...base, status: "Gagal", keterangan: err instanceof Error ? err.message : "Gagal membuat AWB" });
          failedIds.add(row.id);
        }
      }
    }
    setResult({ rows: outcome, skipped });
    // Rows that failed stay in the table so they can be corrected and retried; finished ones are cleared.
    const keep = withErrors.filter((r) => failedIds.has(r.row.id) || r.errors.length > 0).map((r) => r.row);
    setRows(keep.length > 0 ? keep : [emptyRow(), emptyRow(), emptyRow()]);
    setSubmitting(false);
  }

  function downloadResult() {
    if (!result) return;
    downloadCsv(
      "hasil-import-pengiriman.csv",
      ["Referensi", "Status", "AWB", "Keterangan"],
      result.rows.map((r) => [r.referensi, r.status, r.awb ?? "-", r.keterangan]),
    );
  }

  // Same Referensi twice in one batch: every affected row is flagged (with its row numbers) and none is created.
  const refRows = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const k = normRef(r.referensi);
    if (k) refRows.set(k, [...(refRows.get(k) ?? []), i + 1]);
  });
  const rowsWithErrors = rows.map((r) => ({ row: r, errors: rowErrors(r, refRows.get(normRef(r.referensi))) }));
  const validCount = rowsWithErrors.filter((r) => r.errors.length === 0).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Bulk Input / Import Excel</h2>
            <p className="mt-1 text-xs text-slate-500">
              Isi beberapa baris sekaligus, atau import dari file Excel (.xlsx) / CSV sesuai template.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadBulkShipmentTemplate}
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
        <label className="mt-4 block max-w-xs">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            Client ID (berlaku untuk semua baris)
          </span>
          <input
            required
            disabled={isCustAdmin}
            list="bulk-customer-id-suggestions"
            className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
              isCustAdmin ? "bg-slate-50 text-slate-500" : ""
            }`}
            placeholder="Contoh: IDTMDI001"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            autoComplete="off"
          />
          <datalist id="bulk-customer-id-suggestions">
            {customerIds.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        {importError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {importError}
          </div>
        )}
      </div>


      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1550px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-2.5 py-1.5"></th>
              <th className="px-2.5 py-1.5 text-blue-800">Order</th>
              <th colSpan={3} className="border-l border-slate-200 px-2.5 py-1.5 text-blue-800">
                Pengirim
              </th>
              <th colSpan={3} className="border-l border-slate-200 px-2.5 py-1.5 text-blue-800">
                Penerima
              </th>
              <th colSpan={8} className="border-l border-slate-200 px-2.5 py-1.5 text-blue-800">
                Detail Pengiriman
              </th>
              <th className="border-l border-slate-200 px-2.5 py-1.5 text-blue-800">Armada</th>
              <th className="border-l border-slate-200 px-2.5 py-1.5 text-blue-800">Target Pengiriman</th>
              <th colSpan={3} className="border-l border-slate-200 px-2.5 py-1.5 text-blue-800">
                Asuransi
              </th>
              <th></th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-2.5 py-2.5">Status</th>
              <th className="px-2.5 py-2.5">Referensi</th>
              <th className="border-l border-slate-200 px-2.5 py-2.5">Nama</th>
              <th className="px-2.5 py-2.5">No HP</th>
              <th className="px-2.5 py-2.5">Email</th>
              <th className="border-l border-slate-200 px-2.5 py-2.5">Nama</th>
              <th className="px-2.5 py-2.5">No HP</th>
              <th className="px-2.5 py-2.5">Email</th>
              <th className="border-l border-slate-200 px-2.5 py-2.5">Kota Asal</th>
              <th className="px-2.5 py-2.5">Alamat Asal</th>
              <th className="px-2.5 py-2.5">Kota Tujuan</th>
              <th className="px-2.5 py-2.5">Alamat Tujuan</th>
              <th className="px-2.5 py-2.5">Layanan</th>
              <th className="px-2.5 py-2.5">Berat Final (Kg)</th>
              <th className="px-2.5 py-2.5">Jumlah Koli</th>
              <th className="px-2.5 py-2.5">Deskripsi Barang</th>
              <th className="border-l border-slate-200 px-2.5 py-2.5">Truck (Opsional)</th>
              <th className="border-l border-slate-200 px-2.5 py-2.5">Hari (Opsional)</th>
              <th className="border-l border-slate-200 px-2.5 py-2.5">Asuransi (Ya/Tidak)</th>
              <th className="px-2.5 py-2.5">Koli Diasuransi</th>
              <th className="px-2.5 py-2.5">Nilai Asuransi (Rp)</th>
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
                        onMouseEnter={() => setHoveredStatusRowId(row.id)}
                        onMouseLeave={() => setHoveredStatusRowId(null)}
                        onFocus={() => setHoveredStatusRowId(row.id)}
                        onBlur={() => setHoveredStatusRowId(null)}
                        tabIndex={0}
                        className="inline-flex cursor-help text-amber-500 focus:outline-none"
                      >
                        <AlertTriangle size={16} />
                      </span>
                      {hoveredStatusRowId === row.id && (
                        <div className="absolute left-0 top-full z-20 mt-1.5 w-60 rounded-lg border border-slate-200 bg-white p-3 text-left normal-case leading-relaxed text-slate-600 shadow-lg">
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
                    className={`${cellInputClass} min-w-[120px] font-mono`}
                    value={row.referensi}
                    maxLength={100}
                    onChange={(e) => updateRow(row.id, "referensi", e.target.value)}
                    placeholder="ORD-001"
                  />
                </td>
                <td className="border-l border-slate-200 px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.pengirimNama}
                    onChange={(e) => updateRow(row.id, "pengirimNama", e.target.value)}
                    placeholder="Nama lengkap"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.pengirimTelepon}
                    onChange={(e) => updateRow(row.id, "pengirimTelepon", e.target.value)}
                    placeholder="08xx"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.pengirimEmail}
                    onChange={(e) => updateRow(row.id, "pengirimEmail", e.target.value)}
                    placeholder="email@x.com"
                  />
                </td>
                <td className="border-l border-slate-100 px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.penerimaNama}
                    onChange={(e) => updateRow(row.id, "penerimaNama", e.target.value)}
                    placeholder="Nama lengkap"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.penerimaTelepon}
                    onChange={(e) => updateRow(row.id, "penerimaTelepon", e.target.value)}
                    placeholder="08xx"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.penerimaEmail}
                    onChange={(e) => updateRow(row.id, "penerimaEmail", e.target.value)}
                    placeholder="email@x.com"
                  />
                </td>
                <td className="border-l border-slate-100 px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.kotaAsal}
                    onChange={(e) => updateRow(row.id, "kotaAsal", e.target.value)}
                    placeholder="Ketik kota"
                    autoComplete="off"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.alamatAsal}
                    onChange={(e) => updateRow(row.id, "alamatAsal", e.target.value)}
                    placeholder="Jl. ..."
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.kotaTujuan}
                    onChange={(e) => updateRow(row.id, "kotaTujuan", e.target.value)}
                    placeholder="Ketik kota"
                    autoComplete="off"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={cellInputClass}
                    value={row.alamatTujuan}
                    onChange={(e) => updateRow(row.id, "alamatTujuan", e.target.value)}
                    placeholder="Jl. ..."
                  />
                </td>
                <td className="px-2.5 py-2">
                  <select
                    className={cellInputClass}
                    value={layananOf(row)}
                    onChange={(e) => updateRow(row.id, "layananValue", e.target.value)}
                  >
                    {layananOptions.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2.5 py-2">
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className={`${cellInputClass} min-w-[80px]`}
                    value={row.beratKg}
                    onChange={(e) => updateRow(row.id, "beratKg", e.target.value)}
                    placeholder="10"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className={`${cellInputClass} min-w-[80px]`}
                    value={row.jumlahKoli}
                    onChange={(e) => updateRow(row.id, "jumlahKoli", e.target.value)}
                    placeholder="3"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={`${cellInputClass} min-w-[200px]`}
                    value={row.deskripsiBarang}
                    onChange={(e) => updateRow(row.id, "deskripsiBarang", e.target.value)}
                    placeholder="Isi paket"
                  />
                </td>
                <td className="border-l border-slate-100 px-2.5 py-2">
                  <select
                    className={cellInputClass}
                    value={
                      truckOptions.find(
                        (t) =>
                          t.nomorUnit.replace(/\s+/g, "").toLowerCase() ===
                          row.nomorPolisiTruck.replace(/\s+/g, "").toLowerCase(),
                      )?.nomorUnit ?? ""
                    }
                    onChange={(e) => updateRow(row.id, "nomorPolisiTruck", e.target.value)}
                  >
                    <option value="">Belum ditentukan</option>
                    {truckOptions.map((t) => (
                      <option key={t.id} value={t.nomorUnit}>
                        {t.nomorUnit}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-l border-slate-100 px-2.5 py-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className={`${cellInputClass} min-w-[80px]`}
                    value={row.slaValue}
                    onChange={(e) => updateRow(row.id, "slaValue", e.target.value)}
                    placeholder="3"
                  />
                </td>
                <td className="border-l border-slate-100 px-2.5 py-2">
                  <input
                    className={`${cellInputClass} min-w-[70px]`}
                    value={row.asuransi}
                    onChange={(e) => updateRow(row.id, "asuransi", e.target.value)}
                    placeholder="Tidak"
                    list="asuransi-options"
                  />
                  <datalist id="asuransi-options">
                    <option value="Ya" />
                    <option value="Tidak" />
                  </datalist>
                </td>
                <td className="px-2.5 py-2">
                  <input
                    className={`${cellInputClass} min-w-[80px]`}
                    value={row.koliAsuransi}
                    onChange={(e) => updateRow(row.id, "koliAsuransi", e.target.value)}
                    placeholder="62001, 62002"
                    disabled={row.asuransi.trim().toLowerCase() !== "ya" && row.asuransi.trim().toLowerCase() !== "y"}
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`${cellInputClass} min-w-[100px]`}
                    value={row.nilaiAsuransi ? Number(row.nilaiAsuransi.replace(/\D/g, "")).toLocaleString("en-US") : ""}
                    onChange={(e) => updateRow(row.id, "nilaiAsuransi", e.target.value.replace(/\D/g, ""))}
                    placeholder="1,000,000"
                    disabled={row.asuransi.trim().toLowerCase() !== "ya" && row.asuransi.trim().toLowerCase() !== "y"}
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
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
            Buat {validCount > 0 ? validCount : ""} Pengiriman
          </button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-800">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <p className="text-sm font-semibold">
                {result.rows.filter((r) => r.status === "Berhasil").length} AWB dibuat
                {result.rows.some((r) => r.status === "Sudah ada") ? `, ${result.rows.filter((r) => r.status === "Sudah ada").length} sudah ada` : ""}
                {result.rows.some((r) => r.status === "Gagal") ? `, ${result.rows.filter((r) => r.status === "Gagal").length} gagal` : ""}
                {result.skipped > 0 ? `, ${result.skipped} baris dilewati karena tidak valid` : ""}.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadResult}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={14} /> Unduh Hasil (CSV)
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Referensi</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium">AWB</th>
                  <th className="py-1.5 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, n) => (
                  <tr key={n} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-mono font-medium text-slate-800">{r.referensi}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          r.status === "Berhasil" ? "bg-emerald-100 text-emerald-700" : r.status === "Sudah ada" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {r.awb ? (
                        <Link to={adminPath(`/resi/${r.awb}`)} className="font-mono font-medium text-blue-700 hover:underline">
                          {r.awb}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 text-slate-600">{r.keterangan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const FIELDS_TO_CHECK_BLANK: (keyof BulkRowInput)[] = [
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
  "deskripsiBarang",
  "beratKg",
  "jumlahKoli",
];
