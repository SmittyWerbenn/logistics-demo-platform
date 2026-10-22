import { adminPath } from "../utils/urls";
import { AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { StagnantInfo } from "../utils/stagnant";
import { formatTanggalPanjang } from "../utils/format";

export function StagnantShipmentsCard({ items }: { items: StagnantInfo[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <span className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-800">AWB Memerlukan Perhatian</h2>
        </span>
        {items.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <CheckCircle2 size={22} className="text-emerald-500" />
          <p className="text-sm text-slate-500">Semua pengiriman memiliki update terbaru.</p>
        </div>
      ) : (
        <>
          {/* Bounded height so a long list scrolls inside the card instead
              of stretching the whole dashboard page. */}
          <ul className="max-h-[380px] divide-y divide-slate-100 overflow-y-auto">
            {items.map(({ shipment, daysSinceUpdate, lastUpdateDate, lastUpdateTime }) => (
              <li key={shipment.awb} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-slate-900">{shipment.awb}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                    <AlertTriangle size={11} />
                    Needs Attention
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin size={12} className="text-slate-400" />
                  Status: {shipment.status} - Last update: {formatTanggalPanjang(lastUpdateDate)}, {lastUpdateTime} WIB
                </p>
                <p className="mt-0.5 text-xs font-medium text-red-600">
                  Tidak ada update: {daysSinceUpdate} hari
                </p>
                <Link
                  to={`/tracking/${shipment.awb}`}
                  className="mt-1.5 inline-block text-xs font-semibold text-blue-800 hover:underline"
                >
                  Lihat Tracking
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to={adminPath("/pengiriman?macet=1")}
            className="block border-t border-slate-100 px-5 py-2.5 text-center text-xs font-semibold text-blue-800 hover:bg-slate-50"
          >
            Lihat Semua di Data Pengiriman
          </Link>
        </>
      )}
    </div>
  );
}
