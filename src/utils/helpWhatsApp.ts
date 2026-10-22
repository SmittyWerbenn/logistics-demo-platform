import { api } from "./apiClient";

export type HelpTopic = "lupa_password" | "kendala";

/** Answer of the help-number endpoints. `number` is already normalized for
 * wa.me and is null when that Pengaturan field has not been configured. */
export interface HelpTargetInfo {
  target: "admin" | "superadmin";
  targetLabel: string;
  configured: boolean;
  number: string | null;
}

/** Lupa Password from a login page: nobody is signed in, so the destination
 * (Admin vs Superadmin) is decided server-side from the typed email. */
export function fetchLupaPasswordTarget(email: string): Promise<HelpTargetInfo> {
  return api.post<HelpTargetInfo>("/api/public/help-whatsapp", { email: email.trim() }, { auth: false });
}

/** For a signed-in user: the destination is decided server-side from the
 * caller's own role (e.g. Driver + kendala -> Admin). */
export function fetchHelpTarget(topic: HelpTopic): Promise<HelpTargetInfo> {
  return api.get<HelpTargetInfo>(`/api/help-whatsapp?topic=${encodeURIComponent(topic)}`);
}

export function notConfiguredMessage(info: Pick<HelpTargetInfo, "targetLabel">): string {
  return `${info.targetLabel} belum dikonfigurasi. Silakan hubungi pengelola sistem.`;
}
