import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { EpOrder, EpSettings } from "./common";
import { rupiah, dateId } from "./common";

type Doc = "resi" | "suratjalan" | "invoice";
type Pdf = jsPDF & { lastAutoTable?: { finalY: number } };

const NAVY: [number, number, number] = [30, 41, 59];
const BLUE: [number, number, number] = [59, 107, 168];

async function loadLogo(): Promise<string | null> {
  try {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}logo-sinartrans.png`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return c.toDataURL("image/png");
  } catch { return null; }
}

function box(pdf: jsPDF, x: number, y: number, w: number, h: number, fill?: [number, number, number]) {
  if (fill) { pdf.setFillColor(...fill); pdf.rect(x, y, w, h, "FD"); } else pdf.rect(x, y, w, h);
}
function bar(pdf: jsPDF, x: number, y: number, w: number, label: string) {
  box(pdf, x, y, w, 6, [30, 30, 30]);
  pdf.setTextColor(255).setFont("helvetica", "bold").setFontSize(8).text(label, x + w / 2, y + 4.2, { align: "center" });
  pdf.setTextColor(0);
}
function check(pdf: jsPDF, x: number, y: number, label: string, on = false) {
  pdf.rect(x, y - 2.6, 3, 3);
  if (on) pdf.setFont("helvetica", "bold").text("X", x + 0.5, y - 0.1);
  pdf.setFont("helvetica", "bold").setFontSize(7).text(label, x + 4.5, y);
}
function field(pdf: jsPDF, label: string, val: string | null | undefined, x: number, y: number, w: number) {
  pdf.setFont("helvetica", "bold").setFontSize(8).text(label, x, y);
  pdf.setFont("helvetica", "normal").setFontSize(8).text(pdf.splitTextToSize(val || "", w - 22)[0] ?? "", x + 20, y - 0.5);
  pdf.setLineDashPattern([0.6, 0.6], 0).line(x + 18, y + 1, x + w, y + 1).setLineDashPattern([], 0);
}

/** Resi mengikuti waybill fisik Sinar Trans Express (landscape). */
function drawResi(pdf: Pdf, o: EpOrder, s: EpSettings, logo: string | null) {
  const X = 8, Y = 8;
  pdf.setLineWidth(0.3);
  // header
  box(pdf, X, Y, 87, 34);
  if (logo) pdf.addImage(logo, "PNG", X + 3, Y + 3, 80, 22, undefined, "FAST");
  pdf.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(40).text("Jakarta - Cirebon - Tegal - Pekalongan - Purwokerto - Semarang - Yogyakarta - Solo - Surabaya", X + 43.5, Y + 30, { align: "center", maxWidth: 82 });
  pdf.setTextColor(0);
  box(pdf, X + 87, Y, 108, 34);
  const hdr = (s.invoice_header || "").split("\n").filter(Boolean);
  pdf.setFont("helvetica", "bold").setFontSize(8).text(hdr[0] || "SINAR TRANS EXPRESS", X + 90, Y + 6);
  pdf.setFont("helvetica", "normal").setFontSize(7);
  hdr.slice(1, 6).forEach((l, i) => pdf.text(l, X + 90, Y + 11 + i * 4.5, { maxWidth: 102 }));
  box(pdf, X + 195, Y, 86, 12);
  pdf.setFont("helvetica", "bold").setFontSize(12).text(`No. ${o.resi}`, X + 198, Y + 8);
  box(pdf, X + 195, Y + 12, 86, 6, [30, 30, 30]);
  pdf.setTextColor(255).setFontSize(8).text("ISI TIDAK DIPERIKSA", X + 238, Y + 16.2, { align: "center" }); pdf.setTextColor(0);
  box(pdf, X + 195, Y + 18, 86, 16);
  ["Peti", "Karung", "Dus", "Plastik"].forEach((l, i) => check(pdf, X + 198 + i * 20, Y + 24, l));
  check(pdf, X + 198, Y + 31, "Sterofoam");

  // pengirim / penerima
  const y1 = Y + 34;
  bar(pdf, X, y1, 98, "PENGIRIM"); bar(pdf, X + 98, y1, 98, "PENERIMA");
  box(pdf, X, y1 + 6, 98, 32); box(pdf, X + 98, y1 + 6, 98, 32);
  const party = (x: number, nama?: string | null, alamat?: string | null, kota?: string | null) => {
    field(pdf, "Nama", nama, x + 2, y1 + 13, 94);
    field(pdf, "Alamat", alamat, x + 2, y1 + 20, 94);
    field(pdf, "Kota", kota, x + 2, y1 + 31, 94);
    field(pdf, "No. Tlp", "", x + 2, y1 + 37, 94);
  };
  party(X, o.senderNama, o.senderAlamat, o.asal);
  party(X + 98, o.receiverNama, o.receiverAlamat, o.tujuan);
  const pay = (o.payerScheme || "").toUpperCase();
  box(pdf, X + 196, y1, 85, 38);
  [["CASH", "CASH"], ["CAD", "CAD"], ["COD", "COD"]].forEach(([l, k], i) => check(pdf, X + 199 + i * 27, y1 + 5, l, pay.includes(k)));
  bar(pdf, X + 196, y1 + 8, 85, "INFORMASI PENGIRIM");
  check(pdf, X + 199, y1 + 18, "KA"); check(pdf, X + 199, y1 + 25, "TRUK");
  pdf.setFont("helvetica", "normal").setFontSize(6.5).text("Tanda Tangan dan Nama Jelas", X + 238, y1 + 36, { align: "center" });

  // tabel barang
  const y2 = y1 + 38;
  const cols = [[0, 22, "BANYAK"], [22, 76, "ISI DAN JENIS KIRIMAN\nMENURUT PENGAKUAN"], [98, 22, "BERAT"], [120, 52, "BIAYA (Rp)"]] as const;
  box(pdf, X, y2, 172, 12, [30, 30, 30]);
  pdf.setTextColor(255).setFont("helvetica", "bold").setFontSize(8);
  cols.forEach(([cx, cw, t]) => pdf.text(t, X + cx + cw / 2, y2 + (t.includes("\n") ? 5 : 7), { align: "center" }));
  pdf.setTextColor(0);
  const bodyH = 36;
  cols.forEach(([cx, cw]) => box(pdf, X + cx, y2 + 12, cw, bodyH));
  pdf.setFont("helvetica", "bold").setFontSize(12);
  pdf.text(String(o.koli ?? ""), X + 11, y2 + 30, { align: "center" });
  pdf.setFontSize(10).text(o.goodsType ?? "", X + 24, y2 + 20, { maxWidth: 72 });
  pdf.setFontSize(12).text(o.weight != null ? String(o.weight) : "", X + 109, y2 + 30, { align: "center" });
  pdf.text(o.total != null ? rupiah(o.price != null && o.weight ? Math.round(o.price * o.weight) : o.total).replace("Rp", "").trim() : "", X + 146, y2 + 30, { align: "center" });
  box(pdf, X, y2 + 12 + bodyH, 172, 8);
  pdf.setFontSize(9).text("Biaya Tambahan", X + 98, y2 + 12 + bodyH + 5.5, { align: "right" });
  box(pdf, X + 120, y2 + 12 + bodyH, 52, 8);
  box(pdf, X, y2 + 20 + bodyH, 172, 8);
  pdf.text("JUMLAH (Rp)", X + 98, y2 + 20 + bodyH + 5.5, { align: "right" });
  box(pdf, X + 120, y2 + 20 + bodyH, 52, 8);
  pdf.text(o.total != null ? rupiah(o.total).replace("Rp", "").trim() : "", X + 146, y2 + 20 + bodyH + 5.7, { align: "center" });

  // informasi penerima & ttd
  bar(pdf, X + 172, y2, 51, "INFORMASI PENERIMA");
  box(pdf, X + 172, y2 + 6, 51, 5); pdf.setFont("helvetica", "normal").setFontSize(7).text("Tanggal :", X + 174, y2 + 9.6); pdf.text("Jam :", X + 200, y2 + 9.6);
  box(pdf, X + 172, y2 + 11, 51, 37);
  pdf.text("Tanda Tangan dan Nama Jelas", X + 197.5, y2 + 46, { align: "center" });
  bar(pdf, X + 172, y2 + 48, 51, "KETERANGAN");
  box(pdf, X + 172, y2 + 54, 51, 14);
  bar(pdf, X + 223, y2, 58, "SINAR TRANS EXPRESS");
  box(pdf, X + 223, y2 + 6, 58, 5); pdf.text(`Tanggal : ${dateId(o.orderDate)}`, X + 225, y2 + 9.6);
  box(pdf, X + 223, y2 + 11, 58, 52);
  pdf.text("Tanda Tangan dan Nama Jelas", X + 252, y2 + 61, { align: "center" });
  box(pdf, X + 223, y2 + 63, 58, 5);
  pdf.setFont("helvetica", "normal").setFontSize(6).setTextColor(200, 0, 0)
    .text("Perhatian : Silahkan membaca syarat dan ketentuan pengiriman yang tertera di bagian belakang Waybill ini. Penggunaan Waybill ini berarti Anda memahami dan menerima seluruh syarat dan ketentuan yang tertera.", X, y2 + 72, { maxWidth: 281 });
  pdf.setTextColor(0);
}

/** Invoice mengikuti format tagihan (Referensi / Info Perusahaan / Tagihan Untuk / tabel produk). */
function drawInvoice(pdf: Pdf, o: EpOrder, s: EpSettings, logo: string | null, invoiceNo?: string | null, dueDate?: string | null, paid = 0) {
  const M = 14, R = 196;
  if (logo) pdf.addImage(logo, "PNG", M, 14, 46, 13, undefined, "FAST");
  pdf.setFont("helvetica", "normal").setFontSize(22).setTextColor(...BLUE).text("Invoice", R, 22, { align: "right" });
  pdf.setTextColor(0).setFontSize(9);
  const meta: [string, string][] = [["Referensi", invoiceNo || "-"], ["Tanggal", dateId(o.orderDate)], ["Tgl. Jatuh Tempo", dueDate ? dateId(dueDate) : "-"], ["No. Resi", o.resi]];
  meta.forEach(([k, v], i) => { pdf.setFont("helvetica", "bold").text(k, 150, 36 + i * 5, { align: "right" }); pdf.setFont("helvetica", "normal").text(v, R, 36 + i * 5, { align: "right" }); });

  const head = (t: string, x: number) => { pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY).text(t, x, 66); pdf.setDrawColor(130, 135, 150).setLineWidth(0.5).line(x, 69, x === M ? 100 : R, 69); pdf.setTextColor(0); };
  head("Info Perusahaan", M); head("Tagihan Untuk", 115);
  const co = (s.invoice_header || "Ekspedisi").split("\n");
  pdf.setFont("helvetica", "bold").setFontSize(9).text(co[0], M, 76);
  pdf.setFont("helvetica", "normal").setTextColor(90).setFontSize(8.5);
  co.slice(1).forEach((l, i) => pdf.text(l, M, 82 + i * 4.3, { maxWidth: 84 }));
  pdf.setTextColor(0).setFont("helvetica", "bold").setFontSize(9).text(o.payerNama || o.senderNama || "-", 115, 76);
  pdf.setFont("helvetica", "normal").setTextColor(90).setFontSize(8.5).text(pdf.splitTextToSize(o.payerAlamat || o.senderAlamat || "", 80), 115, 82);
  pdf.setTextColor(0);

  const total = o.total ?? 0;
  const qty = o.weight ?? o.koli ?? 1;
  autoTable(pdf, {
    startY: 112, theme: "plain", margin: { left: M, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 2.5, fillColor: [240, 240, 240], lineColor: [255, 255, 255], lineWidth: 0.6 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    head: [["Produk", "Deskripsi", "Kuantitas", "Harga (Rp)", "Diskon", "Pajak", "Jumlah (Rp)"]],
    body: [[
      "Jasa Pengiriman",
      `${o.route ?? `${o.asal ?? "-"} → ${o.tujuan ?? "-"}`}\n${o.goodsType ?? "Barang"} · ${o.koli ?? "-"} koli`,
      `${qty} ${o.priceUnit ?? ""}`.trim(), rupiah(o.price).replace("Rp", "").trim(), "0 %", "-", rupiah(total).replace("Rp", "").trim(),
    ]],
    columnStyles: { 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "right" } },
  });
  let y = (pdf as Pdf).lastAutoTable!.finalY + 10;
  const rows: [string, string, boolean][] = [["Subtotal", rupiah(total), false], ["Pajak", rupiah(0), false], ["Total", rupiah(total), false]];
  if (paid > 0) rows.push(["Total Terbayar", rupiah(paid), false]);
  rows.push(["Sisa Tagihan", rupiah(Math.max(total - paid, 0)), true]);
  rows.forEach(([k, v, big]) => {
    pdf.setFont("helvetica", big ? "bold" : "bold").setFontSize(big ? 10.5 : 9).setTextColor(big ? 60 : 90).text(k, 106, y);
    pdf.setFont("helvetica", "normal").setTextColor(big ? 40 : 90).text(v, R, y, { align: "right" });
    pdf.setDrawColor(150).setLineWidth(0.2).line(106, y + 2.5, R, y + 2.5); y += big ? 9 : 7;
  });
  pdf.setTextColor(0);

  y = Math.max(y + 10, 200);
  const h2 = (t: string, yy: number) => { pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY).text(t, M, yy); pdf.setDrawColor(130, 135, 150).setLineWidth(0.5).line(M, yy + 3, 118, yy + 3); pdf.setTextColor(0); };
  h2("Keterangan", y);
  pdf.setFont("helvetica", "normal").setFontSize(8.5);
  const bank = (s.invoice_bank || "").split("\n").filter(Boolean);
  let yy = y + 10;
  pdf.text("• Mohon Melakukan Pembayaran Ke Nomor Rekening:", M + 2, yy); yy += 4.5;
  bank.forEach((l) => { pdf.text(l, M + 5, yy); yy += 4.5; });
  yy += 6; h2("Syarat & Ketentuan", yy); yy += 10;
  const terms = (s.invoice_footer || "Pembayaran Penuh (Full Payment)").split("\n").filter(Boolean);
  terms.forEach((l) => { const w = pdf.splitTextToSize(l, 100); pdf.text("•", M + 2, yy); pdf.text(w, M + 5, yy); yy += w.length * 4.3 + 0.7; });
  pdf.setFont("helvetica", "bold").setFontSize(9.5).text(dateId(new Date().toISOString().slice(0, 10)), 170, y + 2, { align: "center" });
  pdf.text(co[0], 170, y + 36, { align: "center" });
}

export async function printOrder(kind: Doc, o: EpOrder, s: EpSettings, invoiceNo?: string | null, dueDate?: string | null, paid = 0) {
  const logo = await loadLogo();
  if (kind === "resi") {
    const pdf = new jsPDF({ unit: "mm", format: [297, 130], orientation: "landscape" }) as Pdf;
    drawResi(pdf, o, s, logo);
    pdf.save(`resi-${o.resi}.pdf`);
    return;
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4" }) as Pdf;
  if (kind === "invoice") { drawInvoice(pdf, o, s, logo, invoiceNo, dueDate, paid); pdf.save(`invoice-${o.resi}.pdf`); return; }

  // Surat jalan
  const header = (s.invoice_header || "Ekspedisi").split("\n");
  if (logo) pdf.addImage(logo, "PNG", 14, 12, 46, 13, undefined, "FAST");
  pdf.setFontSize(9).setFont("helvetica", "normal");
  header.slice(1, 4).forEach((l, i) => pdf.text(l, 14, 31 + i * 4.3));
  pdf.setFontSize(16).setFont("helvetica", "bold").text("SURAT JALAN", 196, 18, { align: "right" });
  pdf.setFontSize(10).setFont("helvetica", "normal").text(`No Resi: ${o.resi}`, 196, 25, { align: "right" }).text(`Tanggal: ${dateId(o.orderDate)}`, 196, 30, { align: "right" });
  autoTable(pdf, {
    startY: 50, theme: "grid", styles: { fontSize: 9 }, headStyles: { fillColor: NAVY },
    head: [["Pengirim", "Penerima"]],
    body: [[`${o.senderNama ?? "-"}\n${o.senderAlamat ?? ""}`, `${o.receiverNama ?? "-"}\n${o.receiverAlamat ?? ""}`]],
  });
  autoTable(pdf, {
    startY: (pdf as Pdf).lastAutoTable!.finalY + 6, theme: "grid", styles: { fontSize: 9 }, headStyles: { fillColor: NAVY },
    head: [["Rute", "Jenis Barang", "Koli", "Berat (kg)"]],
    body: [[`${o.asal ?? "-"} → ${o.tujuan ?? "-"}`, o.goodsType ?? "-", String(o.koli ?? "-"), String(o.weight ?? "-")]],
  });
  const y = (pdf as Pdf).lastAutoTable!.finalY + 22;
  pdf.setFontSize(9);
  ["Pengirim", "Driver", "Penerima"].forEach((l, i) => { const x = 14 + i * 62; pdf.text(l, x, y); pdf.line(x, y + 22, x + 50, y + 22); pdf.text("( __________ )", x, y + 27); });
  pdf.save(`suratjalan-${o.resi}.pdf`);
}
