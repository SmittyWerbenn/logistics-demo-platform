import type { PersonInfo, Shipment } from "../types";

/** The subset of a Shipment this module actually needs - lets callers pass
 * a freshly-created shipment before its full server-hydrated record (with
 * timeline, truck snapshot, etc.) has been fetched back. */
export interface EmailableShipment {
  awb: string;
  kotaAsal: string;
  kotaTujuan: string;
  status: Shipment["status"];
  tanggalDibuat: string;
  pengirim: PersonInfo;
  penerima: PersonInfo;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export type EmailRecipientRole = "penerima" | "pengirim" | "admin";

// Production email endpoint: a Cloudflare Worker (see cloudflare-worker/)
// that speaks real SMTP to Brevo via TCP sockets, since a static host like
// GitHub Pages can't run server code itself.
const WORKER_EMAIL_ENDPOINT = "https://gms-email-api.indotrans-tracking.workers.dev/send-email";

function isLocalDev(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * Local dev (`npm run dev` / `npm run preview`) uses the Vite dev-server
 * route (see server/emailApiPlugin.ts) so no network hop is needed; any
 * other host (GitHub Pages, a custom domain pointed at it, etc.) calls the
 * deployed Cloudflare Worker instead, which holds the same Brevo SMTP
 * credentials as server-side secrets.
 */
function emailEndpoint(): string {
  return isLocalDev() ? "/api/send-email" : WORKER_EMAIL_ENDPOINT;
}

interface PostEmailPayload {
 to: string;
 toName: string;
 recipientRole: EmailRecipientRole;
 awb: string;
 kotaAsal: string;
 kotaTujuan: string;
 status: string;
 tanggalDibuat: string;
 trackingUrl: string;
 pengirimNama: string;
}

async function postEmail(payload: PostEmailPayload): Promise<SendEmailResult> {
  // Static demo: no SMTP/Worker. Report success so the flow can be shown.
  if (((import.meta.env.VITE_DEMO_MODE as string | undefined) ?? "true") !== "false") {
    return { ok: true };
  }
  try {
    const res = await fetch(emailEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? `Gagal mengirim email (status ${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Tidak dapat terhubung ke server email: ${err.message}`
          : "Tidak dapat terhubung ke server email.",
    };
  }
}

/**
 * Sends the resi/tracking notification email. `recipient` selects whether
 * it goes to the penerima (default) or the pengirim.
 */
export async function sendTrackingEmail(
  shipment: EmailableShipment,
  trackingUrl: string,
  recipient: "penerima" | "pengirim" = "penerima",
): Promise<SendEmailResult> {
  const person = shipment[recipient];
  return postEmail({
  to: person.email,
  toName: person.nama,
  recipientRole: recipient,
  awb: shipment.awb,
  kotaAsal: shipment.kotaAsal,
  kotaTujuan: shipment.kotaTujuan,
  status: shipment.status,
  tanggalDibuat: shipment.tanggalDibuat,
  trackingUrl,
  pengirimNama: shipment.pengirim.nama,
  });
}

/** Internal-only notification, sent to a single admin/superadmin account
 * when a shipment reaches "Selesai / Terkirim" - links to the admin detail
 * page instead of the public tracking page. */
export async function sendAdminDeliveryEmail(
  shipment: EmailableShipment,
  adminDetailUrl: string,
  adminEmail: string,
  adminNama: string,
): Promise<SendEmailResult> {
  return postEmail({
  to: adminEmail,
  toName: adminNama,
  recipientRole: "admin",
  awb: shipment.awb,
  kotaAsal: shipment.kotaAsal,
  kotaTujuan: shipment.kotaTujuan,
  status: shipment.status,
  tanggalDibuat: shipment.tanggalDibuat,
  trackingUrl: adminDetailUrl,
  pengirimNama: shipment.pengirim.nama,
  });
}
