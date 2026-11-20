// Daily Shipment Email Report — runs at 11:00 and 17:00 WIB via Cloudflare
// Worker cron triggers (0 4 * * * and 0 10 * * * UTC). Queries shipments
// created so far today (WIB), builds a CSV attachment + HTML summary, and
// emails them to every active Superadmin / Admin account.
//
// Period filter uses tanggal_dibuat + jam_dibuat (both WIB wall-clock values
// stored on every shipment at creation time), NOT created_at (UTC) — so no
// timezone conversion is needed and the boundaries are unambiguous:
//   11:00 slot → tanggal_dibuat = today AND jam_dibuat <= "11:00"
//   17:00 slot → tanggal_dibuat = today AND jam_dibuat <= "17:00"
// Both are cumulative from 00:00.

import type { Env } from "./types";
import { wibNow } from "./wib";
import { writeAuditLog } from "./audit";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export type ReportSlot = "11" | "17";

interface ReportRecipient {
  email: string;
  nama: string;
}

interface ShipmentRow {
  awb: string;
  tanggal_dibuat: string;
  jam_dibuat: string;
  reference: string | null;
  customer_id: string | null;
  pengirim_nama: string;
  penerima_nama: string;
  kota_asal: string;
  kota_tujuan: string;
  layanan: string;
  berat_kg: number;
  jumlah_koli: number;
  estimasi_tiba: string | null;
  status: string;
  asuransi: number;
  koli_asuransi: string | null;
  nilai_asuransi: number | null;
  truck_nomor_unit: string | null;
  truck_driver_nama: string | null;
  created_by_name: string | null;
  created_by_role: string | null;
}

const CSV_COLUMNS = [
  "AWB",
  "Tanggal Dibuat",
  "Jam Dibuat",
  "Referensi",
  "Client ID",
  "Pengirim",
  "Penerima",
  "Kota Asal",
  "Kota Tujuan",
  "Layanan",
  "Berat Final (Kg)",
  "Jumlah Koli",
  "Asuransi",
  "Koli Diasuransi",
  "Nilai Asuransi (Rp)",
  "Estimasi Tiba",
  "Status",
  "Truck",
  "Driver",
  "Dibuat Oleh",
] as const;

/** WIB date for "today" (or a specific date if provided as YYYY-MM-DD). */
function reportDate(dateOverride?: string): string {
  if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) return dateOverride;
  return wibNow().tanggal;
}

/** Determine the slot label ("11" or "17") from the current WIB hour, or an
 * explicit override. Used by the manual trigger when slot isn't given. */
function defaultSlot(): ReportSlot {
  const hour = Number(wibNow().jam.slice(0, 2));
  return hour < 11 ? "11" : "17";
}

function slotTimeLabel(slot: ReportSlot): string {
  return slot === "11" ? "11:00" : "17:00";
}

// ---------------------------------------------------------------------------
// CSV building
// ---------------------------------------------------------------------------

/** Escape a single CSV cell: wrap in quotes if needed, double internal quotes.
 * Also prevents formula injection by prefixing cells that start with =, +, -,
 * @, TAB, or CR with a single quote (so Excel/WPS won't interpret them as
 * formulas). */
function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  // Formula injection defence: prefix dangerous leading characters.
  let safe = raw;
  if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
  // Escape: wrap in double quotes if contains comma, quote, newline, or CR.
  if (/[",\n\r]/.test(safe)) {
    safe = `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function buildCsv(rows: ShipmentRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.awb,
        r.tanggal_dibuat,
        r.jam_dibuat,
        r.reference ?? "",
        r.customer_id ?? "",
        r.pengirim_nama,
        r.penerima_nama,
        r.kota_asal,
        r.kota_tujuan,
        r.layanan,
        r.berat_kg,
        r.jumlah_koli,
        r.asuransi ? "Ya" : "Tidak",
        r.asuransi ? (r.koli_asuransi ?? "-") : "-",
        r.asuransi ? (r.nilai_asuransi ?? "-") : "-",
        r.estimasi_tiba ?? "",
        r.status,
        r.truck_nomor_unit ?? "",
        r.truck_driver_nama ?? "",
        r.created_by_name ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // UTF-8 BOM so Excel/WPS reads Indonesian characters correctly.
  return "\uFEFF" + lines.join("\r\n");
}

function csvFilename(date: string, slot: ReportSlot): string {
  return `laporan_pengiriman_${date}_${slot}00.csv`;
}

// ---------------------------------------------------------------------------
// HTML email body
// ---------------------------------------------------------------------------

function statusGroup(status: string): string {
  if (status === "Selesai / Terkirim") return "Terikirim";
  if (status === "Dibatalkan") return "Dibatalkan";
  if (status === "Hold") return "Hold";
  if (status === "Kendala") return "Bermasalah";
  if (status === "Dalam Persiapan") return "Pending";
  if (status === "Berangkat" || status === "Transit" || status === "Dalam Perjalanan" || status === "Tiba di Tujuan" || status === "Transfer Unit" || status === "Re-route" || status === "Penarikan")
    return "Dalam Perjalanan";
  return "Lainnya";
}

function buildHtml(opts: {
  date: string;
  slot: ReportSlot;
  total: number;
  rows: ShipmentRow[];
}): string {
  const { date, slot, total, rows } = opts;
  const slotLabel = slotTimeLabel(slot);
  const period = `00:00 – ${slotLabel} WIB`;

  // Status breakdown by current status (not by creation period).
  const breakdown = new Map<string, number>();
  for (const r of rows) {
    const g = statusGroup(r.status);
    breakdown.set(g, (breakdown.get(g) ?? 0) + 1);
  }
  const groupOrder = ["Pending", "Dalam Perjalanan", "Terikirim", "Bermasalah", "Hold", "Dibatalkan", "Lainnya"];
  const breakdownRows = groupOrder
    .filter((g) => breakdown.has(g))
    .map((g) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${g}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${breakdown.get(g)}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr><td style="background:#071B41;padding:24px 32px;">
      <p style="margin:0;color:#D4A72C;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">GMS Logistics</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:700;">Laporan Pengiriman Harian</h1>
    </td></tr>
    <tr><td style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
        <tr><td style="padding:4px 0;color:#64748b;width:140px;">Tanggal Laporan</td><td style="padding:4px 0;font-weight:600;">${date}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Jadwal</td><td style="padding:4px 0;font-weight:600;">${slotLabel} WIB</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Periode Data</td><td style="padding:4px 0;font-weight:600;">${period}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Total Pengiriman</td><td style="padding:4px 0;font-weight:700;color:#071B41;font-size:18px;">${total}</td></tr>
      </table>

      <h2 style="margin:24px 0 8px;font-size:14px;color:#071B41;font-weight:600;">Ringkasan Status (saat ini)</h2>
      <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">Distribusi status terkini dari pengiriman yang tercatat pada periode laporan.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:600;">Status</th>
          <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e2e8f0;font-weight:600;">Jumlah</th>
        </tr></thead>
        <tbody>${breakdownRows}</tbody>
      </table>

      <div style="margin:24px 0;padding:14px 16px;background:#EAF0F8;border-radius:8px;border:1px solid #cbd5e1;">
        <p style="margin:0;font-size:13px;color:#071B41;">📋 Seluruh detail data pengiriman (${total} record) tersedia pada lampiran file CSV di email ini.</p>
      </div>

      <p style="margin:24px 0 0;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;">
        Email ini dikirim otomatis oleh sistem GMS Logistics kepada akun GMS-Admin &amp; Superadmin yang aktif.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

async function fetchRecipients(env: Env): Promise<ReportRecipient[]> {
  const rows = await env.DB.prepare(
    `SELECT email, nama FROM users
     WHERE role IN ('Superadmin', 'Admin')
       AND aktif = 1
       AND deleted_at IS NULL
       AND email IS NOT NULL AND email != ''`,
  ).all<{ email: string; nama: string }>();
  // De-duplicate by email (case-insensitive) and validate format.
  const seen = new Set<string>();
  const valid: ReportRecipient[] = [];
  for (const r of rows.results ?? []) {
    const email = r.email.trim().toLowerCase();
    if (seen.has(email)) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    seen.add(email);
    valid.push({ email, nama: r.nama });
  }
  return valid;
}

// ---------------------------------------------------------------------------
// Idempotency: check audit_log for already-sent reports
// ---------------------------------------------------------------------------

/** Returns true if a report for (date, slot, recipient) was already logged
 * as successfully sent. Prevents duplicate emails when the cron re-fires or
 * the manual trigger is pressed again. */
async function alreadySent(env: Env, date: string, slot: ReportSlot, recipientEmail: string): Promise<boolean> {
  const pattern = `%slot=${slot}|date=${date}|to=${recipientEmail}|status=sent%`;
  const row = await env.DB.prepare(
    `SELECT 1 FROM audit_log WHERE action = 'DAILY_REPORT_SENT' AND description LIKE ? LIMIT 1`,
  )
    .bind(pattern)
    .first();
  return !!row;
}

async function logReportResult(
  env: Env,
  date: string,
  slot: ReportSlot,
  recipient: ReportRecipient,
  status: "sent" | "failed",
  extra?: string,
): Promise<void> {
  const desc = `slot=${slot}|date=${date}|to=${recipient.email}|status=${status}${extra ? `|${extra}` : ""}`;
  await writeAuditLog(env, null, {
    action: "DAILY_REPORT_SENT",
    actionLabel: "DAILY REPORT SENT",
    module: "DailyReport",
    description: desc,
  });
}

// ---------------------------------------------------------------------------
// Email sending
// ---------------------------------------------------------------------------

async function sendReportEmail(
  env: Env,
  recipient: ReportRecipient,
  subject: string,
  html: string,
  csv: string,
  filename: string,
): Promise<{ ok: boolean; error?: string }> {
  const endpoint = `${env.EMAIL_API_URL.replace(/\/+$/, "")}/send-report`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: env.REPORT_API_TOKEN,
        to: recipient.email,
        toName: recipient.nama,
        subject,
        html,
        csvContent: csv,
        csvFilename: filename,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface ReportResult {
  date: string;
  slot: ReportSlot;
  period: string;
  totalShipments: number;
  recipients: { email: string; nama: string; status: "sent" | "failed" | "skipped"; error?: string }[];
  csvFilename: string;
}

export async function runDailyReport(
  env: Env,
  slot: ReportSlot,
  opts?: { date?: string; force?: boolean },
): Promise<ReportResult> {
  const date = reportDate(opts?.date);
  const slotLabel = slotTimeLabel(slot);
  const period = `00:00–${slotLabel} WIB`;
  const force = opts?.force ?? false;

  console.log(JSON.stringify({
    module: "DailyReport",
    event: "start",
    date,
    slot,
    period,
    force,
  }));

  // 1. Query shipments created so far today (WIB), up to the slot cutoff.
  //    tanggal_dibuat + jam_dibuat are WIB wall-clock values, so no UTC
  //    conversion is needed.
  const rows = await env.DB.prepare(
    `SELECT s.awb, s.tanggal_dibuat, s.jam_dibuat, s.reference, s.customer_id,
            s.pengirim_nama, s.penerima_nama, s.kota_asal, s.kota_tujuan,
            s.layanan, s.berat_kg, s.jumlah_koli, s.estimasi_tiba, s.status,
            s.asuransi, s.koli_asuransi, s.nilai_asuransi,
            t.nomor_unit as truck_nomor_unit, d.nama as truck_driver_nama,
            s.created_by_name, s.created_by_role
     FROM shipments s
     LEFT JOIN trucks t ON t.id = s.truck_id
     LEFT JOIN drivers d ON d.id = t.driver_id
     WHERE s.tanggal_dibuat = ?
       AND s.jam_dibuat <= ?
       AND s.deleted_at IS NULL
     ORDER BY s.jam_dibuat ASC`,
  )
    .bind(date, slotLabel)
    .all<ShipmentRow>();

  const shipments = rows.results ?? [];
  const total = shipments.length;

  console.log(JSON.stringify({
    module: "DailyReport",
    event: "query_done",
    date,
    slot,
    totalShipments: total,
  }));

  // 2. Build CSV (always includes headers, even if empty).
  const csv = buildCsv(shipments);
  const filename = csvFilename(date, slot);

  console.log(JSON.stringify({
    module: "DailyReport",
    event: "csv_built",
    filename,
    bytes: csv.length,
  }));

  // 3. Build HTML email body.
  const html = buildHtml({ date, slot, total, rows: shipments });
  const subject = `Laporan Pengiriman GMS - ${date} (00:00–${slotLabel} WIB)`;

  // 4. Fetch recipients (active Superadmin + Admin with valid email).
  const recipients = await fetchRecipients(env);

  console.log(JSON.stringify({
    module: "DailyReport",
    event: "recipients_loaded",
    count: recipients.length,
    emails: recipients.map((r) => r.email),
  }));

  // 5. Send to each recipient individually (allows per-recipient tracking +
  //    idempotency). Skip recipients already sent unless force=true.
  const results: ReportResult["recipients"] = [];
  for (const r of recipients) {
    if (!force) {
      const sent = await alreadySent(env, date, slot, r.email);
      if (sent) {
        results.push({ email: r.email, nama: r.nama, status: "skipped" });
        console.log(JSON.stringify({ module: "DailyReport", event: "skip_already_sent", to: r.email, date, slot }));
        continue;
      }
    }

    const res = await sendReportEmail(env, r, subject, html, csv, filename);
    if (res.ok) {
      results.push({ email: r.email, nama: r.nama, status: "sent" });
      await logReportResult(env, date, slot, r, "sent", `count=${total}`);
      console.log(JSON.stringify({ module: "DailyReport", event: "sent_ok", to: r.email, date, slot }));
    } else {
      results.push({ email: r.email, nama: r.nama, status: "failed", error: res.error });
      await logReportResult(env, date, slot, r, "failed", `error=${res.error ?? "unknown"}`);
      console.error(JSON.stringify({ module: "DailyReport", event: "send_failed", to: r.email, date, slot, error: res.error }));
    }
  }

  console.log(JSON.stringify({
    module: "DailyReport",
    event: "done",
    date,
    slot,
    totalShipments: total,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  }));

  return {
    date,
    slot,
    period,
    totalShipments: total,
    recipients: results,
    csvFilename: filename,
  };
}

/** Pick the slot from the current WIB hour (used by manual trigger default). */
export function pickSlot(slot?: string): ReportSlot {
  if (slot === "11" || slot === "17") return slot;
  return defaultSlot();
}
