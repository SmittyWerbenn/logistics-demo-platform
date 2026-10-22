import { WorkerMailer } from "worker-mailer";
import { buildEmailHtml, emailSubject, type EmailRecipientRole } from "../../server/emailTemplate.ts";

export interface Env {
  BREVO_SMTP_HOST: string;
  BREVO_SMTP_PORT: string;
  BREVO_SMTP_LOGIN: string;
  BREVO_SMTP_KEY: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  BREVO_FROM_NAME?: string;
  ALLOWED_ORIGINS: string;
  /** Shared secret for server-to-server report calls from gms-api. */
  REPORT_API_TOKEN: string;
}

interface SendEmailBody {
  to?: string;
  toName?: string;
  awb?: string;
  kotaAsal?: string;
  kotaTujuan?: string;
  status?: string;
  tanggalDibuat?: string;
  trackingUrl?: string;
  pengirimNama?: string;
  recipientRole?: EmailRecipientRole;
}

/** Daily report email: arbitrary HTML body + CSV attachment, authenticated by
 * a shared token (REPORT_API_TOKEN) so only gms-api can call it. */
interface SendReportBody {
  token?: string;
  to?: string;
  toName?: string;
  subject?: string;
  html?: string;
  csvContent?: string;
  csvFilename?: string;
}

function corsHeaders(origin: string | null, allowedOrigins: string[]): HeadersInit {
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    // ---- Existing: tracking notification email ----
    if (url.pathname === "/send-email") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Method not allowed" }, 405, cors);
      }

      let data: SendEmailBody;
      try {
        data = (await request.json()) as SendEmailBody;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, cors);
      }

      if (!data.to || !data.awb || !data.trackingUrl) {
        return json({ ok: false, error: "Data email tidak lengkap (to/awb/trackingUrl wajib diisi)." }, 400, cors);
      }

      const recipientRole: EmailRecipientRole =
        data.recipientRole === "pengirim" || data.recipientRole === "admin" ? data.recipientRole : "penerima";
      const senderName = env.BREVO_SENDER_NAME || "PT Gangsar Mitra Suatama";
      const fromName = env.BREVO_FROM_NAME || senderName;

      const html = buildEmailHtml({
        toName: data.toName,
        awb: data.awb,
        kotaAsal: data.kotaAsal ?? "-",
        kotaTujuan: data.kotaTujuan ?? "-",
        status: data.status ?? "Dalam Proses",
        tanggalDibuat: data.tanggalDibuat ?? new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
        trackingUrl: data.trackingUrl,
        senderName,
        pengirimNama: data.pengirimNama ?? "-",
        recipientRole,
      });

      try {
        const mailer = await WorkerMailer.connect({
          host: env.BREVO_SMTP_HOST,
          port: Number(env.BREVO_SMTP_PORT) || 587,
          secure: false,
          startTls: true,
          credentials: { username: env.BREVO_SMTP_LOGIN, password: env.BREVO_SMTP_KEY },
          authType: "plain",
        });

        await mailer.send({
          from: { name: fromName, email: env.BREVO_SENDER_EMAIL },
          to: { name: data.toName, email: data.to },
          subject: emailSubject(data.awb, recipientRole),
          html,
        });

        return json({ ok: true }, 200, cors);
      } catch (err) {
        console.error("[gms-email-api] send failed:", err);
        return json(
          { ok: false, error: err instanceof Error ? err.message : "Gagal mengirim email melalui SMTP." },
          500,
          cors,
        );
      }
    }

    // ---- New: daily report email with CSV attachment ----
    if (url.pathname === "/send-report") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Method not allowed" }, 405, cors);
      }

      // Token auth: only gms-api (which holds the same secret) may call this.
      let data: SendReportBody;
      try {
        data = (await request.json()) as SendReportBody;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, cors);
      }

      if (!env.REPORT_API_TOKEN || data.token !== env.REPORT_API_TOKEN) {
        return json({ ok: false, error: "Unauthorized" }, 403, cors);
      }
      if (!data.to || !data.subject || !data.html || !data.csvContent || !data.csvFilename) {
        return json({ ok: false, error: "Data laporan tidak lengkap (to/subject/html/csvContent/csvFilename wajib diisi)." }, 400, cors);
      }

      const senderName = env.BREVO_SENDER_NAME || "PT Gangsar Mitra Suatama";
      const fromName = env.BREVO_FROM_NAME || senderName;

      try {
        const mailer = await WorkerMailer.connect({
          host: env.BREVO_SMTP_HOST,
          port: Number(env.BREVO_SMTP_PORT) || 587,
          secure: false,
          startTls: true,
          credentials: { username: env.BREVO_SMTP_LOGIN, password: env.BREVO_SMTP_KEY },
          authType: "plain",
        });

        await mailer.send({
          from: { name: fromName, email: env.BREVO_SENDER_EMAIL },
          to: { name: data.toName || "", email: data.to },
          subject: data.subject,
          html: data.html,
          attachments: [
            {
              filename: data.csvFilename,
              content: data.csvContent,
              mimeType: "text/csv; charset=utf-8",
            },
          ],
        });

        return json({ ok: true }, 200, cors);
      } catch (err) {
        console.error("[gms-email-api] report send failed:", err);
        return json(
          { ok: false, error: err instanceof Error ? err.message : "Gagal mengirim email laporan melalui SMTP." },
          500,
          cors,
        );
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
