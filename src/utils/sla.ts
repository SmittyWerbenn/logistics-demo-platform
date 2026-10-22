/** Client-side mirror of api-worker/src/sla.ts, used only for a live ETA
 * preview while the admin types an SLA - the backend recalculates and
 * stores the authoritative value, this never gets written anywhere. */

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function addBusinessDays(startDateIso: string, days: number): string {
  const [y, m, d] = startDateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (!isWeekend(date)) remaining--;
  }
  return date.toISOString().slice(0, 10);
}
