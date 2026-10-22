import type { AppUser } from "../types";
import { roleLabel } from "../types";
import { formatTimestampWib } from "./format";
import type { UserGroup } from "./useUserList";
import { downloadXlsx } from "./xlsx";

const DRIVER_HEADERS = ["Nama", "Email", "Nopol", "Nomor HP Driver", "Status", "Last Login", "Dibuat"] as const;
const STAFF_HEADERS = ["Nama", "Email", "Role", "Client ID / Kode Mitra", "Status", "Last Login", "Dibuat"] as const;

const dateOrDash = (iso?: string) => (iso ? formatTimestampWib(iso) : "-");

/**
 * Downloads the given users as .xlsx. Passwords are never exported - not the
 * plain text (which is never stored) and not the hash (the API doesn't even
 * return it, and no password column exists in this file).
 */
export async function exportUsersXlsx(users: AppUser[], group: UserGroup): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (group === "driver") {
    await downloadXlsx(
      `user-driver-${today}.xlsx`,
      DRIVER_HEADERS,
      users.map((u) => [u.nama, u.email, u.nopol ?? "-", u.driverTelepon ?? "-", u.aktif ? "Aktif" : "Nonaktif", dateOrDash(u.lastLogin), dateOrDash(u.createdAt)]),
      [26, 32, 16, 18, 10, 22, 22],
    );
    return;
  }
  await downloadXlsx(
    `user-${today}.xlsx`,
    STAFF_HEADERS,
    users.map((u) => [
      u.nama,
      u.email,
      roleLabel(u.role),
      u.customerId ?? u.mitraId ?? "-",
      u.aktif ? "Aktif" : "Nonaktif",
      dateOrDash(u.lastLogin),
      dateOrDash(u.createdAt),
    ]),
    [26, 32, 16, 14, 22, 10, 22, 22],
  );
}
