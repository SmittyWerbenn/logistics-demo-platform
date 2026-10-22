import type { Env, AuthedUser } from "./types";
import { newId } from "./crypto";

export async function writeAuditLog(
  env: Env,
  actor: AuthedUser | null,
  entry: {
    action: string;
    actionLabel: string;
    module: string;
    awb?: string;
    description: string;
  },
  ip?: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_log (id, timestamp, user_id, user_name, role, action, action_label, module, awb, description, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      new Date().toISOString(),
      actor?.id ?? null,
      actor?.nama ?? "System",
      actor?.role ?? "Superadmin",
      entry.action,
      entry.actionLabel,
      entry.module,
      entry.awb ?? null,
      entry.description,
      ip ?? null,
    )
    .run();
}
