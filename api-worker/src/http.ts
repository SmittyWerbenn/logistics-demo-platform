export class HttpError extends Error {
  status: number;
  code: string;
  /** Optional machine-readable context (e.g. the existing AWB of a duplicate reference). */
  details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  badRequest: (message: string, code = "VALIDATION_ERROR") => new HttpError(400, code, message),
  unauthenticated: (message = "Belum login atau sesi sudah berakhir.") => new HttpError(401, "UNAUTHENTICATED", message),
  forbidden: (message = "Anda tidak punya akses untuk aksi ini.") => new HttpError(403, "FORBIDDEN", message),
  notFound: (message = "Data tidak ditemukan.") => new HttpError(404, "NOT_FOUND", message),
  conflict: (message: string) => new HttpError(409, "CONFLICT", message),
  unprocessable: (message: string) => new HttpError(422, "BUSINESS_RULE_ERROR", message),
  rateLimited: (message = "Terlalu banyak percobaan, coba lagi nanti.") => new HttpError(429, "RATE_LIMITED", message),
  internal: (message = "Terjadi kesalahan pada server. Silakan coba lagi.") => new HttpError(500, "INTERNAL_ERROR", message),
};

export function jsonResponse(body: unknown, status: number, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export function ok(data: unknown, extraHeaders: HeadersInit = {}, status = 200): Response {
  return jsonResponse({ success: true, data }, status, extraHeaders);
}

export function errorResponse(err: unknown, requestId: string, extraHeaders: HeadersInit = {}): Response {
  if (err instanceof HttpError) {
    return jsonResponse(
      { success: false, error: { code: err.code, message: err.message, requestId, ...(err.details ? { details: err.details } : {}) } },
      err.status,
      extraHeaders,
    );
  }
  console.error(`[${requestId}] Unhandled error:`, err);
  return jsonResponse(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server. Silakan coba lagi.", requestId } },
    500,
    extraHeaders,
  );
}
