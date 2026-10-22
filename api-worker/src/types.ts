export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  MINIO_ENDPOINT: string;
  MINIO_BUCKET: string;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  SESSION_TTL_HOURS: string;
  /** Base URL of the gms-email-api worker (e.g. https://gms-email-api.indotrans-tracking.workers.dev). */
  EMAIL_API_URL: string;
  /** Shared secret matching gms-email-api's REPORT_API_TOKEN; authenticates /send-report calls. */
  REPORT_API_TOKEN: string;
  /** "false" disables the daily report scheduler (manual trigger still works). */
  DAILY_REPORT_ENABLED: string;
  /** Demo clone only: "true" stores uploads in D1 instead of MinIO. */
  DEMO_MODE?: string;
}

export type Role = "Superadmin" | "Admin" | "Driver" | "Viewer" | "Client" | "Mitra";

export interface AuthedUser {
  id: string;
  nama: string;
  email: string;
  role: Role;
  aktif: number;
  /** Set only for role "Client" - scopes every shipment-visibility
   * check to just this customer's own data. */
  customerId: string | null;
  /** Set only for role "Mitra" - scopes every shipment-visibility
   * check to just the shipments forwarded/assigned to this Mitra. */
  mitraId: string | null;
}

export interface Ctx {
  env: Env;
  request: Request;
  user: AuthedUser | null;
  requestId: string;
}
