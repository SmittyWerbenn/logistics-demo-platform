import { api } from "./apiClient";

const base = (awb: string) => `/api/shipments/${encodeURIComponent(awb)}`;

/** Park the order (only offered when the API says canHold). Reason is mandatory. */
export const holdOrder = (awb: string, alasan: string) => api.post(`${base(awb)}/hold`, { alasan });

/** Return the order to the status it was held from (only when the API says canRelease). */
export const releaseHold = (awb: string, alasan: string) => api.post(`${base(awb)}/release-hold`, { alasan });
