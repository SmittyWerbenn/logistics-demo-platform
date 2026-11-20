import { actionClass } from "./ActionButton";
import { PauseCircle, PlayCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Shipment } from "../types";
import { holdOrder, releaseHold } from "../utils/hold";
import { formatTanggalJam, isoToWib } from "../utils/format";
import { ReasonModal } from "./ReasonModal";
import { useToast } from "./Toast";

const fmtIso = (iso: string) => {
  const w = isoToWib(iso);
  return formatTanggalJam(w.tanggal, w.jam);
};

type Props = {
  shipment: Pick<Shipment, "awb" | "status" | "kotaAsal" | "kotaTujuan" | "pengirim" | "penerima" | "customerId" | "holdPolicy" | "hold">;
  onDone: () => unknown;
  /** "icon" for dense table rows, "full" for the detail header. */
  variant?: "icon" | "full";
};

/** Hold / Lepas Hold buttons. Which one appears comes from shipment.holdPolicy, decided by the API from
 * who created the order and its live status - the UI never decides that itself. */
export function HoldOrderActions({ shipment, onDone, variant = "icon" }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState<"hold" | "release" | null>(null);
  const policy = shipment.holdPolicy;
  if (!policy || (!policy.canHold && !policy.canRelease)) return null;

  const btn = (label: string, onClick: () => void, icon: ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={
        variant === "icon"
          ? actionClass("hold", true)
          : "inline-flex items-center gap-1.5 rounded-lg border-2 border-orange-600 bg-white px-3.5 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50"
      }
    >
      {icon} {label}
    </button>
  );

  const finish = async (message: string) => {
    setOpen(null);
    toast(message);
    await onDone();
  };

  const orderLine = (
    <dl className="mt-1 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
      <Row k="AWB" v={shipment.awb} mono />
      <Row k="Customer" v={shipment.customerId ?? shipment.pengirim?.nama ?? "-"} />
      <Row k="Rute" v={`${shipment.kotaAsal} → ${shipment.kotaTujuan}`} />
      <Row k="Status saat ini" v={shipment.status} />
      {shipment.hold && <Row k="Alasan Hold" v={shipment.hold.reason} />}
    </dl>
  );

  return (
    <>
      {policy.canHold && btn("Hold", () => setOpen("hold"), <PauseCircle size={variant === "icon" ? 14 : 15} />)}
      {policy.canRelease && btn("Lepas Hold", () => setOpen("release"), <PlayCircle size={variant === "icon" ? 14 : 15} />)}

      {open === "hold" && (
        <ReasonModal
          title="Hold Pengiriman"
          reasonLabel="Alasan Hold"
          placeholder="Contoh: Menunggu pembayaran dari pembeli."
          confirmLabel="Hold Pengiriman"
          tone="hold"
          onClose={() => setOpen(null)}
          onConfirm={async (reason) => {
            await holdOrder(shipment.awb, reason);
            await finish("Pengiriman di-Hold. AWB tetap aktif, tetapi belum muncul di Driver.");
          }}
        >
          <p>Anda akan menahan pengiriman ini. AWB tetap valid, tetapi order tidak akan masuk ke proses Driver sampai Hold dilepas.</p>
          {orderLine}
        </ReasonModal>
      )}

      {open === "release" && (
        <ReasonModal
          title="Lepas Hold Pengiriman"
          reasonLabel="Keterangan"
          placeholder="Contoh: Pembayaran dari pembeli sudah diterima."
          confirmLabel="Lepas Hold"
          tone="primary"
          onClose={() => setOpen(null)}
          onConfirm={async (reason) => {
            await releaseHold(shipment.awb, reason);
            await finish("Hold dilepas. Order kembali ke proses pengiriman normal.");
          }}
        >
          <p>Order ini akan kembali ke proses pengiriman normal (status sebelum Hold: {shipment.hold?.previousStatus ?? "-"}).</p>
          {orderLine}
        </ReasonModal>
      )}
    </>
  );

  function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
    return (
      <div className="flex gap-2">
        <dt className="w-28 shrink-0 text-xs text-slate-500">{k}</dt>
        <dd className={`break-words font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{v}</dd>
      </div>
    );
  }
}

/** Detail-page card: the active Hold and every past Hold episode (history is never overwritten). */
export function HoldInfo({ shipment }: { shipment: Pick<Shipment, "status" | "hold" | "holds" | "holdPolicy"> }) {
  const holds = shipment.holds ?? [];
  const note = shipment.holdPolicy?.blockedReason;
  if (holds.length === 0 && shipment.status !== "Hold") return null;
  return (
    <div className="no-print mt-4 rounded-xl border border-orange-200 bg-orange-50/40 p-4 text-sm shadow-sm">
      {shipment.status === "Hold" && shipment.hold ? (
        <>
          <p className="font-semibold text-orange-800">Pengiriman ini sedang di-Hold - belum muncul di Driver.</p>
          <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Field k="Hold Sejak" v={fmtIso(shipment.hold.holdAt)} />
            <Field k="Di-Hold Oleh" v={`${shipment.hold.holdBy} (${roleLabel(shipment.hold.holdByRole)})`} />
            <Field k="Alasan Hold" v={shipment.hold.reason} />
            <Field k="Kembali ke Status" v={shipment.hold.previousStatus} />
          </dl>
        </>
      ) : (
        <p className="font-semibold text-slate-700">Riwayat Hold</p>
      )}
      {note && shipment.status !== "Hold" && <p className="mt-2 text-xs text-slate-500">{note}</p>}
      {holds.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">#</th>
                <th className="py-1 pr-3 font-medium">Hold</th>
                <th className="py-1 pr-3 font-medium">Alasan</th>
                <th className="py-1 pr-3 font-medium">Dilepas</th>
                <th className="py-1 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody className="align-top text-slate-700">
              {holds.map((h, i) => (
                <tr key={h.id} className="border-t border-orange-100">
                  <td className="py-1.5 pr-3">{holds.length - i}</td>
                  <td className="py-1.5 pr-3">{fmtIso(h.holdAt)}<br />{h.holdBy}</td>
                  <td className="py-1.5 pr-3">{h.holdReason}</td>
                  <td className="py-1.5 pr-3">{h.releasedAt ? <>{fmtIso(h.releasedAt)}<br />{h.releasedBy ?? "-"}</> : <span className="font-semibold text-orange-700">Masih Hold</span>}</td>
                  <td className="py-1.5">{h.releaseReason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const roleLabel = (r: string) => (r === "Admin" ? "GMS-Admin" : r);

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  );
}
