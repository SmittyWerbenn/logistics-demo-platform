import { ArrowRight, CheckCircle2, MapPin, Truck } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../store/LanguageContext";
import type { TimelineEvent } from "../types";
import { formatJam, formatTanggalPanjang } from "../utils/format";
import { ImageLightbox, PhotoThumb } from "./ImageLightbox";

interface TrackingTimelineProps {
  events: TimelineEvent[];
}

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  const { t } = useLanguage();
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  // Show most recent first for the reading order, but keep chronological numbering.
  const ordered = [...events].reverse();

  return (
    <div className="relative">
      <ImageLightbox
        src={lightbox?.src ?? null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
      <ol className="relative">
        {ordered.map((event, idx) => {
          const isLatest = idx === 0;
          const isDelivered = event.type === "Selesai / Terkirim";
          return (
            <li key={event.id} className="relative flex gap-3.5 pb-6 last:pb-0">
              {/* connector line */}
              {idx !== ordered.length - 1 && (
                <span className="absolute left-[7px] top-5 h-[calc(100%-0.75rem)] w-px bg-blue-100" />
              )}
              <div className="relative flex flex-col items-center pt-1.5">
                <span
                  className={`z-10 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-slate-50 ${
                    isLatest ? "bg-blue-900" : "border-2 border-blue-300 bg-white"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-slate-500">
                    {formatTanggalPanjang(event.tanggal)} · {formatJam(event.jam)}
                  </p>
                  {isLatest && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                      {t.timeline.latest}
                    </span>
                  )}
                </div>

                <p
                  className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${
                    isDelivered ? "text-emerald-600" : "text-slate-900"
                  }`}
                >
                  {event.type}
                  {isDelivered && <CheckCircle2 size={15} className="shrink-0" />}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin size={13} className="shrink-0 text-slate-400" />
                  {event.lokasi}
                </p>

                {event.keterangan && (
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{event.keterangan}</p>
                )}

                {event.foto && event.foto.length > 0 && (
                  <div className="mt-2.5 flex gap-2 overflow-x-auto">
                    {event.foto.map((src, i) => (
                      <PhotoThumb
                        key={i}
                        src={src}
                        alt={`Dokumentasi ${event.type} ${i + 1}`}
                        className="h-16 w-16 shrink-0 sm:h-20 sm:w-20"
                        onClick={() =>
                          setLightbox({ src, caption: `${event.type} · ${event.lokasi}` })
                        }
                      />
                    ))}
                  </div>
                )}

                {event.type === "Transfer Unit" && event.truckSebelumnya && event.truck && (
                  <div className="mt-2.5 rounded-lg bg-blue-50 px-3 py-2.5">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                      Transfer Unit
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                      <div className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
                        <Truck size={14} className="text-slate-400" />
                        <span>{event.truckSebelumnya.jenis}</span>
                      </div>
                      <ArrowRight size={16} className="shrink-0 text-blue-400" />
                      <div className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 ring-1 ring-blue-100">
                        <Truck size={14} className="text-blue-500" />
                        <span className="font-medium">{event.truck.jenis}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
