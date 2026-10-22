import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../store/LanguageContext";
import type { ProofOfDelivery } from "../types";
import { formatJam, formatTanggalPanjang } from "../utils/format";
import { ImageLightbox, PhotoThumb } from "./ImageLightbox";

export function ProofOfDeliveryCard({ pod }: { pod: ProofOfDelivery }) {
  const { t } = useLanguage();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
      <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-100 px-4 py-3 sm:px-5">
        <CheckCircle2 size={20} className="text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">{t.pod.title}</p>
          <p className="text-xs text-emerald-700">{t.pod.delivered}</p>
        </div>
        <span className="ml-auto rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold tracking-wide text-white">
          DELIVERED
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">{t.pod.dateTime}</dt>
            <dd className="font-medium text-slate-800">
              {formatTanggalPanjang(pod.tanggal)}
              <br />
              {formatJam(pod.jam)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t.pod.location}</dt>
            <dd className="font-medium text-slate-800">{pod.lokasi}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t.pod.receivedBy}</dt>
            <dd className="font-medium text-slate-800">{pod.namaPenerima}</dd>
          </div>
        </dl>

        {pod.catatan && (
          <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-600">{pod.catatan}</p>
        )}

        {pod.fotoBarang && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs text-slate-500">{t.pod.itemPhoto}</p>
            <PhotoThumb
              src={pod.fotoBarang}
              alt={t.pod.itemPhoto}
              className="h-28 w-28"
              onClick={() => setLightboxOpen(true)}
            />
          </div>
        )}
      </div>

      <ImageLightbox
        src={lightboxOpen ? (pod.fotoBarang ?? null) : null}
        caption={t.pod.itemPhoto}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
