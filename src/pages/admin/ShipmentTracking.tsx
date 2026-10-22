import { adminPath } from "../../utils/urls";
import { ArrowLeft, ArrowRight, CalendarClock, PackageSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { ProofOfDeliveryCard } from "../../components/ProofOfDeliveryCard";
import { StatusBadge } from "../../components/StatusBadge";
import { StatusStepper } from "../../components/StatusStepper";
import { TrackingTimeline } from "../../components/TrackingTimeline";
import { useShipments } from "../../store/ShipmentContext";
import type { Shipment } from "../../types";
import { formatTanggalPanjang, todayISO } from "../../utils/format";

/** Admin-portal tracking view - same status stepper/timeline as the public
 * /tracking/:awb page, but inside AdminLayout (no public header/footer) and
 * fetched via the authenticated admin API instead of the public endpoint,
 * so an admin action never leaves the portal. */
export default function ShipmentTracking() {
  const { awb } = useParams<{ awb: string }>();
  const { getByAwb } = useShipments();
  const navigate = useNavigate();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getByAwb(awb ?? "").then((s) => {
      if (!cancelled) {
        setShipment(s);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awb]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
        </div>
      </AdminLayout>
    );
  }

  if (!shipment) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center py-10 text-center">
          <PackageSearch size={40} className="text-slate-300" />
          <h1 className="mt-4 text-lg font-semibold text-slate-800">AWB tidak ditemukan</h1>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            AWB <span className="font-mono font-medium text-slate-700">"{awb}"</span> tidak ditemukan dalam sistem.
          </p>
          <Link to={adminPath("/pengiriman")} className="mt-4 text-sm text-blue-700 hover:underline">
            Kembali ke Data Pengiriman
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const isDelivered = shipment.status === "Selesai / Terkirim";
  const isOverdue = !isDelivered && !!shipment.estimasiTiba && shipment.estimasiTiba < todayISO();

  return (
    <AdminLayout>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> Kembali
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Nomor Resi</p>
              <p className="font-mono text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{shipment.awb}</p>
            </div>
            <StatusBadge status={shipment.status} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock size={14} className={isOverdue ? "text-amber-500" : "text-slate-400"} />
            Estimasi Tiba:{" "}
            <span className={`font-medium ${isOverdue ? "text-amber-600" : "text-slate-700"}`}>
              {isDelivered
                ? "Terkirim"
                : shipment.estimasiTiba
                  ? formatTanggalPanjang(shipment.estimasiTiba)
                  : "Belum tersedia"}
            </span>
            {isOverdue && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                ⚠ Estimasi telah terlewati
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Asal</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{shipment.kotaAsal}</p>
          </div>
          <div className="pl-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tujuan</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              {shipment.kotaTujuan}
              <ArrowRight size={13} className="text-slate-300" />
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <StatusStepper status={shipment.status} />
      </div>

      {isDelivered && shipment.pod && (
        <div className="mt-5">
          <ProofOfDeliveryCard pod={shipment.pod} />
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Perjalanan Pengiriman</h2>
        <TrackingTimeline events={shipment.timeline} />
      </div>
    </AdminLayout>
  );
}
