import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { DriverShipmentSummary } from "./driverApi";
import { formatTanggalPanjang } from "./format";

interface DriverPdfMeta {
  driverNama: string;
  dateFrom?: string;
  dateTo?: string;
  statusFilter?: string;
}

/** Generates a real PDF file (not window.print()) for the driver portal's
 * "Data Pengiriman" export, so the output is always clean - no browser
 * print-dialog header/footer (URL, date, page number) to worry about. */
export function exportDriverShipmentsPdf(
  shipments: DriverShipmentSummary[],
  meta: DriverPdfMeta,
  filename = "data-kiriman-saya.pdf",
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Data Pengiriman", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Driver: ${meta.driverNama}`, 14, 22);

  const filterParts: string[] = [];
  if (meta.dateFrom || meta.dateTo) {
    const from = meta.dateFrom ? formatTanggalPanjang(meta.dateFrom) : "...";
    const to = meta.dateTo ? formatTanggalPanjang(meta.dateTo) : "...";
    filterParts.push(`Tanggal: ${from} s/d ${to}`);
  }
  if (meta.statusFilter && meta.statusFilter !== "Semua") {
    filterParts.push(`Status: ${meta.statusFilter}`);
  }
  if (filterParts.length > 0) {
    doc.text(filterParts.join("   |   "), 14, 27);
  }

  const printedAtY = filterParts.length > 0 ? 32 : 27;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Dicetak: ${`${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`}`, 14, printedAtY);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: printedAtY + 4,
    head: [["AWB", "Tanggal", "Asal", "Tujuan", "Status", "Estimasi Tiba"]],
    body: shipments.map((s) => [
      s.awb,
      formatTanggalPanjang(s.tanggalDibuat),
      s.kotaAsal,
      s.kotaTujuan,
      s.status,
      s.estimasiTiba ? formatTanggalPanjang(s.estimasiTiba) : "Belum tersedia",
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [23, 37, 84], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  doc.save(filename);
}
