/** SLA/ETA calculation. Admin only ever inputs an SLA (a business-day
 * count); ETA is always derived, never entered directly - see the shipment
 * routes for where this is called. Business day = Mon-Fri; no holiday
 * calendar yet (sla_unit is kept separate from sla_value specifically so a
 * future "hari_kalender" or holiday-aware unit can be added without a
 * schema change). */

export type SlaUnit = "hari_kerja";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Adds N business days to a "YYYY-MM-DD" date, skipping Sat/Sun. Parses
 * and returns pure calendar dates (UTC-anchored, no time-of-day) so this
 * is immune to server/browser timezone differences - see section 13 of the
 * spec this implements. */
export function addBusinessDays(startDateIso: string, days: number): string {
  const [y, m, d] = startDateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  let remaining = days;
  while (remaining > 0) {
    date.setTime(date.getTime() + MS_PER_DAY);
    if (!isWeekend(date)) remaining--;
  }
  return date.toISOString().slice(0, 10);
}

/** Returns the calculated ETA ("YYYY-MM-DD"), or null if no SLA was given -
 * never fabricates a date. */
export function calculateEta(startDateIso: string, slaValue: number | null, slaUnit: SlaUnit | null): string | null {
  if (slaValue === null || slaUnit === null) return null;
  if (slaUnit === "hari_kerja") return addBusinessDays(startDateIso, slaValue);
  return null;
}
