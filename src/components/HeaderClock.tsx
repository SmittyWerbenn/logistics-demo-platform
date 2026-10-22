import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { formatTanggalPendek, wibClock } from "../utils/format";

/** Live WIB date + time shown in the portal headers. Always Western
 * Indonesia Time (UTC+7), independent of the device's timezone, so every
 * user sees the same reference time as the tracking data. Compact on
 * phones (HH:mm + short date), full (with seconds + weekday) from `sm`. */
export function HeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const c = wibClock(now);
  const tanggalPendek = formatTanggalPendek(c.tanggal); // "30 Sep 2026"
  const tanggalRingkas = tanggalPendek.slice(0, -5); // "30 Sep"

  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 sm:gap-2.5 sm:px-3 sm:py-1.5"
      title={`${c.hari}, ${tanggalPendek} ${c.jam}:${c.detik} WIB`}
      role="timer"
      aria-label={`Waktu saat ini ${c.hari}, ${tanggalPendek}, pukul ${c.jam} WIB`}
    >
      <span className="hidden h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-800 sm:flex">
        <CalendarDays size={16} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="flex items-baseline gap-1 font-semibold tabular-nums text-slate-900">
          <span className="text-[13px] sm:text-sm">
            {c.jam}
            <span className="hidden text-slate-400 sm:inline">:{c.detik}</span>
          </span>
          <span className="text-[9px] font-bold tracking-wide text-blue-800 sm:text-[10px]">WIB</span>
        </span>
        <span className="whitespace-nowrap text-[10px] text-slate-500 sm:text-[11px]">
          <span className="sm:hidden">{tanggalRingkas}</span>
          <span className="hidden sm:inline">
            {c.hari}, {tanggalPendek}
          </span>
        </span>
      </div>
    </div>
  );
}
