const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatTanggal(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  if (!y || !m || !d) return tanggal;
  return `${d} ${BULAN[m - 1]} ${y}`;
}

export type EmailRecipientRole = "penerima" | "pengirim" | "admin";

export interface EmailTemplateData {
 toName?: string;
 awb: string;
 kotaAsal: string;
 kotaTujuan: string;
 status: string;
 tanggalDibuat: string;
 trackingUrl: string;
 senderName: string;
 pengirimNama: string;
 recipientRole: EmailRecipientRole;
}

export function emailSubject(awb: string, recipientRole: EmailRecipientRole): string {
  if (recipientRole === "admin") return `[Admin] Paket Selesai/Terkirim - AWB ${awb}`;
  return recipientRole === "pengirim"
    ? `Resi Pengiriman Telah Diterbitkan - AWB ${awb}`
    : `Resi Pengiriman Anda - AWB ${awb}`;
}

export function buildEmailHtml(data: EmailTemplateData): string {
  const { toName, awb, kotaAsal, kotaTujuan, status, tanggalDibuat, trackingUrl, senderName, pengirimNama, recipientRole } = data;

  const introText =
    recipientRole === "admin"
      ? "Notifikasi internal - pengiriman berikut telah berstatus <strong>Selesai / Terkirim</strong>. Berikut ringkasan pengiriman:"
      : recipientRole === "pengirim"
        ? "Terima kasih telah mempercayakan pengiriman barang Anda kepada kami. Resi pengiriman Anda telah berhasil diterbitkan. Berikut detail resi pengiriman Anda:"
        : status === "Selesai / Terkirim"
          ? "Pengiriman Anda telah selesai/terkirim. Berikut detail resi/AWB pengiriman Anda:"
          : "Pengiriman Anda telah berhasil dibuat dan sedang kami proses. Berikut detail resi pengiriman Anda:";

  const footerNote =
    recipientRole === "admin"
      ? "Ini adalah notifikasi otomatis untuk tim internal, bukan email ke customer."
      : recipientRole === "pengirim"
        ? 'Simpan email ini sebagai bukti resi pengiriman barang Anda. Anda dapat memantau perjalanan barang dengan mengklik tombol "Lacak Kiriman" di atas.'
        : 'Anda dapat memantau posisi barang secara real-time dengan mengklik tombol "Lacak Kiriman" di atas. Simpan email ini sebagai referensi pengiriman Anda.';

  const buttonLabel = recipientRole === "admin" ? "Lihat Detail Pengiriman" : "Lacak Kiriman";
  const greeting = recipientRole === "admin" ? `Halo <strong>${toName ?? "Admin"}</strong>,` : `Halo Bapak/Ibu <strong>${toName ?? "Pelanggan"}</strong>,`;

  return `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
            <tr>
              <td style="background-color:#172554;padding:28px 24px;text-align:center;">
              <div style="color:#ffffff;font-size:16px;font-weight:bold;">GMS Logistics</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;">
                <p style="margin:0 0 12px;color:#334155;font-size:14px;">${greeting}</p>
                <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">${introText}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Nomor AWB</div>
                      <div style="font-size:18px;font-weight:bold;color:#172554;font-family:'Courier New',monospace;margin-top:2px;">${awb}</div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px solid #e2e8f0;">
                        <tr>
                          <td width="50%" style="vertical-align:top;padding-top:14px;">
                            <div style="font-size:11px;color:#94a3b8;">Dari</div>
                            <div style="font-size:13px;color:#334155;font-weight:600;">${pengirimNama}</div>
                            <div style="font-size:12px;color:#64748b;">${kotaAsal}</div>
                          </td>
                          <td width="50%" style="vertical-align:top;padding-top:14px;">
                            <div style="font-size:11px;color:#94a3b8;">Tujuan</div>
                            <div style="font-size:13px;color:#334155;font-weight:600;">${kotaTujuan}</div>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px;">
                        <div style="font-size:11px;color:#94a3b8;">Status</div>
                        <div style="font-size:13px;color:#1d4ed8;font-weight:600;">${status}</div>
                      </div>
                      <div style="margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px;">
                        <div style="font-size:11px;color:#94a3b8;">Tanggal Terbit</div>
                        <div style="font-size:13px;color:#334155;font-weight:600;">${formatTanggal(tanggalDibuat)}</div>
                      </div>
                    </td>
                  </tr>
                </table>
                <div style="text-align:center;margin-top:26px;">
                  <a href="${trackingUrl}" style="display:inline-block;background-color:#172554;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${buttonLabel}</a>
                </div>
                <p style="margin:26px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">${footerNote}</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;">
                <div style="font-size:11px;color:#94a3b8;">&copy; ${new Date().getFullYear()} ${senderName} &middot; Email otomatis, mohon tidak membalas email ini.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
