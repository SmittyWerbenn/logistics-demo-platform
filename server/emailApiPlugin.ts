import type { IncomingMessage, ServerResponse } from "node:http";
import nodemailer from "nodemailer";
import type { Connect, Plugin } from "vite";
import { buildEmailHtml, emailSubject, type EmailRecipientRole } from "./emailTemplate.ts";

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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function createHandler(env: Record<string, string>): Connect.NextHandleFunction {
  // senderName brands the email body (header bar, "Dari" field, footer);
  // fromName is only the SMTP From mailbox display name shown in the inbox
  // list, which can be a different, independently-verified sender identity.
  const senderName = env.BREVO_SENDER_NAME || "PT Gangsar Mitra Suatama";
  const fromName = env.BREVO_FROM_NAME || senderName;
  // Demo clone: never send real email from the demo. The UI's "kirim email"
  // button still succeeds so the flow can be shown end-to-end.
  const demoMode = env.DEMO_MODE === "true";

  return async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    if (demoMode) {
      sendJson(res, 200, { ok: true, demo: true });
      return;
    }

    if (!env.BREVO_SMTP_HOST || !env.BREVO_SMTP_LOGIN || !env.BREVO_SMTP_KEY || !env.BREVO_SENDER_EMAIL) {
      sendJson(res, 500, {
        ok: false,
        error: "Konfigurasi SMTP belum lengkap di file .env (BREVO_SMTP_HOST/LOGIN/KEY/SENDER_EMAIL).",
      });
      return;
    }

    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw || "{}") as SendEmailBody;

      if (!data.to || !data.awb || !data.trackingUrl) {
        sendJson(res, 400, { ok: false, error: "Data email tidak lengkap (to/awb/trackingUrl wajib diisi)." });
        return;
      }

      const transporter = nodemailer.createTransport({
        host: env.BREVO_SMTP_HOST,
        port: Number(env.BREVO_SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: env.BREVO_SMTP_LOGIN,
          pass: env.BREVO_SMTP_KEY,
        },
      });

      const recipientRole: EmailRecipientRole = data.recipientRole === "pengirim" ? "pengirim" : "penerima";

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

      await transporter.sendMail({
        from: `"${fromName}" <${env.BREVO_SENDER_EMAIL}>`,
        to: data.toName ? `"${data.toName}" <${data.to}>` : data.to,
        subject: emailSubject(data.awb, recipientRole),
        html,
      });

      sendJson(res, 200, { ok: true });
    } catch (err) {
      console.error("[email-api] gagal mengirim email:", err);
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : "Gagal mengirim email melalui SMTP.",
      });
    }
  };
}

/**
 * Dev-only email API. Adds POST /api/send-email backed by Brevo SMTP via
 * nodemailer. Credentials are read from process env (server-side only) and
 * never bundled into client code. Only active while running `vite dev` /
 * `vite preview` — a static production build has no server to host this.
 */
export function emailApiPlugin(env: Record<string, string>): Plugin {
  const handler = createHandler(env);
  return {
    name: "gms-email-api",
    configureServer(server) {
      server.middlewares.use("/api/send-email", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/send-email", handler);
    },
  };
}
