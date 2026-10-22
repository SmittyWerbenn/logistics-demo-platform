import { api } from "./apiClient";

const base = (awb: string) => `/api/shipments/${encodeURIComponent(awb)}`;

/** Immediate cancellation (only offered when the API says canDirect). Reason is mandatory. */
export const cancelOrder = (awb: string, alasan: string) => api.post(`${base(awb)}/cancel`, { alasan });

/** GMS staff asks the Client to approve cancelling the Client's own order. */
export const requestCancellation = (awb: string, alasan: string) => api.post(`${base(awb)}/cancel-request`, { alasan });

/** The Client's decision on a pending request; keterangan is mandatory. */
export const decideCancellation = (awb: string, decision: "approve" | "reject", keterangan: string) =>
  api.post(`${base(awb)}/cancel-request/decision`, { decision, keterangan });

export const withdrawCancellation = (awb: string, keterangan?: string) => api.post(`${base(awb)}/cancel-request/withdraw`, { keterangan });

export const CANCELLATION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Konfirmasi Client",
  APPROVED: "Disetujui Client",
  REJECTED: "Ditolak Client",
  WITHDRAWN: "Ditarik",
  EXPIRED: "Kedaluwarsa",
};
